import type { SportsMatch, SportsMatchDetails, SportsScoreboard, SportsStandingsTable, SportsTeam, SportsTeamProfile } from '../src/lib/types';
import { shiftSportsDay, sportsDay } from '../src/utils/sportsDates';

import { allFootballLeague, scoreboardSports, sportsLeagues } from '../src/lib/sportsLeagues';
import type { ScoreboardSport } from '../src/lib/sportsLeagues';
import { findScoreboardLeagues, footballCompetitionName, resolveTeamLeague } from './sportsCatalog';

type League = typeof sportsLeagues[number];

const host = 'https://site.api.espn.com/apis';
const scoreboards = new Map<string, { expires: number; data: SportsScoreboard }>();
const pending = new Map<string, Promise<SportsScoreboard>>();
const standingsCache = new Map<string, SportsStandingsTable & { expires: number }>();

async function getJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('ESPN HTTP ' + response.status);
  return response.json();
}

function matchStatus(status: any): SportsMatch['status'] {
  if (/postpon|cancel|abandon|suspend/i.test(status?.type?.name || '')) return 'POSTPONED';
  if (status?.type?.state === 'in') return 'LIVE';
  if (status?.type?.state === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

function score(value: unknown) {
  if ((typeof value !== 'string' || !value.trim()) && typeof value !== 'number') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function espnLink(event: any): string | undefined {
  const href = event.links?.find((link: any) => typeof link.href === 'string')?.href;
  if (typeof href !== 'string') return undefined;
  try {
    const url = new URL(href);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && (url.hostname === 'espn.com' || url.hostname.endsWith('.espn.com'))) {
      url.protocol = 'https:';
      return url.href;
    }
  } catch {
    return undefined;
  }
}

async function fetchLeague(league: League, day: string): Promise<SportsMatch[]> {
  const isGlobalFootball = league.id === allFootballLeague.id;
  const crossesMidnight = isGlobalFootball || ['Estados Unidos', 'México', 'Brasil', 'Argentina', 'Colombia', 'Chile', 'Sudamérica', 'Norteamérica', 'Internacional'].includes(league.country);
  const dates = crossesMidnight ? [shiftSportsDay(day, -1), day] : [day];
  const events = (await Promise.all(dates.map(async date => {
    const data = await getJson(host + '/site/v2/sports/' + league.path + '/scoreboard?dates=' + date.replaceAll('-', '') + '&limit=1000');
    if (!Array.isArray(data.events)) throw new Error('Missing ESPN events');
    return data.events;
  }))).flat();
  const matches: SportsMatch[] = [];

  for (const event of events) {
    const competitions = league.sport === 'tennis'
      ? (event.groupings ?? []).flatMap((group: any) => group.competitions ?? []).filter((item: any) => item.type?.slug?.endsWith('singles'))
      : event.competitions ?? [];
    for (const competition of competitions) {
      const date = new Date(competition.date || event.date);
      if (!Number.isFinite(date.getTime()) || sportsDay(date) !== day) continue;
      const statusInfo = competition.status ?? event.status;
      const status = matchStatus(statusInfo);
      const shared = {
        id: league.path + '-' + (competition.id || event.id),
        sport: league.sport,
        leagueId: league.id,
        eventId: String(event.id),
        competition: isGlobalFootball ? footballCompetitionName(event.season?.slug ?? 'Fútbol') : league.name,
        providerCompetitionId: isGlobalFootball ? event.uid?.match(/~l:([0-9]+)/)?.[1] : undefined,
        tournament: league.sport === 'tennis' ? event.name : undefined,
        matchTime: date.toISOString(),
        status,
        minute: status === 'LIVE' ? statusInfo?.type?.shortDetail || statusInfo?.displayClock : undefined,
        venue: competition.venue?.fullName,
        sourceUrl: espnLink(event)
      };
      if (league.sport === 'motorsport') {
        const session = competition.type?.text || competition.type?.abbreviation;
        matches.push({ ...shared, homeTeam: event.name, awayTeam: '', eventName: [event.name, session].filter(Boolean).join(' · ') });
        continue;
      }
      const home = competition.competitors?.find((team: any) => team.homeAway === 'home');
      const away = competition.competitors?.find((team: any) => team.homeAway === 'away');
      const local = home?.team ?? home?.athlete;
      const visitor = away?.team ?? away?.athlete;
      if (!local?.displayName || !visitor?.displayName) continue;
      const showScore = status === 'LIVE' || status === 'FINISHED';
      const periods = showScore && league.sport !== 'football' ? formatPeriods(home.linescores, away.linescores, league.sport) : undefined;
      const teamScore = (side: any) => league.sport === 'tennis'
        ? side.linescores?.filter((set: any) => set.winner === true).length
        : score(side.score);
      matches.push({
        ...shared,
        homeTeam: local.displayName,
        awayTeam: visitor.displayName,
        homeTeamId: home.team?.id ? String(home.team.id) : undefined,
        awayTeamId: away.team?.id ? String(away.team.id) : undefined,
        homeScore: showScore ? teamScore(home) : undefined,
        awayScore: showScore ? teamScore(away) : undefined,
        homeCrest: local.logo ?? local.flag?.href,
        awayCrest: visitor.logo ?? visitor.flag?.href,
        periods
      });
    }
  }
  return matches;
}

function formatPeriods(home: any[] | undefined, away: any[] | undefined, sport: ScoreboardSport) {
  const label = sport === 'tennis' ? 'Set ' : sport === 'hockey' ? 'P' : sport === 'baseball' ? 'E' : 'Q';
  return Array.from({ length: Math.max(home?.length ?? 0, away?.length ?? 0) }, (_, index) => {
    const text = (period: any) => score(period?.value) === undefined ? null : String(period.value);
    return { label: label + (index + 1), home: text(home?.[index]), away: text(away?.[index]) };
  }).filter(period => period.home !== null || period.away !== null);
}

function getLeagueScoreboard(day: string, league: League): Promise<SportsScoreboard> {
  const key = day + '/' + league.id;
  const cached = scoreboards.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data);
  const running = pending.get(key);
  if (running) return running;

  const request = fetchLeague(league, day).then(matches => ({
    matches: [...new Map(matches.map(match => [match.id, match])).values()],
    unavailable: [],
    updatedAt: new Date().toISOString(),
  })).catch(() => ({
    matches: (cached?.data.matches ?? []).filter(match => match.status !== 'LIVE'),
    unavailable: [league.name],
    updatedAt: cached?.data.updatedAt ?? null,
  })).then(data => {
    const ttl = day === sportsDay() || data.unavailable.length || data.matches.some(match => match.status === 'LIVE') ? 25000 : 120000;
    if (scoreboards.size >= 400 && !cached) {
      const oldest = scoreboards.keys().next().value;
      if (oldest) scoreboards.delete(oldest);
    }
    scoreboards.set(key, { data, expires: Date.now() + ttl });
    return data;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export async function getSportsScoreboard(day: string, sport: ScoreboardSport, ids?: string[]): Promise<SportsScoreboard> {
  const selected = ids ? await findScoreboardLeagues(sport, ids) : sportsLeagues.filter(league => league.sport === sport && league.featured);
  const results: SportsScoreboard[] = [];
  for (let offset = 0; offset < selected.length; offset += 12) {
    results.push(...await Promise.all(selected.slice(offset, offset + 12).map(league => getLeagueScoreboard(day, league))));
  }
  return {
    matches: results.flatMap(result => result.matches).sort((a, b) => a.matchTime.localeCompare(b.matchTime)),
    unavailable: results.flatMap(result => result.unavailable),
    updatedAt: results.flatMap(result => result.updatedAt ?? []).sort().at(-1) ?? null,
  };
}

export async function getLiveSports(): Promise<SportsScoreboard> {
  const today = sportsDay();
  const days = [shiftSportsDay(today, -1), today, shiftSportsDay(today, 1)];
  const boards = await Promise.all(days.flatMap(day => scoreboardSports.map(({ id }) =>
    getSportsScoreboard(day, id, id === 'football' ? [allFootballLeague.id] : undefined))));
  const live = boards.flatMap(board => board.matches.filter(match => match.status === 'LIVE'));
  return {
    matches: [...new Map(live.map(match => [match.id, match])).values()].sort((a, b) => a.matchTime.localeCompare(b.matchTime)),
    unavailable: [...new Set(boards.flatMap(board => board.unavailable))],
    updatedAt: boards.flatMap(board => board.updatedAt ?? []).sort().at(-1) ?? null
  };
}

export async function getSportsStandings(league: string) {
  const cached = standingsCache.get(league);
  if (cached && cached.expires > Date.now()) return cached;
  const data = await getJson(host + '/v2/sports/soccer/' + league + '/standings');
  const groups: SportsStandingsTable['groups'] = [];
  for (const group of data.children ?? []) {
    const entries = group.standings?.entries;
    if (!Array.isArray(entries) || !entries.length) continue;
    const rows = entries.flatMap((entry: any) => {
      if (typeof entry.team?.displayName !== 'string') return [];
      const stat = (name: string) => Number(entry.stats?.find((item: any) => item.name === name)?.value ?? 0);
      return [{
        rank: stat('rank'), team: entry.team.displayName, teamId: teamRecord(entry.team, league)?.id, played: stat('gamesPlayed'), won: stat('wins'),
        drawn: stat('ties'), lost: stat('losses'), goalDiff: stat('pointDifferential'), points: stat('points'),
        crest: entry.team.logos?.[0]?.href
      }];
    }).sort((a, b) => a.rank - b.rank);
    if (rows.length) groups.push({ name: String(group.name ?? '').replace(/^Group /i, 'Grupo ').replace(/^League Phase$/i, 'Fase liga'), rows });
  }
  if (!groups.length || !data.season?.displayName) throw new Error('Missing current standings');
  const result = { season: data.season.displayName as string, rows: groups[0].rows, groups, expires: Date.now() + 10 * 60000 };
  standingsCache.set(league, result);
  return result;
}


const statLabels: Record<string, string> = {
  possessionPct: 'Posesión', totalShots: 'Tiros totales', shotsOnTarget: 'Tiros a puerta',
  wonCorners: 'Córneres', foulsCommitted: 'Faltas', yellowCards: 'Tarjetas amarillas',
  redCards: 'Tarjetas rojas', offsides: 'Fueras de juego', saves: 'Paradas',
  totalPasses: 'Pases', accuratePasses: 'Pases completados', fieldGoalPct: 'Tiros de campo %',
  threePointFieldGoalPct: 'Triples %', freeThrowPct: 'Tiros libres %', rebounds: 'Rebotes',
  totalRebounds: 'Rebotes', assists: 'Asistencias', steals: 'Robos', blocks: 'Tapones',
  totalTurnovers: 'Pérdidas', turnovers: 'Pérdidas', fouls: 'Faltas'
};
const detailCache = new Map<string, { expires: number; data: SportsMatchDetails }>();

export async function getSportsMatchDetails(leagueId: string, eventId: string): Promise<SportsMatchDetails> {
  const league = await resolveTeamLeague(leagueId);
  if (!league) throw new Error('Unknown competition');
  const key = leagueId + '/' + eventId;
  const cached = detailCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const response = await getJson(host + '/site/v2/sports/' + league.path + '/summary?event=' + eventId);
  const match = response.header?.competitions?.[0];
  if (!match || String(response.header.id ?? match.id) !== eventId) throw new Error('Missing match');
  const competitors = match.competitors ?? [];
  const homeId = competitors.find((team: any) => team.homeAway === 'home')?.team?.id;
  const awayId = competitors.find((team: any) => team.homeAway === 'away')?.team?.id;
  const box = response.boxscore?.teams ?? [];
  const homeStats = box.find((team: any) => team.team?.id === homeId)?.statistics ?? [];
  const awayStats = box.find((team: any) => team.team?.id === awayId)?.statistics ?? [];
  const status = matchStatus(match.status);
  const value = (stats: any[], name: string): string | null => {
    const display = stats.find(stat => stat.name === name)?.displayValue;
    if (typeof display !== 'string' || !display.trim()) return null;
    return name === 'possessionPct' && !display.includes('%') ? display + '%' : display;
  };
  const stats = status === 'LIVE' || status === 'FINISHED' ? Object.entries(statLabels).flatMap(([name, label]) => {
    const home = value(homeStats, name);
    const away = value(awayStats, name);
    return home === null && away === null ? [] : [{ name: label, home, away }];
  }) : [];

  const events = (response.keyEvents ?? [])
    .filter((event: any) => event.text && (event.scoringPlay || /card|substitution|penalty|goal/i.test(event.type?.type || event.type?.text || '')))
    .slice(-30).reverse().map((event: any) => ({
      id: String(event.id), minute: event.clock?.displayValue ?? '', title: event.type?.text ?? '', description: event.text
    }));
  const lineups: SportsMatchDetails['lineups'] = [];
  for (const [side, id] of [['home', homeId], ['away', awayId]] as const) {
    if (id == null) continue;
    const roster = (response.rosters ?? []).find((item: any) => item.team?.id === id);
    const players = (roster?.roster ?? []).filter((player: any) => player.starter && player.athlete?.displayName)
      .map((player: any) => ({ name: player.athlete.displayName, shortName: player.athlete.shortName,
        number: player.jersey, position: player.position?.abbreviation, ...playerImage(player.athlete, league.sport) }));
    if (players.length) lineups.push({ side, formation: roster.formation, players });
  }

  const previous: SportsMatchDetails['previous'] = (response.seasonseries ?? [])
    .flatMap((series: any) => series.events ?? []).flatMap((event: any) => {
      const home = event.competitors?.find((team: any) => team.homeAway === 'home');
      const away = event.competitors?.find((team: any) => team.homeAway === 'away');
      if (!home?.team?.displayName || !away?.team?.displayName || score(home.score) === undefined || score(away.score) === undefined || !event.date) return [];
      if (String(event.id) === eventId || ![home.team.id, away.team.id].includes(homeId) || ![home.team.id, away.team.id].includes(awayId)) return [];
      return [{ id: String(event.id), title: home.team.displayName + ' – ' + away.team.displayName,
        home: String(home.score), away: String(away.score), date: event.date, url: espnLink(event) }];
    });
  const data = { stats, events, lineups, previous: [...new Map(previous.map(game => [game.id, game])).values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 8) };
  if (detailCache.size >= 150 && !cached) {
    const oldest = detailCache.keys().next().value;
    if (oldest) detailCache.delete(oldest);
  }
  detailCache.set(key, { data, expires: Date.now() + (status === 'FINISHED' ? 300000 : 25000) });
  return data;
}


const teamProfiles = new Map<string, { expires: number; data: SportsTeamProfile }>();
const teamDirectories = new Map<string, { expires: number; data: SportsTeam[] }>();

export function teamLeague(id: string) {
  if (id === allFootballLeague.id) return allFootballLeague;
  return sportsLeagues.find(league => league.id === id && league.sport !== 'tennis' && league.sport !== 'motorsport');
}

function playerImage(player: any, sport: ScoreboardSport) {
  const photo = player.headshot?.href;
  const id = String(player.id ?? '');
  return {
    espnId: /^\d{1,12}$/.test(id) ? id : undefined,
    football: sport === 'football',
    photo: typeof photo === 'string' && /^https:\/\/a\.espncdn\.com\//.test(photo) ? photo : undefined
  };
}

function teamRecord(team: any, leagueId: string): SportsTeam | undefined {
  const id = String(team?.id ?? '');
  const name = team?.displayName || team?.name;
  if (!/^\d{1,12}$/.test(id) || typeof name !== 'string' || !name.trim()) return;
  const logo = team.logo || team.logos?.[0]?.href;
  return { id, name, leagueId, crest: typeof logo === 'string' && logo.startsWith('https://') ? logo : undefined };
}

export async function getSportsTeams(leagueId: string) {
  const league = await resolveTeamLeague(leagueId);
  if (!league) throw new Error('Unknown league');
  const cached = teamDirectories.get(leagueId);
  if (cached && cached.expires > Date.now()) return cached.data;
  const result = await getJson(host + '/site/v2/sports/' + league.path + '/teams?limit=100');
  const teams = result.sports?.[0]?.leagues?.[0]?.teams;
  if (!Array.isArray(teams)) throw new Error('Missing team directory');
  const data: SportsTeam[] = teams.flatMap(entry => teamRecord(entry.team, leagueId) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  teamDirectories.set(leagueId, { data, expires: Date.now() + 3600000 });
  return data;
}

function scheduleMatch(event: any, league: League): SportsMatch | undefined {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((side: any) => side.homeAway === 'home');
  const away = competition?.competitors?.find((side: any) => side.homeAway === 'away');
  const eventId = String(event.id ?? '');
  const matchTime = new Date(competition?.date ?? event.date);
  if (!home?.team || !away?.team || !Number.isFinite(matchTime.getTime()) || !/^\d+$/.test(eventId)) return;
  const actualLeague = event.league?.slug ? teamLeague(event.league.slug) : league;
  const local = teamRecord(home.team, actualLeague?.id ?? league.id);
  const visitor = teamRecord(away.team, actualLeague?.id ?? league.id);
  if (!local || !visitor) return;
  const info = competition.status ?? event.status;
  const status = matchStatus(info);
  const displayScore = status === 'FINISHED' || status === 'LIVE';
  return {
    id: (actualLeague?.path ?? league.path) + '-' + (competition.id ?? eventId),
    eventId, leagueId: actualLeague?.id, sport: league.sport, competition: actualLeague?.name ?? event.league?.name ?? league.name,
    matchTime: matchTime.toISOString(), status, homeTeam: local.name, awayTeam: visitor.name,
    homeTeamId: local.id, awayTeamId: visitor.id, homeCrest: local.crest, awayCrest: visitor.crest,
    homeScore: displayScore ? score(home.score?.value ?? home.score) : undefined,
    awayScore: displayScore ? score(away.score?.value ?? away.score) : undefined,
    minute: status === 'LIVE' ? info?.type?.shortDetail : undefined,
    venue: competition.venue?.fullName, sourceUrl: espnLink(event)
  };
}

export async function getSportsTeamProfile(leagueId: string, teamId: string): Promise<SportsTeamProfile> {
  const league = await resolveTeamLeague(leagueId);
  if (!league) throw new Error('Unknown league');
  const key = leagueId + '/' + teamId;
  const cached = teamProfiles.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const teamPath = host + '/site/v2/sports/' + league.path + '/teams/' + teamId;
  const schedulePath = league.sport === 'football' ? host + '/site/v2/sports/soccer/all/teams/' + teamId + '/schedule' : teamPath + '/schedule';
  const schedule = getJson(schedulePath);
  const rosterRequest = league.id === allFootballLeague.id ? schedule.then(payload => {
    const recent = (payload.events ?? []).map((event: any) => teamLeague(event.league?.slug ?? ''))
      .filter((item: League | undefined): item is League => Boolean(item));
    const preferred = recent.find((item: League) => /\.\d+$/.test(item.id)) ?? recent[0];
    if (!preferred) throw new Error('No roster league');
    return getJson(host + '/site/v2/sports/' + preferred.path + '/teams/' + teamId + '/roster');
  }) : getJson(teamPath + '/roster');
  const [results, fixtures, roster] = await Promise.allSettled([
    schedule,
    league.sport === 'football' ? getJson(schedulePath + '?fixture=true') : schedule,
    rosterRequest
  ]);
  const payloads = [results, fixtures, roster].flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const team = payloads.flatMap(payload => {
    const record = teamRecord(payload.team, league.id);
    return record?.id === teamId ? [record] : [];
  })[0];
  if (!team) throw new Error('Missing team');
  const events = [results, fixtures].flatMap(result => result.status === 'fulfilled' && Array.isArray(result.value.events) ? result.value.events : []);
  const matches = [...new Map(events.flatMap(event => {
    const match = scheduleMatch(event, league);
    return match && (match.homeTeamId === teamId || match.awayTeamId === teamId) ? [[match.id, match] as const] : [];
  })).values()];
  const now = Date.now();
  const athletes = roster.status === 'fulfilled' && Array.isArray(roster.value.athletes) ? roster.value.athletes : [];
  const players: SportsTeamProfile['players'] = athletes.flatMap((entry: any) => entry.items ?? [entry]).flatMap((player: any) => {
    const name = player.displayName || player.fullName;
    return name ? [{ name, number: player.jersey, position: player.position?.displayName || player.position?.abbreviation, ...playerImage(player, league.sport) }] : [];
  });
  const data: SportsTeamProfile = {
    team, players,
    recent: matches.filter(match => match.status === 'FINISHED').sort((a, b) => b.matchTime.localeCompare(a.matchTime)).slice(0, 10),
    upcoming: matches.filter(match => match.status === 'LIVE' || (match.status === 'SCHEDULED' && Date.parse(match.matchTime) >= now - 3 * 3600000)).sort((a, b) => a.matchTime.localeCompare(b.matchTime)).slice(0, 10),
    unavailable: [results, fixtures, roster].flatMap((result, index) => result.status === 'rejected' ? [['resultados', 'calendario', 'plantilla'][index]] : [])
  };
  if (teamProfiles.size >= 100) {
    const oldest = teamProfiles.keys().next().value;
    if (oldest) teamProfiles.delete(oldest);
  }
  teamProfiles.set(key, { data, expires: now + 30000 });
  return data;
}
