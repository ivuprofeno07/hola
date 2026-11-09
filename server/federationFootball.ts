import { createHash } from 'node:crypto';
import type { SportsMatch, SportsStanding, SportsStandingsTable, SportsTeamProfile } from '../src/lib/types';
import { spanishFederationDivisions } from '../src/lib/sportsLeagues';

const origin = 'https://as.com';
const teamKey = (name: string) => 'as-' + createHash('sha256').update(
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
).digest('hex').slice(0, 16);
const standingsCache = new Map<string, { expires: number; data: SportsStandingsTable }>();
const roundsCache = new Map<string, { expires: number; matches: SportsMatch[]; totalRounds: number }>();

function decode(value: string) {
  return value.replace(/&(?:amp|quot|apos|nbsp|#\d+);/g, entity => {
    if (entity.startsWith('&#')) {
      const code = Number(entity.slice(2, -1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity] ?? entity;
  }).trim();
}

async function page(path: string) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('AS HTTP ' + response.status);
  return response.text();
}

export async function getFederationStandings(division: typeof spanishFederationDivisions[number]) {
  const cached = standingsCache.get(division.id);
  if (cached && cached.expires > Date.now()) return cached.data;
  const sourceUrl = origin + '/resultados/futbol/' + division.id + '/clasificacion/';
  const html = await page(new URL(sourceUrl).pathname);
  const season = html.match(/<title[^>]*>[^<]*(\d{4}\/\d{4})/)?.[1];
  if (!season) throw new Error('AS season unavailable');

  const groups: SportsStandingsTable['groups'] = [];
  for (const table of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/g)) {
    const roman = table[1].match(/aria-describedby="grupo-([ivx]+)-caption"/)?.[1];
    const number = table[1].match(/id="a_tb_(\d+)"/)?.[1];
    if (!roman && !number) continue;
    const rows: SportsStanding[] = [];
    for (const row of (table[2].match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
      const entry = row[1];
      const rank = Number(entry.match(/<(?:th|span) class="(?:pos|a_tb_ps)"[^>]*>\s*(\d+)/)?.[1]);
      const team = entry.match(/<abbr[^>]*title="([^"]+)"/)?.[1];
      const cells = [...entry.matchAll(/<td class="([^"]+)"[^>]*>\s*(-?\d+)\s*<\/td>/g)];
      const stat = (name: string, index: number) => Number((roman ? cells.find(cell => cell[1].split(' ').includes(name)) : cells[index])?.[2]);
      const points = stat('pts', 0), played = stat('pj', 1), won = stat('pg', 2), drawn = stat('pe', 3), lost = stat('pp', 4), goalDiff = stat('dg', 7);
      if (!team || ![rank, points, played, won, drawn, lost, goalDiff].every(Number.isFinite)) continue;
      const crest = entry.match(/src="(https:\/\/static\.prisa\.com\/[^"]+)"/)?.[1];
      rows.push({ rank, team: decode(team), teamId: teamKey(decode(team)), points, played, won, drawn, lost, goalDiff, crest: crest && decode(crest) });
    }
    if (rows.length) groups.push({ name: 'Grupo ' + (roman?.toUpperCase() ?? number), rows });
  }
  if (groups.length !== division.groups) throw new Error('AS standings incomplete');
  const data = { season, groups, rows: groups[0].rows, sourceUrl };
  standingsCache.set(division.id, { data, expires: Date.now() + 10 * 60000 });
  return data;
}

export async function getFederationRound(division: typeof spanishFederationDivisions[number], requestedRound?: number) {
  const standings = await getFederationStandings(division);
  const played = standings.groups.flatMap(group => group.rows.map(row => row.played)).sort((a, b) => a - b);
  const round = requestedRound ?? Math.max(1, played[Math.floor(played.length / 2)]);
  const season = standings.season.replace('/', '_');
  const path = '/resultados/futbol/' + division.id + '/' + season + '/jornada/grupos_a_' + round + '/';
  const cached = roundsCache.get(path);
  if (cached && cached.expires > Date.now()) return { ...cached, round, updatedAt: new Date(cached.expires - 60000).toISOString(), unavailable: [] };
  const html = await page(path);
  const rounds = [...html.matchAll(/href="[^"]*\/jornada\/grupos_a_(\d+)\/"/g)].map(link => Number(link[1]));
  const totalRounds = Math.max(round, ...rounds);
  const matches: SportsMatch[] = [];
  for (const item of html.matchAll(/<li\b([^>]*\bdata-datetime="[^"]+"[^>]*)>([\s\S]*?)<\/li>/g)) {
    const attr = (name: string) => item[1].match(new RegExp('data-' + name + '="([^"]+)"'))?.[1];
    const id = attr('id'), home = attr('team-home-name'), away = attr('team-away-name'), time = attr('datetime');
    if (!id || !home || !away || !time || !Number.isFinite(Date.parse(time))) continue;
    const group = item[2].match(/class="a_sc_gp"[^>]*>([^<]+)</)?.[1];
    const label = item[2].match(/class="a_sc_st"[^>]*>([^<]+)</)?.[1] ?? '';
    const status = /aplazado|suspendido|cancelado/i.test(label) ? 'POSTPONED' : /finalizado/i.test(label) ? 'FINISHED' : 'SCHEDULED';
    const score = item[2].match(/class="a_sc_gl"[^>]*>\s*<span[^>]*>\s*(\d+)\s*-\s*(\d+)/);
    const crests = [...item[2].matchAll(/src="(https:\/\/static\.prisa\.com\/[^"]+)"/g)];
    matches.push({
      id: division.id + '-' + id, sport: 'football', leagueId: division.id,
      competition: division.name, tournament: group && decode(group), matchTime: new Date(time).toISOString(), status,
      homeTeam: decode(home), awayTeam: decode(away), homeTeamId: teamKey(decode(home)), awayTeamId: teamKey(decode(away)), homeCrest: crests[0] && decode(crests[0][1]),
      awayCrest: crests[1] && decode(crests[1][1]), sourceUrl: origin + path,
      homeScore: status === 'FINISHED' && score ? Number(score[1]) : undefined,
      awayScore: status === 'FINISHED' && score ? Number(score[2]) : undefined
    });
  }
  if (!matches.length) throw new Error('AS round unavailable');
  const updatedAt = new Date();
  const data = { matches, totalRounds, expires: updatedAt.getTime() + 60000 };
  if (roundsCache.size >= 150) roundsCache.delete(roundsCache.keys().next().value!);
  roundsCache.set(path, data);
  return { ...data, round, updatedAt: updatedAt.toISOString(), unavailable: [] };
}

export async function getFederationTeams(division: typeof spanishFederationDivisions[number]) {
  const standings = await getFederationStandings(division);
  return standings.groups.flatMap(group => group.rows.map(row => ({
    id: row.teamId!, name: row.team, crest: row.crest, leagueId: division.id
  }))).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getFederationTeamProfile(division: typeof spanishFederationDivisions[number], teamId: string): Promise<SportsTeamProfile> {
  const team = (await getFederationTeams(division)).find(item => item.id === teamId);
  if (!team) throw new Error('Unknown AS team');
  const current = await getFederationRound(division).catch(() => null);
  const neighbors = current ? await Promise.allSettled(
    [current.round - 1, current.round + 1].filter(round => round >= 1 && round <= current.totalRounds)
      .map(round => getFederationRound(division, round))
  ) : [];
  const matches = [...(current?.matches ?? []), ...neighbors.flatMap(board => board.status === 'fulfilled' ? board.value.matches : [])]
    .filter(match => match.homeTeamId === teamId || match.awayTeamId === teamId)
    .sort((a, b) => a.matchTime.localeCompare(b.matchTime));
  return {
    team, players: [], recent: matches.filter(match => match.status === 'FINISHED').reverse(),
    upcoming: matches.filter(match => match.status === 'SCHEDULED' && Date.parse(match.matchTime) >= Date.now()),
    unavailable: !current ? ['calendario y resultados'] : []
  };
}
