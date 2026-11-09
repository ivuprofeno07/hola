export const scoreboardSports = [
  { id: 'football', label: 'Fútbol' },
  { id: 'basketball', label: 'Baloncesto' },
  { id: 'tennis', label: 'Tenis' },
  { id: 'hockey', label: 'Hockey hielo' },
  { id: 'americanFootball', label: 'Fútbol americano' },
  { id: 'baseball', label: 'Béisbol' },
  { id: 'motorsport', label: 'Motor' },
] as const;

export type ScoreboardSport = typeof scoreboardSports[number]['id'];

export interface SportsLeague {
  id: string;
  name: string;
  country: string;
  path: string;
  sport: ScoreboardSport;
  featured?: boolean;
}

export const allFootballLeague: SportsLeague = {
  id: 'soccer.all', name: 'Fútbol · cobertura global', country: 'Internacional', path: 'soccer/all', sport: 'football'
};

const footballLeagues = [
  ['esp.1', 'LaLiga EA Sports', 'España', true],
  ['esp.2', 'LaLiga Hypermotion', 'España', true],
  ['esp.w.1', 'Liga F', 'España', true],
  ['esp.copa_del_rey', 'Copa del Rey', 'España'],
  ['esp.copa_de_la_reina', 'Copa de la Reina', 'España'],
  ['esp.super_cup', 'Supercopa de España', 'España'],
  ['eng.1', 'Premier League', 'Inglaterra', true],
  ['eng.2', 'Championship', 'Inglaterra'],
  ['eng.fa', 'FA Cup', 'Inglaterra'],
  ['eng.league_cup', 'Copa de la Liga', 'Inglaterra'],
  ['eng.w.1', 'Women’s Super League', 'Inglaterra'],
  ['ger.1', 'Bundesliga', 'Alemania', true],
  ['ger.2', '2. Bundesliga', 'Alemania'],
  ['ger.dfb_pokal', 'DFB-Pokal', 'Alemania'],
  ['ita.1', 'Serie A', 'Italia', true],
  ['ita.2', 'Serie B', 'Italia'],
  ['ita.coppa_italia', 'Coppa Italia', 'Italia'],
  ['fra.1', 'Ligue 1', 'Francia', true],
  ['fra.2', 'Ligue 2', 'Francia'],
  ['fra.coupe_de_france', 'Coupe de France', 'Francia'],
  ['por.1', 'Primeira Liga', 'Portugal', true],
  ['ned.1', 'Eredivisie', 'Países Bajos', true],
  ['bel.1', 'Pro League', 'Bélgica'],
  ['sco.1', 'Premiership', 'Escocia'],
  ['tur.1', 'Süper Lig', 'Turquía'],
  ['gre.1', 'Super League', 'Grecia'],
  ['sui.1', 'Super League suiza', 'Suiza'],
  ['aut.1', 'Bundesliga austriaca', 'Austria'],
  ['den.1', 'Superliga danesa', 'Dinamarca'],
  ['nor.1', 'Eliteserien', 'Noruega'],
  ['swe.1', 'Allsvenskan', 'Suecia'],
  ['usa.1', 'MLS', 'Estados Unidos'],
  ['usa.nwsl', 'NWSL', 'Estados Unidos'],
  ['mex.1', 'Liga MX', 'México'],
  ['bra.1', 'Brasileirão', 'Brasil'],
  ['arg.1', 'Liga Profesional', 'Argentina'],
  ['col.1', 'Primera A', 'Colombia'],
  ['chi.1', 'Primera División chilena', 'Chile'],
  ['uefa.champions', 'Champions League', 'Europa', true],
  ['uefa.europa', 'Europa League', 'Europa', true],
  ['uefa.europa.conf', 'Conference League', 'Europa', true],
  ['uefa.super_cup', 'Supercopa de Europa', 'Europa'],
  ['uefa.euro', 'Eurocopa', 'Europa'],
  ['fifa.worldq.uefa', 'Clasificación mundialista UEFA', 'Europa'],
  ['uefa.nations', 'UEFA Nations League', 'Europa'],
  ['uefa.wchampions', 'Champions League femenina', 'Europa'],
  ['conmebol.libertadores', 'Copa Libertadores', 'Sudamérica', true],
  ['conmebol.sudamericana', 'Copa Sudamericana', 'Sudamérica'],
  ['conmebol.america', 'Copa América', 'Sudamérica'],
  ['concacaf.gold', 'Copa Oro', 'Norteamérica'],
  ['jpn.1', 'J.League', 'Japón'],
  ['aus.1', 'A-League', 'Australia'],
  ['fifa.world', 'Copa Mundial', 'Internacional'],
  ['fifa.friendly', 'Amistosos de selecciones', 'Internacional'],
] as const;

export const sportsLeagues: SportsLeague[] = [
  ...footballLeagues.map(([id, name, country, featured]) => ({ id, name, country, path: 'soccer/' + id, sport: 'football' as const, featured })),
  { id: 'nba', name: 'NBA', country: 'Estados Unidos', path: 'basketball/nba', sport: 'basketball', featured: true },
  { id: 'wnba', name: 'WNBA', country: 'Estados Unidos', path: 'basketball/wnba', sport: 'basketball', featured: true },
  { id: 'mens-college-basketball', name: 'NCAA masculina', country: 'Estados Unidos', path: 'basketball/mens-college-basketball', sport: 'basketball', featured: true },
  { id: 'womens-college-basketball', name: 'NCAA femenina', country: 'Estados Unidos', path: 'basketball/womens-college-basketball', sport: 'basketball', featured: true },
  { id: 'atp', name: 'ATP', country: 'Internacional', path: 'tennis/atp', sport: 'tennis', featured: true },
  { id: 'wta', name: 'WTA', country: 'Internacional', path: 'tennis/wta', sport: 'tennis', featured: true },
  { id: 'nhl', name: 'NHL', country: 'Estados Unidos', path: 'hockey/nhl', sport: 'hockey', featured: true },
  { id: 'nfl', name: 'NFL', country: 'Estados Unidos', path: 'football/nfl', sport: 'americanFootball', featured: true },
  { id: 'mlb', name: 'MLB', country: 'Estados Unidos', path: 'baseball/mlb', sport: 'baseball', featured: true },
  { id: 'college-football', name: 'NCAA Football', country: 'Estados Unidos', path: 'football/college-football', sport: 'americanFootball', featured: true },
  { id: 'college-baseball', name: 'NCAA Béisbol', country: 'Estados Unidos', path: 'baseball/college-baseball', sport: 'baseball', featured: true },
  { id: 'world-baseball-classic', name: 'Clásico Mundial de Béisbol', country: 'Internacional', path: 'baseball/world-baseball-classic', sport: 'baseball', featured: true },
  { id: 'mens-college-hockey', name: 'NCAA Hockey', country: 'Estados Unidos', path: 'hockey/mens-college-hockey', sport: 'hockey', featured: true },
  { id: 'irl', name: 'IndyCar', country: 'Estados Unidos', path: 'racing/irl', sport: 'motorsport', featured: true },
  { id: 'nascar-premier', name: 'NASCAR Cup Series', country: 'Estados Unidos', path: 'racing/nascar-premier', sport: 'motorsport', featured: true },
  { id: 'f1', name: 'Fórmula 1', country: 'Internacional', path: 'racing/f1', sport: 'motorsport', featured: true },
];

export const spanishFederationDivisions = [
  { id: 'primera_rfef', name: 'Primera Federación', groups: 2, url: 'https://rfef.es/es/competiciones/primera-federacion' },
  { id: 'segunda_rfef', name: 'Segunda Federación', groups: 5, url: 'https://rfef.es/es/competiciones/segunda-federacion' },
  { id: 'tercera_rfef', name: 'Tercera Federación', groups: 18, url: 'https://rfef.es/es/competiciones/tercera-federacion' },
];

export const standingsGroups = [
  { name: 'Las cinco grandes ligas', ids: ['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1'] },
  { name: 'España', ids: ['esp.2', 'esp.w.1'] },
  { name: 'Divisiones federativas', ids: spanishFederationDivisions.map(item => item.id) },
  { name: 'Torneos europeos', ids: ['uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'uefa.wchampions'] },
  { name: 'Otras ligas europeas', ids: ['por.1', 'ned.1', 'eng.2'] },
  { name: 'América', ids: ['conmebol.libertadores', 'conmebol.sudamericana', 'arg.1', 'bra.1', 'mex.1'] },
  { name: 'Selecciones', ids: ['fifa.world'] },
].map(group => ({ name: group.name, leagues: group.ids.flatMap(id => [...sportsLeagues, ...spanishFederationDivisions].filter(league => league.id === id).map(({ id, name }) => ({ id, name }))) }));

export const standingsLeagues = standingsGroups.flatMap(group => group.leagues);

