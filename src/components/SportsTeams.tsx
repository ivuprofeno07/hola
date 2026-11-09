import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, Search, Star, X } from 'lucide-react';
import type { SportsClubDetails, SportsMatch, SportsTeam, SportsTeamProfile } from '../lib/types';
import { sportsLeagues, spanishFederationDivisions, type ScoreboardSport } from '../lib/sportsLeagues';
import { formatearFechaCompleta } from '../utils/formatters';
import { sportsSearchText } from './SportsFilters';
import { ClubOverview, ClubSquad, ClubTransfers, ClubTrophies } from './SportsClubSections';

export function sportsTeamKey(team: SportsTeam) {
  return (sportsLeagues.find(league => league.id === team.leagueId)?.sport ?? 'football') + '/' + team.id;
}

async function getData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/sports/' + path, { signal });
  if (!response.ok) throw new Error('Sports team data unavailable');
  return response.json();
}

function Crest({ team }: { team: SportsTeam }) {
  return team.crest ? <img src={team.crest} alt="" className="size-7 shrink-0 object-contain" /> : null;
}

export function SportsTeams({ sport, preferred, favorites, onOpen, onToggle }: {
  sport: ScoreboardSport; preferred: string | null; favorites: SportsTeam[];
  onOpen: (team: SportsTeam) => void; onToggle: (team: SportsTeam) => void;
}) {
  const leagues = [...sportsLeagues.filter(league => league.sport === sport), ...(sport === 'football' ? spanishFederationDivisions : [])];
  const [league, setLeague] = useState(leagues.some(item => item.id === preferred) ? preferred! : leagues[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ league: string; teams?: SportsTeam[] }>();
  useEffect(() => {
    if (!league) return;
    const controller = new AbortController();
    void getData<SportsTeam[]>('teams?' + new URLSearchParams({ league }), controller.signal)
      .then(teams => { if (!controller.signal.aborted) setResult({ league, teams }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ league }); });
    return () => controller.abort();
  }, [league]);

  const current = result?.league === league ? result : undefined;
  const teams = current?.teams?.filter(team => sportsSearchText(team.name).includes(sportsSearchText(query)));
  return (
    <section className="sentinel-card min-w-0" aria-label="Directorio de equipos">
      <div className="space-y-3 border-b border-slate-800 p-4">
        <h2 className="font-sans text-base font-semibold">Equipos</h2>
        <label className="block text-xs text-slate-300">Competición de equipos
          <select className="mt-1 w-full rounded border border-slate-700 bg-[#101722] p-2 text-sm" value={league} onChange={event => setLeague(event.target.value)}>{leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-[#101722] px-3"><Search size={15} className="text-emerald-400" /><input type="search" aria-label="Buscar equipo" placeholder="Buscar equipo" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></label>
      </div>
      {!teams?.length && <p role="status" className="p-4 text-sm text-slate-400">{!current ? 'Consultando equipos…' : !current.teams ? 'El proveedor no ofrece el directorio de esta competición.' : 'No hay equipos que coincidan.'}</p>}
      <ul className="divide-y divide-slate-800">{teams?.map(team => {
        const favorite = favorites.some(item => sportsTeamKey(item) === sportsTeamKey(team));
        return <li key={team.id} className="flex items-center gap-2 px-3 py-2">
          <button type="button" onClick={() => onOpen(team)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:text-emerald-300"><Crest team={team} /><span className="flex-1">{team.name}</span><ChevronRight size={15} /></button>
          <button type="button" onClick={() => onToggle(team)} aria-label={(favorite ? 'Dejar de seguir equipo ' : 'Seguir equipo ') + team.name} aria-pressed={favorite} className="sentinel-action text-amber-300"><Star size={15} fill={favorite ? 'currentColor' : 'none'} /></button>
        </li>;
      })}</ul>
    </section>
  );
}

const tabs = ['Resumen', 'Plantilla', 'Palmarés', 'Altas y bajas', 'Partidos'] as const;
export function SportsTeamPanel({ team, inline, favorite, onToggle, onClose, onMatch }: {
  team: SportsTeam; inline: boolean; favorite: boolean; onToggle: () => void; onClose: () => void; onMatch: (match: SportsMatch) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<typeof tabs[number]>('Resumen');
  const [profile, setProfile] = useState<SportsTeamProfile>();
  const [failed, setFailed] = useState(false);
  const [club, setClub] = useState<SportsClubDetails | null>();
  const football = sportsLeagues.find(item => item.id === team.leagueId)?.sport === 'football'
    || !sportsLeagues.some(item => item.id === team.leagueId);
  const clubName = (name: string) => sportsSearchText(name).replace(/[^a-z0-9]/g, '');
  const clubPlayers = new Map(club?.players.map(player => [clubName(player.name), player]));
  const players = profile?.players.length ? profile.players.map(player => ({ ...clubPlayers.get(clubName(player.name)), ...player })) : club?.players ?? [];
  useEffect(() => {
    const element = dialog.current;
    if (!inline) element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, [inline]);

  useEffect(() => {
    const controller = new AbortController();
    void getData<SportsTeamProfile>('team?' + new URLSearchParams({ league: team.leagueId, team: team.id }), controller.signal)
      .then(data => { if (!controller.signal.aborted) setProfile(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [team.id, team.leagueId]);

  useEffect(() => {
    if (!football || !profile) return;
    const controller = new AbortController();
    void getData<SportsClubDetails | null>('club?' + new URLSearchParams({ league: team.leagueId, team: team.id }), controller.signal)
      .then(data => { if (!controller.signal.aborted) setClub(data); })
      .catch(() => { if (!controller.signal.aborted) setClub(null); });
    return () => controller.abort();
  }, [football, profile, team.id, team.leagueId]);

  const shownTeam = profile?.team ?? team;
  const form = (profile?.recent ?? []).filter(match => match.homeScore != null && match.awayScore != null).slice(0, 5).reverse().map(match => {
    const diff = (match.homeScore! - match.awayScore!) * (match.homeTeamId === team.id ? 1 : -1);
    return { id: match.id, mark: diff > 0 ? 'V' : diff < 0 ? 'D' : 'E', label: diff > 0 ? 'Victoria' : diff < 0 ? 'Derrota' : 'Empate' };
  });

  const content = <>
    <header className="flex items-center gap-3 border-b border-slate-800 bg-[#14251f] p-4 sm:p-6">
      <Crest team={shownTeam} /><div className="min-w-0 flex-1"><p className="editorial-kicker">Ficha de equipo</p><h2 id="sports-team-title" className="font-sans text-xl font-bold sm:text-2xl">{shownTeam.name}</h2></div>
      <button type="button" className="sentinel-action text-amber-300" onClick={onToggle} aria-label={favorite ? 'Dejar de seguir este equipo' : 'Seguir este equipo'} aria-pressed={favorite}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
      <button type="button" className="sentinel-action" autoFocus={!inline} aria-label="Cerrar ficha de equipo" onClick={onClose}><X size={16} /></button>
    </header>
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Secciones del equipo">{tabs.filter(label => football || (label !== "Palmarés" && label !== "Altas y bajas")).map(label => <button key={label} type="button" className={"sentinel-action " + (tab === label ? "border-emerald-500/60 text-emerald-300" : "")} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}</div>
      {failed && <p role="status" className="text-sm text-amber-200">No se pudo consultar la ficha del equipo.</p>}
      {!profile && !failed && <p role="status" className="text-sm text-slate-400">Consultando ficha…</p>}
      {!!profile?.unavailable.length && <p className="text-xs text-amber-200">Sin datos de {profile.unavailable.join(', ')}.</p>}
      {profile && tab === 'Resumen' && <>
        {club && <ClubOverview club={club} />}
        {football && club === undefined && <p role="status" className="text-sm text-slate-400">Consultando datos del club…</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Plantilla', players.length], ['Palmarés', club?.trophies.reduce((sum, item) => sum + item.titles, 0)], ['Altas y bajas', club?.transfers.length], ['Partidos', profile.recent.length + profile.upcoming.length]] as const)
            .filter(([label]) => football || (label !== 'Palmarés' && label !== 'Altas y bajas')).map(([label, value]) => (
            <button type="button" key={label} onClick={() => setTab(label)} className="sentinel-card min-w-0 p-3 text-left">
              <span className="block text-xl font-bold text-emerald-200">{value ?? '—'}</span><span className="text-xs text-slate-300">{label}</span>
            </button>
          ))}
        </div>
      </>}
      {profile && tab === 'Partidos' && <>
        {!!form.length && <div><h3 className="mb-2 font-sans text-xs text-slate-300">Últimos resultados, del más antiguo al más reciente</h3><ul className="flex gap-2">{form.map(result => <li key={result.id} title={result.label} aria-label={result.label} className={'grid size-7 place-items-center rounded text-xs font-semibold ' + (result.mark === 'V' ? 'bg-emerald-950 text-emerald-300' : result.mark === 'D' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-200')}>{result.mark}</li>)}</ul></div>}
        {([['Próximos partidos', profile.upcoming], ['Resultados recientes', profile.recent]] as const).map(([title, matches]) => <section key={title}>
          <h3 className="border-b border-slate-800 pb-2 font-sans text-sm font-semibold">{title}</h3>
          {!matches.length && <p className="py-2 text-xs text-slate-400">El proveedor no devolvió partidos en esta lista.</p>}
          <ul className="divide-y divide-slate-800">{matches.map(match => <li key={match.id}><button type="button" onClick={() => onMatch(match)} className="flex w-full items-center justify-between gap-2 py-2 text-left hover:text-emerald-300">
            <span className="min-w-0"><span className="block text-xs text-slate-400">{match.competition} · {formatearFechaCompleta(match.matchTime)}</span><span className="block text-sm">{match.homeTeam} – {match.awayTeam}</span></span>
            <span className="shrink-0 font-mono text-xs text-emerald-300">{match.homeScore != null && match.awayScore != null ? match.homeScore + '–' + match.awayScore : '›'}</span>
          </button></li>)}</ul>
        </section>)}
      </>}
      {profile && tab === 'Plantilla' && (players.length || club !== undefined || !football ? <ClubSquad players={players} /> : <p role="status" className="text-sm text-slate-400">Consultando plantilla…</p>)}
      {profile && (tab === 'Palmarés' || tab === 'Altas y bajas') && (club
        ? tab === 'Palmarés' ? <ClubTrophies club={club} /> : <ClubTransfers club={club} />
        : <p role="status" className="text-sm text-slate-400">{club === null ? 'No hay cobertura verificada de esta sección para el equipo.' : 'Consultando datos del club…'}</p>)}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-400">Partidos: {spanishFederationDivisions.some(item => item.id === team.leagueId) ? 'AS' : 'ESPN'}</p>
        {club && <a href={club.sourceUrl} target="_blank" rel="noreferrer" className="sentinel-text-link">Datos del club en FotMob <ArrowUpRight size={14} /></a>}
      </div>
    </div>
  </>;
  if (inline) return <section aria-labelledby="sports-team-title" className="sentinel-card">{content}</section>;
  return <dialog ref={dialog} aria-labelledby="sports-team-title" onCancel={event => { event.preventDefault(); onClose(); }} className="custom-scrollbar scheme-dark fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-xl border border-slate-700 bg-[#080C13] p-0 text-slate-100 backdrop:bg-black/70">{content}</dialog>;
}
