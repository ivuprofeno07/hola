import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { SportsMatch, SportsMatchDetails, SportsTeam } from '../lib/types';
import { formatearFechaCompleta } from '../utils/formatters';
import { SportsPlayerPortrait, usePlayerPortraits } from './SportsPlayerPortrait';

const tabs = ['Estadísticas', 'Incidencias', 'Alineaciones', 'Cara a cara'] as const;
const eventNames: Record<string, string> = {
  'Yellow Card': 'Tarjeta amarilla', 'Red Card': 'Tarjeta roja', Goal: 'Gol',
  'Own Goal': 'Gol en propia puerta', Substitution: 'Cambio', Penalty: 'Penalti',
  'Penalty - Scored': 'Gol de penalti', 'Penalty - Missed': 'Penalti fallado'
};

function statNumber(value: string | null) {
  if (value === null || !/^\d+(?:[.,]\d+)?%?$/.test(value)) return null;
  return Number(value.replace('%', '').replace(',', '.'));
}

function StatComparison({ home, away }: { home: string | null; away: string | null }) {
  const local = statNumber(home);
  const visitor = statNumber(away);
  if (local === null || visitor === null || local + visitor === 0) return null;
  const share = local / (local + visitor) * 100;
  return (
    <span aria-hidden="true" className="mt-1.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-slate-800">
      <span className="bg-emerald-400" style={{ flexBasis: share + '%' }} />
      <span className="bg-sky-400" style={{ flexBasis: (100 - share) + '%' }} />
    </span>
  );
}

function Lineup({ lineup, team }: { lineup: SportsMatchDetails['lineups'][number]; team: string }) {
  const portraits = usePlayerPortraits(lineup.players);
  const rows = [
    /^(G|GK)$/,
    /^(CB|CD|LB|RB|LWB|RWB|D)(-|$)/,
    /^(AM|DM|CM|LM|RM|M)(-|$)/,
    /^(F|CF|ST|FW|LW|RW)(-|$)/
  ].map(pattern => lineup.players.filter(player => player.position && pattern.test(player.position)));
  const canDraw = lineup.players.length === 11 && rows.flat().length === 11 && rows[0].length === 1;
  return (
    <section className="sentinel-card p-3">
      <h3 className="font-sans text-sm font-semibold">{team}{lineup.formation && <span className="ml-2 text-xs text-emerald-300">{lineup.formation}</span>}</h3>
      {canDraw && <div aria-hidden="true" inert className="my-3 grid gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-1 py-3">
        {[...rows].reverse().filter(row => row.length).map((row, index) => <div key={index} className="flex justify-around gap-1">
          {row.map(player => <div key={player.name} className="min-w-0 text-center">
            <span className="flex justify-center"><SportsPlayerPortrait player={player} portrait={portraits[player.espnId ?? '']} /></span>
            <span title={player.name} className="mt-1 block truncate text-[9px] text-slate-200">{player.shortName ?? player.name}</span>
          </div>)}
        </div>)}
      </div>}
      <ul className="mt-2 divide-y divide-slate-800">{lineup.players.map(player => <li key={player.name} className="flex gap-2 py-1.5 text-xs">
        <SportsPlayerPortrait player={player} portrait={portraits[player.espnId ?? '']} /><span className="w-5 shrink-0 self-center font-mono text-slate-400">{player.number ?? '—'}</span><span className="self-center">{player.name}</span>
      </li>)}</ul>
    </section>
  );
}

export function SportsMatchDialog({ match, onClose, onTeam, inline = false }: { match: SportsMatch; onClose: () => void; onTeam: (team: SportsTeam) => void; inline?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Estadísticas');
  const [data, setData] = useState<SportsMatchDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const fromAS = match.sourceUrl?.startsWith('https://as.com/') === true;
  const supported = match.sport !== 'motorsport' && match.sport !== 'tennis' && !!match.eventId && !!match.leagueId;

  useEffect(() => {
    const element = dialog.current;
    if (!inline) element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, [inline]);

  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const query = new URLSearchParams({ event: match.eventId!, league: match.leagueId! });
        const response = await fetch('/api/sports/match?' + query, { signal: controller.signal });
        if (!response.ok) throw new Error('Match details unavailable');
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setData(payload);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const timer = match.status === 'LIVE' ? window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000) : undefined;
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [match.eventId, match.leagueId, match.status, supported]);

  const title = match.eventName || match.homeTeam + ' – ' + match.awayTeam;
  const teamName = (id: string | undefined, name: string, crest: string | undefined) => id && match.leagueId
    ? <button type="button" className="break-words text-xs font-semibold hover:text-emerald-300 hover:underline sm:text-sm" onClick={() => onTeam({ id, name, crest, leagueId: match.leagueId! })}>{name}</button>
    : <p className="break-words text-xs font-semibold sm:text-sm">{name}</p>;
  const live = match.status === 'LIVE';
  const status = live ? match.minute || 'En directo'
    : match.status === 'FINISHED' ? 'Finalizado'
    : match.status === 'POSTPONED' ? 'Suspendido'
    : 'Programado';

  const content = (
    <>
      <header className="relative border-b border-slate-800 bg-[#0D121D] px-4 py-5 sm:px-6">
        <button type="button" autoFocus onClick={onClose} aria-label="Cerrar ficha" className="sentinel-action absolute right-3 top-3"><X size={17} /></button>
        <p className="pr-12 text-xs font-medium text-emerald-300">{match.competition} · {status}</p>
        <h2 id="sports-match-title" className={match.eventName ? 'mt-2 pr-10 font-sans text-lg font-semibold sm:text-2xl' : 'sr-only'}>{title}</h2>
        <p className="mt-1 text-xs text-slate-400">{formatearFechaCompleta(match.matchTime)}{match.venue && ' · ' + match.venue}</p>
        {!match.eventName && (
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 text-center sm:gap-6">
            <div className="min-w-0">
              {match.homeCrest && <img src={match.homeCrest} alt="" className="mx-auto mb-2 size-10 object-contain sm:size-12" />}
              {teamName(match.homeTeamId, match.homeTeam, match.homeCrest)}
            </div>
            <div className="pt-2.5">
              <p className={'whitespace-nowrap font-mono text-xl font-bold sm:text-3xl ' + (live ? 'text-emerald-300' : '')}>
                {match.homeScore != null && match.awayScore != null ? match.homeScore + ' – ' + match.awayScore : '–'}
              </p>
              {live && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-400">En directo</span>}
            </div>
            <div className="min-w-0">
              {match.awayCrest && <img src={match.awayCrest} alt="" className="mx-auto mb-2 size-10 object-contain sm:size-12" />}
              {teamName(match.awayTeamId, match.awayTeam, match.awayCrest)}
            </div>
          </div>
        )}
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        {!!match.periods?.length && <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label={match.sport === 'tennis' ? 'Marcador por sets' : 'Marcador por parciales'}>
            <thead><tr><th className="pb-2">Marcador</th>{match.periods.map(period => <th key={period.label} className="whitespace-nowrap px-2 pb-2 text-center text-slate-400">{period.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800">
              <tr><th scope="row" className="py-2 font-medium">{match.homeTeam}</th>{match.periods.map(period => <td key={period.label} className="px-2 text-center">{period.home ?? '—'}</td>)}</tr>
              <tr><th scope="row" className="py-2 font-medium">{match.awayTeam}</th>{match.periods.map(period => <td key={period.label} className="px-2 text-center">{period.away ?? '—'}</td>)}</tr>
            </tbody>
          </table>
        </div>}
        {supported && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Secciones de la ficha">
            {tabs.map(tab => <button type="button" key={tab} aria-pressed={tab === activeTab} onClick={() => setActiveTab(tab)} className={'sentinel-action ' + (tab === activeTab ? 'border-emerald-500/60 text-emerald-300' : '')}>{tab}</button>)}
          </div>
        )}
        {failed && <p role="status" className="text-sm text-amber-200">ESPN no ha podido actualizar esta ficha.</p>}
        {!data && supported && !failed && <p role="status" className="text-sm text-slate-400">Cargando ficha…</p>}
        {!supported && <p className="text-xs text-slate-400">{fromAS ? 'Calendario y resultado publicados por AS.' : match.sport === 'tennis' ? 'Resultados de individuales. Los parciales aparecen cuando el proveedor los publica.' : 'Horario y estado de la sesión según ESPN.'}</p>}
        {data && activeTab === 'Estadísticas' && (data.stats.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-400"><th scope="col" className="w-1/5 pb-2 text-left text-emerald-300">{match.homeTeam}</th><th scope="col" className="pb-2 text-center">Estadística</th><th scope="col" className="w-1/5 pb-2 text-right text-sky-300">{match.awayTeam}</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {data.stats.map(({ name, home, away }, index) => <tr key={name + index}><td className="py-3 font-mono font-semibold">{home ?? '—'}</td><th scope="row" className="px-2 py-3 text-center text-xs font-medium text-slate-300">{name}<StatComparison home={home} away={away} /></th><td className="py-3 text-right font-mono font-semibold">{away ?? '—'}</td></tr>)}
            </tbody>
          </table>
        ) : <p className="text-sm text-slate-400">Todavía no hay estadísticas de este partido.</p>)}
        {data && activeTab === 'Incidencias' && (data.events.length ? (
          <ol className="divide-y divide-slate-800">{data.events.map(event => <li key={event.id} className="flex gap-3 py-3 text-sm"><span className="w-12 shrink-0 font-mono text-emerald-300">{event.minute || '—'}</span><div><p className="font-semibold">{eventNames[event.title] || event.title}</p><p className="text-xs leading-relaxed text-slate-400">{event.description}</p></div></li>)}</ol>
        ) : <p className="text-sm text-slate-400">No hay incidencias disponibles para este partido.</p>)}
        {data && activeTab === 'Alineaciones' && (data.lineups.length ? (
          <div className={inline ? 'grid gap-3' : 'grid gap-4 sm:grid-cols-2'}>{data.lineups.map(lineup => <Lineup key={lineup.side} lineup={lineup} team={lineup.side === 'home' ? match.homeTeam : match.awayTeam} />)}</div>
        ) : <p className="text-sm text-slate-400">El proveedor todavía no ha publicado las alineaciones.</p>)}
        {data && activeTab === 'Cara a cara' && (data.previous.length ? (
          <ul className="divide-y divide-slate-800" aria-label="Enfrentamientos anteriores">
            {data.previous.map(game => <li key={game.id} className="flex items-center justify-between gap-2 py-3">
              <div><p className="text-xs text-slate-400">{formatearFechaCompleta(game.date)}</p>{game.url ? <a href={game.url} target="_blank" rel="noreferrer" className="text-sm hover:text-emerald-300">{game.title}</a> : <p className="text-sm">{game.title}</p>}</div>
              <span className="shrink-0 font-mono text-sm font-semibold text-emerald-300">{game.home} – {game.away}</span>
            </li>)}
          </ul>
        ) : <p className="text-sm text-slate-400">No hay enfrentamientos anteriores disponibles en el proveedor.</p>)}
        {match.sourceUrl && <a href={match.sourceUrl} target="_blank" rel="noreferrer" className="sentinel-text-link">{fromAS ? "Ver en AS" : "Ver en ESPN"} <ArrowUpRight size={14} /></a>}
      </div>
    </>
  );
  if (inline) return <section aria-labelledby="sports-match-title" className="sentinel-card">{content}</section>;
  return <dialog ref={dialog} aria-labelledby="sports-match-title" onCancel={event => { event.preventDefault(); onClose(); }} className="custom-scrollbar scheme-dark fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-[#080C13] p-0 text-slate-100 shadow-2xl backdrop:bg-black/70">{content}</dialog>;
}
