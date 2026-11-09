import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Flag, Radio, RefreshCw, Search, SlidersHorizontal, Star, Trophy } from 'lucide-react';
import type { Article, SportsMatch, SportsScoreboard, SportsStandingsTable, SportsTeam } from '../lib/types';
import { formatearHora, tiempoRelativo } from '../utils/formatters';
import { shiftSportsDay, sportsDay } from '../utils/sportsDates';
import { loadSportsPreferences, selectedFootballLeagues, SportsFilters, sportsSearchText, storeSportsPreferences } from './SportsFilters';
import { SportsMatchDialog } from './SportsMatchDialog';
import { allFootballLeague, scoreboardSports as sports, sportsLeagues, spanishFederationDivisions, standingsGroups, standingsLeagues, type ScoreboardSport, type SportsLeague } from '../lib/sportsLeagues';
import { SportsDirectory } from './SportsDirectory';
import { useSportsStorage } from './useSportsStorage';
import { SportsTeamPanel, SportsTeams, sportsTeamKey } from './SportsTeams';

interface SportsViewProps {
  initialLive?: boolean;
  news: Article[];
  loading: boolean;
  onSelectArticle: (article: Article) => void;
}

const dayLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const matchStatusFilters = [
  { id: 'all', label: 'Todos' },
  { id: 'LIVE', label: 'En directo' },
  { id: 'SCHEDULED', label: 'Programados' },
  { id: 'FINISHED', label: 'Finalizados' },
] as const;
type SportsDisplay = {
  defaultSport: ScoreboardSport;
  order: 'live' | 'time' | 'recent';
  compact: boolean;
  standings: boolean;
  news: boolean;
};
const defaultDisplay: SportsDisplay = { defaultSport: 'football', order: 'live', compact: false, standings: true, news: true };

function readDisplay(value: unknown): SportsDisplay {
  if (!value || typeof value !== 'object') return defaultDisplay;
  const saved = value as Partial<SportsDisplay>;
  return {
    defaultSport: sports.find(item => item.id === saved.defaultSport)?.id ?? defaultDisplay.defaultSport,
    order: saved.order === 'recent' || saved.order === 'time' ? saved.order : 'live',
    compact: saved.compact === true,
    standings: saved.standings !== false,
    news: saved.news !== false,
  };
}

const sportsSelect = 'min-h-10 w-full min-w-0 rounded-lg border border-slate-700 bg-[#101722] px-2 text-sm text-slate-100';
const matchOrder = { LIVE: 0, SCHEDULED: 1, FINISHED: 2, POSTPONED: 3 };
const leagueIdPattern = /^[a-z0-9][a-z0-9._-]{0,55}$/;
const matchIdentity = (match: SportsMatch) => match.sport === 'football' && match.eventId ? 'football/' + match.eventId : match.id;

function MatchRow({ match, selected, favorite, compact, onOpen, onFavorite }: { match: SportsMatch; selected: boolean; favorite: boolean; compact: boolean; onOpen: () => void; onFavorite: () => void }) {
  const live = match.status === 'LIVE';
  const status = live ? match.minute || 'En directo'
    : match.status === 'FINISHED' ? 'Final'
    : match.status === 'POSTPONED' ? 'Suspendido'
    : formatearHora(match.matchTime, false);
  return (
    <li className={'sports-match-row flex items-center gap-1 pr-2 ' + (compact ? 'sports-match-row--compact ' : '') + (selected ? 'bg-emerald-950/40' : '')}>
      <button type="button" onClick={onOpen} aria-pressed={selected} aria-label={'Abrir ficha de ' + (match.eventName || match.homeTeam + ' - ' + match.awayTeam)} className="grid min-w-0 flex-1 grid-cols-[3.75rem_minmax(0,1fr)_1rem] items-center gap-2 px-2 py-3 text-left hover:bg-emerald-950/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400 sm:px-3">
      <div className={'text-center text-xs font-semibold tabular-nums ' + (live ? 'text-emerald-300' : 'text-slate-400')}>
        {spanishFederationDivisions.some(item => item.id === match.leagueId) && <span className="mb-1 block text-[10px]">{dayLabel.format(new Date(sportsDay(new Date(match.matchTime)) + 'T12:00Z'))}</span>}
        {live && <Radio size={13} className="mx-auto mb-1" />}
        {status}
      </div>
      {match.eventName ? (
        <div className="flex items-center gap-2 border-l border-slate-800 pl-3 text-sm"><Flag size={15} className="shrink-0 text-emerald-300" />{match.eventName}</div>
      ) : (
        <div className="space-y-1.5 border-l border-slate-800 pl-3">
          {[
            { side: 'home', team: match.homeTeam, crest: match.homeCrest, score: match.homeScore },
            { side: 'away', team: match.awayTeam, crest: match.awayCrest, score: match.awayScore },
          ].map(({ side, team, crest, score }) => (
            <div key={side} className="flex min-w-0 items-center gap-2">
              {crest ? <img src={crest} alt="" loading="lazy" className="size-5 shrink-0 object-contain" /> : <span className="size-5 shrink-0" />}
              <span className="min-w-0 flex-1 break-words text-sm text-slate-200">{team}</span>
              {score != null && <span className={'w-7 shrink-0 text-right font-mono text-sm font-bold ' + (live ? 'text-emerald-300' : 'text-slate-100')}>{score}</span>}
            </div>
          ))}
        </div>
      )}
      <ChevronRight size={16} className="text-slate-400" />
      </button>
      <button type="button" aria-label={(favorite ? 'Dejar de seguir ' : 'Seguir ') + (match.eventName || match.homeTeam + ' - ' + match.awayTeam)} aria-pressed={favorite} onClick={onFavorite} className={'rounded p-2 ' + (favorite ? 'text-amber-300' : 'text-slate-500 hover:text-amber-300')}><Star size={15} fill={favorite ? 'currentColor' : 'none'} /></button>
    </li>
  );
}

function FederationLinks({ onSelect }: { onSelect: (id: string) => void }) {
  return <section className="sentinel-card space-y-2 p-4" aria-label="Divisiones federativas de España">
    <h2 className="font-sans text-sm font-semibold">Divisiones federativas de España</h2>
    <p className="text-xs text-slate-400">Elige una división para consultar sus jornadas. El calendario oficial está en la RFEF.</p>
    <div className="flex flex-wrap gap-2">{spanishFederationDivisions.map(item => (
      <div key={item.id} className="inline-flex items-center gap-1"><button type="button" className="sentinel-action" onClick={() => onSelect(item.id)}>{item.name}</button><a href={item.url} target="_blank" rel="noreferrer" className="editorial-icon" aria-label={item.name + " en la RFEF"}><ArrowUpRight size={14} /></a></div>
    ))}</div>
  </section>;
}

function Standings({ initialLeague, expanded = false, onTeam }: { initialLeague: string; expanded?: boolean; onTeam: (team: SportsTeam) => void }) {
  const [league, setLeague] = useSportsStorage('sentinel.sports.standings.v1', initialLeague, value =>
    standingsLeagues.find(item => item.id === value)?.id ?? initialLeague);
  const [snapshot, setSnapshot] = useState<{ league: string; table: SportsStandingsTable | null }>();
  const [group, setGroup] = useState(0);
  const [revision, setRevision] = useState(0);
  const activeLeague = initialLeague !== 'esp.1' && revision === 0 ? initialLeague : league;
  const current = snapshot?.league === activeLeague ? snapshot : undefined;
  const table = current?.table;
  const selectedGroup = table?.groups[group] ?? table?.groups[0];

  function selectLeague(id: string) {
    setGroup(0);
    setLeague(id);
    setRevision(value => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/sports/standings?league=' + activeLeague, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Standings unavailable');
      return response.json();
    }).then((table: SportsStandingsTable) => {
      if (!controller.signal.aborted) setSnapshot({ league: activeLeague, table });
    }).catch(() => {
      if (!controller.signal.aborted) setSnapshot({ league: activeLeague, table: null });
    });
    return () => controller.abort();
  }, [activeLeague, revision]);

  return (
    <section className="sentinel-card min-w-0">
      <div className="space-y-3 border-b border-slate-800 p-4">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold"><Trophy size={17} className="text-emerald-300" /> Clasificación</h2>
        {expanded && <div className="flex flex-wrap gap-2" role="group" aria-label="Las cinco grandes ligas">
          {standingsGroups[0].leagues.map(item => <button key={item.id} type="button" aria-pressed={activeLeague === item.id} onClick={() => selectLeague(item.id)} className={'sentinel-action ' + (activeLeague === item.id ? 'border-emerald-500/60 text-emerald-300' : '')}>{item.name}</button>)}
        </div>}
        <div className={table && table.groups.length > 1 ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
          <select aria-label="Liga de la clasificación" value={activeLeague} onChange={event => selectLeague(event.target.value)} className={sportsSelect}>
            {standingsGroups.map(item => <optgroup key={item.name} label={item.name}>{item.leagues.map(competition => (
              <option key={competition.id} value={competition.id}>{competition.name}</option>
            ))}</optgroup>)}
          </select>
          {table && table.groups.length > 1 && <select aria-label="Grupo de clasificación" value={group} onChange={event => setGroup(Number(event.target.value))} className={sportsSelect}>
            {table.groups.map((item, index) => <option key={index} value={index}>{item.name}</option>)}
          </select>}
        </div>
      </div>
      {table && selectedGroup ? (
        <div className="p-3 sm:p-4">
          <p className="mb-2 text-xs text-slate-400">{table.season}{table.sourceUrl && <> · <a href={table.sourceUrl} target="_blank" rel="noreferrer" className="sentinel-text-link">Datos de AS</a></>}{selectedGroup.name === 'Fase liga' ? ' · Fase liga' : ''}</p>
          <table className="w-full table-auto text-left text-xs sm:text-sm">
            <thead className="text-slate-400"><tr><th scope="col" className="p-1">#</th><th scope="col" className="p-1">Equipo</th><th scope="col" className="p-1 text-right" title="Partidos jugados">PJ</th>{expanded && <th scope="col" className="p-1 text-right" title="Diferencia de goles">DG</th>}<th scope="col" className="p-1 text-right">Pts</th></tr></thead>
            <tbody className="divide-y divide-slate-800/70">
              {selectedGroup.rows.map(row => <tr key={row.team}><td className="p-1.5 text-slate-400">{row.rank}</td><td className="p-1.5 text-slate-200"><span className="flex items-center gap-2">{row.crest && <img src={row.crest} loading="lazy" alt="" className="size-5 shrink-0 object-contain" />}{row.teamId ? <button type="button" onClick={() => onTeam({ id: row.teamId!, name: row.team, crest: row.crest, leagueId: activeLeague })} className="text-left hover:text-emerald-300 hover:underline">{row.team}</button> : row.team}</span></td><td className="p-1.5 text-right text-slate-400">{row.played}</td>{expanded && <td className="p-1.5 text-right text-slate-400">{row.goalDiff > 0 ? '+' : ''}{row.goalDiff}</td>}<td className="p-1.5 text-right font-semibold text-emerald-300">{row.points}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <div className="flex flex-wrap items-center gap-3 p-4 text-sm text-slate-400" role="status">
        {current ? 'Clasificación temporalmente no disponible.' : 'Cargando clasificación…'}
        {current && <button type="button" className="sentinel-action" onClick={() => { setSnapshot(undefined); setRevision(value => value + 1); }}>Reintentar</button>}
      </div>}
    </section>
  );
}

export function SportsView({ news, loading, onSelectArticle, initialLive = false }: SportsViewProps) {
  const [day, setDay] = useState(sportsDay);
  const [display, setDisplay] = useSportsStorage('sentinel.sports.display.v1', defaultDisplay, readDisplay);
  const [sport, setSport] = useState<ScoreboardSport>(display.defaultSport);
  const [liveSport, setLiveSport] = useState<ScoreboardSport | 'all'>('all');
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<typeof matchStatusFilters[number]['id']>('all');
  const [snapshot, setSnapshot] = useState<{ key: string; board: (SportsScoreboard & { round?: number; totalRounds?: number }) | null; failed: boolean }>();
  const [round, setRound] = useState<number>();
  const [roundGroup, setRoundGroup] = useState('');
  const [roundLimit, setRoundLimit] = useState(0);
  const [matchSearch, setMatchSearch] = useState('');
  const [preferences, setPreferences] = useState(loadSportsPreferences);
  const [quickScope, setQuickScope] = useState<string | null>(null);
  const [section, setSection] = useState<'calendar' | 'live' | 'directory' | 'teams' | 'following' | 'standings'>(initialLive ? 'live' : 'calendar');
  const [catalog, setCatalog] = useState<SportsLeague[]>(sportsLeagues);
  const [focusedLeague, setFocusedLeague] = useState<string | null>(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const [pinned, setPinned] = useSportsStorage<string[]>('sentinel.sports.pinned.v1', [], value =>
    Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && leagueIdPattern.test(id)))].slice(0, 250) : []);
  const [following, setFollowing] = useSportsStorage<SportsMatch[]>('sentinel.sports.following.v1', [], value =>
    Array.isArray(value) ? value.filter(match => match && typeof match.id === 'string' && typeof match.homeTeam === 'string'
      && Number.isFinite(Date.parse(match.matchTime)) && leagueIdPattern.test(match.leagueId ?? '') && sports.some(item => item.id === match.sport)).slice(0, 100) : []);
  const [favoriteTeams, setFavoriteTeams] = useSportsStorage<SportsTeam[]>('sentinel.sports.teams.v1', [], value =>
    Array.isArray(value) ? value.filter(team => team && /^(?:\d{1,12}|as-[a-f0-9]{16})$/.test(team.id) && typeof team.name === 'string'
      && typeof team.leagueId === 'string' && leagueIdPattern.test(team.leagueId)).slice(0, 100) : []);
  const [openedTeam, setOpenedTeam] = useState<SportsTeam | null>(null);
  const today = sportsDay();
  const [openedMatch, setOpenedMatch] = useState<SportsMatch | null>(null);
  const quickPreferences = quickScope === 'all' || quickScope === 'España' || quickScope === 'favorites' || preferences.favorites.includes(quickScope ?? '')
    ? { ...preferences, scope: quickScope!, leagues: null } : preferences;
  const isLive = section === 'live';
  const isStandings = section === 'standings';
  const showBoard = isLive || section === 'calendar' || section === 'directory';
  const sportLeagues = catalog.filter(league => league.sport === sport).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const pinnedLeagues = sportLeagues.filter(league => pinned.includes(league.id));
  const selection = focusedLeague ?? (sport !== 'football' ? undefined : quickPreferences.scope === 'all' && quickPreferences.leagues === null
    ? allFootballLeague.id : selectedFootballLeagues(quickPreferences, catalog).join(','));
  const division = spanishFederationDivisions.find(item => item.id === focusedLeague);
  const queryKey = isLive ? 'live' : division ? [division.id, round].join('/') : [day, sport, selection].join('/');
  const board = snapshot?.key === queryKey ? snapshot.board : null;
  const failed = snapshot?.key === queryKey && snapshot.failed;
  const currentMatch = openedMatch && (board?.matches.find(match => match.id === openedMatch.id) ?? openedMatch);
  const standingsLeague = standingsLeagues.find(league => league.id === focusedLeague)?.id ?? 'esp.1';

  useEffect(() => { storeSportsPreferences(preferences); }, [preferences]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/sports/competitions', { signal: controller.signal }).then(response => response.ok ? response.json() : sportsLeagues)
      .then(data => { if (!controller.signal.aborted && Array.isArray(data)) setCatalog(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const resize = () => setWide(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  function toggleFollowing(match: SportsMatch) {
    setFollowing(previous => previous.some(item => matchIdentity(item) === matchIdentity(match))
      ? previous.filter(item => matchIdentity(item) !== matchIdentity(match)) : [match, ...previous].slice(0, 100));
  }

  function toggleTeam(team: SportsTeam) {
    const key = sportsTeamKey(team);
    setFavoriteTeams(previous => previous.some(item => sportsTeamKey(item) === key)
      ? previous.filter(item => sportsTeamKey(item) !== key)
      : [team, ...previous].slice(0, 100));
  }

  function openTeam(team: SportsTeam) {
    setOpenedMatch(null);
    setOpenedTeam(team);
  }

  function openMatch(match: SportsMatch) {
    setOpenedTeam(null);
    setOpenedMatch(match);
  }

  function selectLeague(id: string | null) {
    setFocusedLeague(id);
    setRound(undefined);
    setRoundGroup('');
    setRoundLimit(0);
    setSection('calendar');
    setStatus('all');
    setMatchSearch('');
  }

  useEffect(() => {
    if (!showBoard || (!isLive && selection === '')) return;
    const controller = new AbortController();
    let updating = false;
    async function refresh() {
      if (updating) return;
      updating = true;
      try {
        async function fetchBoard(url: string): Promise<SportsScoreboard & { round?: number; totalRounds?: number }> {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Scoreboard unavailable');
          return response.json();
        }

        let result: SportsScoreboard & { round?: number; totalRounds?: number };
        if (isLive) {
          result = await fetchBoard('/api/sports/live');
        } else if (division) {
          const params = new URLSearchParams({ league: division.id });
          if (round) params.set('round', String(round));
          result = await fetchBoard('/api/sports/federation?' + params);
          if (!controller.signal.aborted && result.totalRounds) setRoundLimit(result.totalRounds);
        } else {
          const query = new URLSearchParams({ date: day, sport });
          const ids = selection?.split(',') ?? [];
          const batches = [];
          for (let index = 0; index < ids.length; index += 14) batches.push(ids.slice(index, index + 14).join(','));
          result = { matches: [], unavailable: [], updatedAt: null };
          for (const batch of batches.length ? batches : ['']) {
            if (batch) query.set('leagues', batch);
            const board = await fetchBoard('/api/sports/scoreboard?' + query);
            result.matches.push(...board.matches);
            result.unavailable.push(...board.unavailable);
            if (board.updatedAt && (!result.updatedAt || board.updatedAt > result.updatedAt)) result.updatedAt = board.updatedAt;
          }
          result.matches = [...new Map(result.matches.map(match => [matchIdentity(match), match])).values()];
        }
        if (!controller.signal.aborted) {
          setSnapshot({ key: queryKey, board: result, failed: false });
        }
      } catch {
        if (!controller.signal.aborted) {
          setSnapshot(previous => ({ key: queryKey, board: previous?.key === queryKey ? previous.board : null, failed: true }));
        }
      } finally {
        updating = false;
      }
    }
    void refresh();
    const refreshWhileVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(refreshWhileVisible, isLive || day === sportsDay() ? 30000 : 120000);
    document.addEventListener('visibilitychange', refreshWhileVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, [day, sport, selection, queryKey, isLive, showBoard, revision, division, round]);

  const searchText = sportsSearchText(matchSearch);
  const roundGroups = [...new Set((board?.matches ?? []).flatMap(match => match.tournament ?? []))];
  const searched = (board?.matches ?? []).filter(match => (isLive || !division || !roundGroup || match.tournament === roundGroup) && (!isLive || liveSport === 'all' || match.sport === liveSport) && (!failed || match.status !== 'LIVE') && sportsSearchText(
    [match.homeTeam, match.awayTeam, match.competition, match.eventName].filter(Boolean).join(' ')
  ).includes(searchText));
  const visible = searched.filter(match => status === 'all' || status === match.status)
        .sort((a, b) => {
      const byTime = a.matchTime.localeCompare(b.matchTime);
      if (display.order === 'recent') return -byTime;
      if (display.order === 'time') return byTime;
      return matchOrder[a.status] - matchOrder[b.status] || byTime;
    });
  const competitions = new Map<string, SportsMatch[]>();
  for (const match of visible) {
    const key = [match.sport, match.leagueId, match.providerCompetitionId ?? match.competition, match.tournament].join('/');
    const group = competitions.get(key);
    if (group) group.push(match);
    else competitions.set(key, [match]);
  }
  const changeDay = (date: string) => {
    setDay(date);
    setStatus('all');
  };

  const canBrowseTeams = sport !== 'tennis' && sport !== 'motorsport';
  const detail = currentMatch ? (
    <SportsMatchDialog key={currentMatch.id} match={currentMatch} inline={wide} onTeam={openTeam} onClose={() => setOpenedMatch(null)} />
  ) : null;

  return (
    <div className="mx-auto max-w-[1750px] space-y-4 px-3 py-6 sm:px-5 lg:px-7 lg:py-8">
      <header className="editorial-hero football-hero flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-8">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[.2em] text-emerald-400">Centro deportivo</p>
          <h1 className="font-sans text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">Marcadores</h1>
          <p className="mt-2 text-sm text-emerald-50/75">Calendario, resultados y directos de {sports.length} deportes.</p>
        </div>
        {showBoard && <div className="relative flex flex-wrap items-center gap-3">
          {board?.updatedAt && <p className="text-xs text-emerald-50/75">{division && !isLive ? 'AS' : 'ESPN'} · {failed || board.unavailable.length ? 'Última consulta útil' : 'Actualizado'} {formatearHora(board.updatedAt, false)}</p>}
          <button type="button" className="sentinel-action" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /> Actualizar marcadores</button>
        </div>}
      </header>
      {!isStandings && <div className="sentinel-card grid gap-3 p-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">
          {isLive ? 'Deporte en directo' : 'Deporte'}
          {isLive ? <select className={sportsSelect} value={liveSport} onChange={event => setLiveSport(event.target.value as ScoreboardSport | 'all')}>
            <option value="all">Todos los deportes</option>
            {sports.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select> : <select className={sportsSelect} value={sport} onChange={event => {
            setSport(event.target.value as ScoreboardSport);
            selectLeague(null);
            setOpenedMatch(null);
            setOpenedTeam(null);
          }}>
            {sports.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>}
        </label>
        {!isLive && <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">
          Competición
          <select className={sportsSelect} value={focusedLeague ?? ''} onChange={event => selectLeague(event.target.value || null)}>
            <option value="">Mi calendario</option>{sport === "football" && <optgroup label="Divisiones federativas de España">{spanishFederationDivisions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
            {pinnedLeagues.length > 0 && <optgroup label="Fijadas">{pinnedLeagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</optgroup>}
            <optgroup label="Competiciones disponibles">{sportLeagues.filter(league => !pinned.includes(league.id)).map(league => <option key={league.id} value={league.id}>{league.name} · {league.country}</option>)}</optgroup>
          </select>
        </label>}
      </div>}
      <details className="sentinel-card group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold hover:text-emerald-300">
          <SlidersHorizontal size={16} className="text-emerald-400" /> Personalizar vista
          <ChevronRight size={16} className="ml-auto text-slate-400 group-open:rotate-90" />
        </summary>
        <div className="space-y-4 border-t border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Deporte al abrir
              <select className={sportsSelect} value={display.defaultSport} onChange={event => setDisplay({ ...display, defaultSport: event.target.value as ScoreboardSport })}>
                {sports.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Orden de partidos
              <select className={sportsSelect} value={display.order} onChange={event => setDisplay({ ...display, order: event.target.value as SportsDisplay['order'] })}>
                <option value="live">En directo primero</option>
                <option value="time">Hora más temprana primero</option>
                <option value="recent">Hora más tardía primero</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            {([['compact', 'Vista compacta'], ['standings', 'Mostrar clasificación'], ['news', 'Mostrar noticias']] as const).map(([id, label]) => (
              <label key={id} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={display[id]} onChange={event => setDisplay({ ...display, [id]: event.target.checked })} className="accent-emerald-500" />{label}</label>
            ))}
            <button type="button" className="sentinel-text-link sm:ml-auto" onClick={() => setDisplay(defaultDisplay)}>Restablecer vista</button>
          </div>
          <p className="text-xs text-slate-400">Tus preferencias se guardan en este navegador.</p>
        </div>
      </details>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vistas deportivas">
        {([['calendar', 'Partidos'], ['live', 'En directo ahora'], ['directory', 'Competiciones'], ['standings', 'Clasificaciones'], ['teams', 'Equipos'], ['following', 'Siguiendo']] as const).filter(([id]) => id !== 'teams' || canBrowseTeams).map(([id, label]) => <button type="button" key={id} onClick={() => { setSection(id); if (id === 'live') { setStatus('all'); setMatchSearch(''); } }} aria-pressed={section === id} className={'sentinel-action ' + (section === id ? 'border-emerald-500/60 text-emerald-300' : '')}>{id === 'live' && <Radio size={15} className="text-emerald-400" />}{label}{id === 'following' && following.length + favoriteTeams.length > 0 ? ' · ' + (following.length + favoriteTeams.length) : ''}</button>)}
      </div>
      {sport === 'football' && section === 'calendar' && !focusedLeague && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Accesos rápidos de países">
            {[{ id: null, label: 'Mi selección' }, { id: 'all', label: 'Todas las competiciones' }, { id: 'España', label: 'España' }, ...(preferences.favorites.length ? [{ id: 'favorites', label: 'Mis favoritos' }] : []), ...preferences.favorites.filter(country => country !== 'España').map(country => ({ id: country, label: country }))].map(({ id, label }) => (
              <button type="button" key={label} aria-pressed={quickScope === id} onClick={() => setQuickScope(id)} className={'sentinel-action ' + (quickScope === id ? 'border-emerald-500/60 text-emerald-300' : '')}>
                {id === 'favorites' && <Star size={14} />} {label}
              </button>
            ))}
          </div>
          <SportsFilters catalog={catalog} preferences={preferences} onChange={next => { setQuickScope(null); setPreferences(next); }} />
        </div>
      )}

            {sport === 'football' && (section === 'directory' || (section === 'calendar' && (quickScope ?? preferences.scope) === 'España')) && <FederationLinks onSelect={id => { setSport("football"); selectLeague(id); }} />}
      {isStandings ? <div className="mx-auto max-w-5xl space-y-4"><Standings key={standingsLeague} initialLeague={standingsLeague} onTeam={openTeam} expanded /><FederationLinks onSelect={id => { setSport("football"); selectLeague(id); }} /></div> : <div className={'grid items-start gap-4 ' + (display.news || (display.standings && sport === 'football') || detail ? 'xl:grid-cols-[12rem_minmax(0,1fr)_minmax(18rem,0.8fr)]' : 'xl:grid-cols-[12rem_minmax(0,1fr)]')}>
        <div className={section === 'directory' ? 'block' : 'hidden xl:block'}>
          <SportsDirectory key={sport} sport={sport} catalog={catalog} selected={focusedLeague} pinned={pinned} onSelect={selectLeague} onPin={id => setPinned(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id])} />
        </div>
        {section === 'teams' && canBrowseTeams && <SportsTeams key={sport} sport={sport} preferred={focusedLeague} favorites={favoriteTeams} onOpen={openTeam} onToggle={toggleTeam} />}
        {section === 'following' && <div className="space-y-4"><section aria-label="Equipos seguidos" className="sentinel-card">
          <h2 className="border-b border-slate-800 p-4 font-sans text-base font-semibold">Equipos seguidos</h2>
          {!favoriteTeams.length && <p className="p-4 text-sm text-slate-400">Añade un equipo desde su ficha o el directorio.</p>}
          <ul className="divide-y divide-slate-800">{favoriteTeams.map(team => <li key={sportsTeamKey(team)} className="flex items-center gap-2 p-3">
            <button type="button" onClick={() => openTeam(team)} className="min-w-0 flex-1 text-left text-sm hover:text-emerald-300">{team.name}</button>
            <button type="button" className="sentinel-action text-amber-300" aria-label={'Dejar de seguir equipo ' + team.name} onClick={() => toggleTeam(team)}><Star size={15} fill="currentColor" /></button>
          </li>)}</ul>
        </section><section aria-label="Partidos seguidos" className="sentinel-card">
          <h2 className="border-b border-slate-800 p-4 font-sans text-base font-semibold">Partidos seguidos</h2>
          {!following.length && <p className="p-4 text-sm text-slate-400">Pulsa la estrella de un encuentro para guardarlo aquí.</p>}
          <ul className="divide-y divide-slate-800">{following.map(match => <li key={match.id} className="flex items-center gap-2 p-3">
            <button type="button" className="min-w-0 flex-1 text-left text-sm hover:text-emerald-300" onClick={() => {
              setSport(match.sport);
              selectLeague(match.leagueId ?? null);
              const savedRound = match.sourceUrl?.match(/\/jornada\/grupos_a_(\d+)\//)?.[1];
              if (savedRound) setRound(Number(savedRound));
              changeDay(sportsDay(new Date(match.matchTime)));
              openMatch({ ...match, homeScore: undefined, awayScore: undefined, minute: undefined, periods: undefined });
            }}>
              <span className="block">{match.eventName || match.homeTeam + ' – ' + match.awayTeam}</span>
              <span className="text-xs text-slate-400">{match.competition} · {dayLabel.format(new Date(match.matchTime))}</span>
            </button>
            <button type="button" className="sentinel-action text-amber-300" aria-label={'Dejar de seguir ' + match.homeTeam} onClick={() => toggleFollowing(match)}><Star size={15} fill="currentColor" /></button>
          </li>)}</ul>
        </section></div>}
        <section className={section === 'following' || section === 'teams' ? 'hidden' : section === 'directory' ? 'hidden min-w-0 space-y-3 xl:block' : 'min-w-0 space-y-3'} aria-label="Partidos y sesiones">
          {!isLive && focusedLeague && <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-3"><span className="text-sm font-semibold text-emerald-300">{division?.name ?? catalog.find(league => league.id === focusedLeague)?.name ?? focusedLeague}</span><button type="button" className="sentinel-text-link" onClick={() => selectLeague(null)}>Volver a mi calendario</button></div>}
          {isLive && <div className="sentinel-card p-4"><h2 className="font-sans text-base font-semibold">{liveSport === 'all' ? 'Todos los directos' : 'En directo · ' + sports.find(item => item.id === liveSport)?.label}</h2><p className="mt-1 text-xs text-slate-400">Actualización automática cada 30 segundos mientras la pestaña está visible.</p></div>}
          {!isLive && division && <div className="sentinel-card space-y-2 p-3">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Jornada de {division.name}
              <select className={sportsSelect} value={round ?? board?.round ?? ''} onChange={event => setRound(Number(event.target.value))}>
                {!board?.round && !round && <option value="" disabled>Consultando jornada…</option>}
                {Array.from({ length: roundLimit }, (_, index) => index + 1).map(value => <option key={value} value={value}>Jornada {value}</option>)}
              </select>
            </label>
            {roundGroups.length > 1 && <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Grupo de la jornada
              <select className={sportsSelect} value={roundGroup} onChange={event => setRoundGroup(event.target.value)}>
                <option value="">Todos los grupos</option>
                {roundGroups.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>}
            <p className="text-xs text-slate-400">Calendario y resultados por jornada publicados por AS.</p>
          </div>}
          {!isLive && !division && <div className="sentinel-card p-2 sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" disabled={day <= '2000-01-01'} onClick={() => changeDay(shiftSportsDay(day, -1))} className="sentinel-action" aria-label="Día anterior"><ChevronLeft size={16} /></button>
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays size={16} className="hidden shrink-0 text-emerald-400 sm:block" />
                <input type="date" min="2000-01-01" max="2099-12-31" aria-label="Fecha de los partidos" value={day} onChange={event => { if (event.currentTarget.value && event.currentTarget.validity.valid) changeDay(event.currentTarget.value); }} className="min-w-0 rounded bg-[#101722] p-1.5 text-xs text-slate-100 scheme-dark" />
              </div>
              <button type="button" disabled={day >= '2099-12-31'} onClick={() => changeDay(shiftSportsDay(day, 1))} className="sentinel-action" aria-label="Día siguiente"><ChevronRight size={16} /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-800 pt-2">
              <button type="button" className="sentinel-action" aria-pressed={day === today} onClick={() => changeDay(today)}>Hoy</button>
              {[-1, 1, 2, 3].map(offset => {
                const date = shiftSportsDay(today, offset);
                return <button key={date} type="button" className="sentinel-action" aria-pressed={day === date} onClick={() => changeDay(date)}>{dayLabel.format(new Date(date + 'T12:00Z'))}</button>;
              })}
            </div>
          </div>}

          <div className="sentinel-card space-y-3 p-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101722] px-3 focus-within:border-emerald-500/60">
              <Search size={15} className="text-slate-400" />
              <input type="search" aria-label="Buscar equipo o competición en esta fecha" placeholder="Buscar equipo o competición" value={matchSearch} onChange={event => setMatchSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
            </label>
            {!isLive && <div className="flex flex-wrap gap-2" role="group" aria-label="Estado de los partidos">
              {matchStatusFilters.map(({ id, label }) => (
                <button type="button" key={id} aria-pressed={status === id} onClick={() => setStatus(id)} className={'sentinel-action ' + (status === id ? 'border-emerald-500/60 text-emerald-300' : '')}>
                  {id === 'LIVE' && <Radio size={14} />} {label} <span className="font-mono text-slate-400">{id === 'all' ? searched.length : searched.filter(match => match.status === id).length}</span>
                </button>
              ))}
            </div>}
          </div>

          {failed && <p role="status" className="sentinel-card p-4 text-sm text-amber-200">No se pudo actualizar el marcador. Se volverá a intentar automáticamente.</p>}
          {!!board?.unavailable.length && <p role="status" className="sentinel-card p-4 text-sm text-amber-200">Sin actualización de {board.unavailable.join(', ')}.</p>}
          {!isLive && selection === '' && <p className="sentinel-card p-5 text-sm text-slate-400">Selecciona una competición o añade un país a tus favoritos.</p>}
          {(isLive || selection !== '') && !board && !failed && <p role="status" className="sentinel-card p-5 text-sm text-slate-400">Consultando marcadores…</p>}
          {!!board?.updatedAt && <p className="px-1 text-xs text-slate-400" aria-live="polite">{visible.length} {visible.length === 1 ? 'evento' : 'eventos'} · {competitions.size} {competitions.size === 1 ? 'grupo' : 'grupos'}</p>}
          {!!board?.updatedAt && !failed && !visible.length && <p className="sentinel-card p-5 text-sm text-slate-400">{searchText || status !== 'all' || (division && roundGroup) ? 'No hay partidos que coincidan con estos filtros.' : isLive ? 'ESPN no informa de encuentros en directo en este momento.' : 'No hay eventos registrados para esta fecha.'}</p>}

          {Array.from(competitions, ([key, matches]) => (
            <section key={key} className="sentinel-card">
              <h2 className="flex items-center gap-2 border-b border-slate-800 bg-[#0D121D] px-3 py-3 font-sans text-sm font-semibold"><Trophy size={15} className="shrink-0 text-emerald-400" />{matches[0].tournament || matches[0].competition}<span className="text-xs font-normal text-slate-400">{isLive ? sports.find(item => item.id === matches[0].sport)?.label : matches[0].tournament ? matches[0].competition : catalog.find(league => league.id === matches[0].leagueId)?.country}</span><span className="ml-auto font-mono text-xs text-slate-400">{matches.length}</span></h2>
              <ul className="divide-y divide-slate-800/70">{matches.map(match => <MatchRow key={match.id} match={match} selected={openedMatch?.id === match.id} favorite={following.some(item => matchIdentity(item) === matchIdentity(match))} compact={display.compact} onOpen={() => openMatch(match)} onFavorite={() => toggleFollowing(match)} />)}</ul>
            </section>
          ))}
        </section>

        {(display.news || (display.standings && sport === "football") || (wide && detail)) && <aside className="min-w-0 space-y-4">
          {wide && detail}
          {display.standings && sport === 'football' && <Standings key={standingsLeague} initialLeague={standingsLeague} onTeam={openTeam} />}
          {display.news && <section className="sentinel-card p-4">
            <h2 className="font-sans text-base font-semibold">Actualidad deportiva</h2>
            {news.length ? <ul className="mt-2 divide-y divide-slate-800/70">
              {news.slice(0, 5).map(article => <li key={article.id}><button type="button" onClick={() => onSelectArticle(article)} className="w-full py-3 text-left text-sm text-slate-200 hover:text-emerald-300"><span className="block text-xs text-slate-400">{article.source} · {tiempoRelativo(article.publishedAt)}</span><span className="mt-1 block">{article.title}</span></button></li>)}
            </ul> : <p className="mt-2 text-sm text-slate-400">{loading ? 'Cargando noticias…' : 'No hay noticias deportivas disponibles.'}</p>}
          </section>}
        </aside>}
      </div>}
      {!wide && detail}
      {openedTeam && <SportsTeamPanel key={openedTeam.leagueId + '/' + openedTeam.id} team={openedTeam} inline={false}
        favorite={favoriteTeams.some(team => sportsTeamKey(team) === sportsTeamKey(openedTeam))}
        onToggle={() => toggleTeam(openedTeam)} onClose={() => setOpenedTeam(null)} onMatch={openMatch} />}
    </div>
  );
}
