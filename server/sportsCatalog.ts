import { allFootballLeague, sportsLeagues, type ScoreboardSport, type SportsLeague } from '../src/lib/sportsLeagues';

const countryByPrefix: Record<string, string> = {
  esp: 'España', eng: 'Inglaterra', ger: 'Alemania', ita: 'Italia', fra: 'Francia', por: 'Portugal',
  ned: 'Países Bajos', bel: 'Bélgica', sco: 'Escocia', tur: 'Turquía', gre: 'Grecia', sui: 'Suiza',
  aut: 'Austria', den: 'Dinamarca', nor: 'Noruega', swe: 'Suecia', usa: 'Estados Unidos', mex: 'México',
  bra: 'Brasil', arg: 'Argentina', col: 'Colombia', chi: 'Chile', ecu: 'Ecuador', per: 'Perú',
  uru: 'Uruguay', par: 'Paraguay', bol: 'Bolivia', ven: 'Venezuela', jpn: 'Japón', aus: 'Australia',
  chn: 'China', kor: 'Corea del Sur', ind: 'India', irl: 'Irlanda', pol: 'Polonia', rou: 'Rumanía',
  ukr: 'Ucrania', cze: 'Chequia', cro: 'Croacia', srb: 'Serbia', fin: 'Finlandia', isl: 'Islandia',
  uefa: 'Europa', conmebol: 'Sudamérica', concacaf: 'Norteamérica', afc: 'Asia', caf: 'África', fifa: 'Internacional'
};
let cached: { expires: number; leagues: SportsLeague[] } | undefined;
let pending: Promise<SportsLeague[]> | undefined;

export function footballCompetitionName(value: string) {
  const slug = value.replace(/^\d{4}(?:-\d{2,4})?-/, '');
  const known: Record<string, string> = {
    laliga: 'LaLiga', 'spanish-laliga': 'LaLiga', 'spanish-laliga-2': 'Segunda División',
    'english-premier-league': 'Premier League', 'english-league-championship': 'Championship',
    'uefa-champions-league': 'Champions League', 'uefa-europa-league': 'Europa League',
    'german-bundesliga': 'Bundesliga', 'italian-serie-a': 'Serie A', 'french-ligue-1': 'Ligue 1',
    'mexican-liga-bbva-mx': 'Liga MX', 'spanish-liga-f': 'Liga F'
  };
  return known[slug] ?? slug.replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export async function getSportsCatalog(): Promise<SportsLeague[]> {
  if (cached && cached.expires > Date.now()) return cached.leagues;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000', { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Catalog unavailable');
      const payload = await response.json();
      const leagues = new Map(sportsLeagues.map(league => [league.id, league]));
      for (const item of payload.items ?? []) {
        const id = typeof item.$ref === 'string' ? item.$ref.match(/\/leagues\/([a-z0-9][a-z0-9._-]{0,55})(?:[/?]|$)/)?.[1] : undefined;
        if (!id || leagues.has(id) || id === 'all') continue;
        const [prefix, ...parts] = id.split('.');
        const country = countryByPrefix[prefix] ?? 'Otras competiciones';
        const name = parts.length === 1 && /^\d+$/.test(parts[0])
          ? country + ' · División ' + parts[0]
          : [country === 'Otras competiciones' ? prefix.toUpperCase() : country, footballCompetitionName(parts.join('-') || prefix)].join(' · ');
        leagues.set(id, { id, name, country, path: 'soccer/' + id, sport: 'football' });
      }
      const data = [...leagues.values()];
      cached = { leagues: data, expires: Date.now() + 6 * 3600000 };
      return data;
    } catch {
      return cached?.leagues ?? sportsLeagues;
    }
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function findScoreboardLeagues(sport: ScoreboardSport, ids: string[]) {
  if (sport === 'football' && ids.length === 1 && ids[0] === allFootballLeague.id) return [allFootballLeague];
  const local = sportsLeagues.filter(league => league.sport === sport && ids.includes(league.id));
  if (local.length === new Set(ids).size) return local;
  if (sport !== 'football') return [];
  const catalog = await getSportsCatalog();
  return catalog.filter(league => league.sport === sport && ids.includes(league.id));
}

export async function resolveTeamLeague(id: string) {
  if (id === allFootballLeague.id) return allFootballLeague;
  return sportsLeagues.find(league => league.id === id && league.sport !== 'tennis' && league.sport !== 'motorsport')
    ?? (await getSportsCatalog()).find(league => league.id === id && league.sport === 'football');
}
