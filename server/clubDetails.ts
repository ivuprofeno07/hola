import type { SportsClubDetails, SportsTeam } from '../src/lib/types';
import { spanishFederationDivisions, sportsLeagues } from '../src/lib/sportsLeagues';

const host = 'https://www.fotmob.com';
const cache = new Map<string, { expires: number; value: SportsClubDetails | null }>();
const pending = new Map<string, Promise<SportsClubDetails | null>>();
const normalized = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/\b(?:fc|cf|afc|calcio)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const aliases: Record<string, string> = {
  'internazionale': 'inter', 'bayern munich': 'bayern munchen', 'manchester united': 'manchester united',
  'atletico madrid': 'atletico madrid', 'athletic club': 'athletic bilbao', 'real betis': 'real betis',
  'paris saint germain': 'paris saint germain', 'rm castilla': 'real madrid castilla',
  'athletic b': 'athletic club b', 'cd lugo': 'lugo', 'ud logrones': 'logrones',
};
const canonical = (name: string) => aliases[normalized(name)] ?? normalized(name);
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

async function request(path: string, params: Record<string, string>) {
  const response = await fetch(host + '/api/data/' + path + '?' + new URLSearchParams(params), { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('FotMob HTTP ' + response.status);
  return response.json();
}

async function load(team: SportsTeam): Promise<SportsClubDetails | null> {
  const federation = spanishFederationDivisions.find(item => item.id === team.leagueId);
  const league = sportsLeagues.find(item => item.id === team.leagueId);
  if (league && league.sport !== 'football') return null;
  const women = /(?:^|\.)w(?:\.|$)|wchampions|nwsl/.test(team.leagueId);
  const name = canonical(team.name);
  const plainName = team.name.replace(/\s*\((?:W|Women)\)$/i, '').replace(/\s+(?:Women|Femenino)$/i, '');
  const search = await request('search/suggest', { term: plainName });
  if (!Array.isArray(search)) throw new Error('FotMob search unavailable');
  const all = search.find(group => group.title?.key === 'all')?.suggestions ?? [];
  const candidates = all.filter((item: any) => {
    if (item.type !== 'team' || !/^\d+$/.test(String(item.id)) || typeof item.name !== 'string') return false;
    const isWomen = /\(W\)$/.test(item.name) || /liga f|women|nwsl/i.test(item.leagueName ?? '');
    if (women !== isWomen) return false;
    if (federation && !canonical(String(item.leagueName ?? '')).includes(canonical(federation.name))) return false;
    return [name, canonical(plainName)].includes(canonical(item.name.replace(/\s*\(W\)$/i, '')));
  });
  const ids = [...new Set<string>(candidates.map((item: any) => String(item.id)))];
  if (ids.length !== 1) return null;
  const data = await request('teams', { id: ids[0] });
  if (String(data.details?.id) !== ids[0] || data.details?.type !== 'team') throw new Error('FotMob team mismatch');

  const trophies: SportsClubDetails['trophies'] = (data.history?.trophyList ?? []).flatMap((item: any) =>
    text(item.name) && positive(item.won) ? [{ name: item.name, titles: item.won, seasons: text(item.seasonsWon)?.split(',').map(season => season.trim()) ?? [] }] : []);
  const transfers: SportsClubDetails['transfers'] = (data.transfers?.allTransfers ?? []).flatMap((item: any) => {
    const id = Number(ids[0]);
    const direction = item.toClubId === id && item.fromClubId !== id ? 'in' : item.fromClubId === id && item.toClubId !== id ? 'out' : null;
    if (!direction || !text(item.name) || item.contractExtension || !Number.isFinite(Date.parse(item.transferDate))) return [];
    const feeLabel = String(item.fee?.localizedFeeText ?? item.fee?.feeText ?? '');
    const kind = /loan/.test(feeLabel) || item.onLoan ? 'loan' : /free/.test(feeLabel) ? 'free' : positive(item.fee?.value) ? 'transfer' : 'unknown';
    return [{
      player: item.name, date: item.transferDate, direction, kind,
      club: text(direction === 'in' ? item.fromClubFullName ?? item.fromClub : item.toClubFullName ?? item.toClub),
      fee: positive(item.fee?.value), estimate: positive(item.amountEuroEstimated)
    }];
  });
  transfers.sort((a, b) => b.date.localeCompare(a.date));
  const squad: { title: string; members?: any[] }[] = Array.isArray(data.squad?.squad) ? data.squad.squad : [];
  const coach = text(squad.find(group => group.title === 'coach')?.members?.[0]?.name);
  const players: SportsClubDetails['players'] = squad.filter(group => group.title !== 'coach').flatMap(group => (group.members ?? []).flatMap((player: any) =>
    text(player.name) ? [{ name: player.name, number: player.shirtNumber == null ? undefined : String(player.shirtNumber), position: group.title, age: positive(player.age), nationality: text(player.cname), height: positive(player.height) }] : []));
  const venue = data.overview?.venue;
  const capacity = Array.isArray(venue?.statPairs) ? venue.statPairs.find((item: unknown[]) => item[0] === 'Capacity')?.[1] : undefined;
  return {
    sourceUrl: host + '/teams/' + ids[0] + '/overview/' + (text(data.details.seopath)?.split('/').pop()?.replace(/[^a-z0-9-]/gi, '') || 'club'),
    season: text(data.details.latestSeason), competition: text(data.details.primaryLeagueName),
    stadium: text(venue?.widget?.name), city: text(venue?.widget?.city), capacity: positive(capacity),
    coach, trophies, transfers, players
  };
}

export function getSportsClubDetails(team: SportsTeam) {
  const key = team.leagueId + '/' + team.id;
  const stored = cache.get(key);
  if (stored && stored.expires > Date.now()) return Promise.resolve(stored.value);
  const running = pending.get(key);
  if (running) return running;
  const promise = load(team).then(value => {
    if (cache.size >= 180) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + (value ? 60 : 10) * 60000, value });
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
