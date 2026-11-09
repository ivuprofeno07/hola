import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, MapPin, Trophy, Users } from 'lucide-react';
import type { SportsClubDetails, SportsPlayer } from '../lib/types';
import { formatearFechaCompleta } from '../utils/formatters';
import { sportsSearchText } from './SportsFilters';
import { SportsPlayerPortrait, usePlayerPortraits } from './SportsPlayerPortrait';

const number = new Intl.NumberFormat('es-ES');
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const kinds = { loan: 'Cesión', free: 'Libre', transfer: 'Traspaso', unknown: 'Movimiento' };
const positions: Record<string, string> = {
  keeper: 'Portería', goalkeepers: 'Portería', goalkeeper: 'Portería',
  defense: 'Defensa', defenders: 'Defensa', defender: 'Defensa',
  midfield: 'Centrocampo', midfielders: 'Centrocampo', midfielder: 'Centrocampo',
  attack: 'Delantera', attackers: 'Delantera', forward: 'Delantera', forwards: 'Delantera'
};

export function ClubOverview({ club }: { club: SportsClubDetails }) {
  const facts = [
    { label: 'Competición', value: club.competition, Icon: Trophy },
    { label: 'Temporada', value: club.season, Icon: CalendarDays },
    { label: 'Entrenador', value: club.coach, Icon: Users },
    { label: 'Estadio', value: [club.stadium, club.city, club.capacity ? number.format(club.capacity) + ' plazas' : undefined].filter(Boolean).join(' · '), Icon: MapPin },
  ];
  return <div className="grid gap-3 sm:grid-cols-2">
    {facts.filter(item => item.value).map(({ label, value, Icon }) => <div key={label} className="sentinel-card flex items-start gap-3 p-4">
      <Icon size={18} className="shrink-0 text-emerald-300" /><div><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
    </div>)}
  </div>;
}

export function ClubTrophies({ club }: { club: SportsClubDetails }) {
  if (!club.trophies.length) return <p className="text-sm text-slate-400">La fuente no publica un palmarés para este equipo.</p>;
  const trophies = [...club.trophies].sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name, 'es'));
  return <div className="space-y-3">
    <h3 className="text-lg font-semibold">Palmarés</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      {trophies.map(item => <details key={item.name} className="sentinel-card p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Trophy size={16} className="shrink-0 text-amber-300" /><span className="flex-1">{item.name}</span><span className="shrink-0 text-amber-200">{item.titles} {item.titles === 1 ? 'título' : 'títulos'}</span></summary>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.seasons.length ? item.seasons.join(' · ') : 'Temporadas sin desglose.'}</p>
      </details>)}
    </div>
  </div>;
}

export function ClubTransfers({ club }: { club: SportsClubDetails }) {
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [year, setYear] = useState('');
  const years = [...new Set(club.transfers.map(item => item.date.slice(0, 4)))];
  const dated = club.transfers.filter(item => !year || item.date.startsWith(year));
  const visible = dated.filter(item => direction === 'all' || item.direction === direction);
  const published = dated.filter(item => item.fee !== undefined);
  const subtotal = (side: 'in' | 'out') => published.filter(item => item.direction === side).reduce((sum, item) => sum + (item.fee ?? 0), 0);
  if (!club.transfers.length) return <p className="text-sm text-slate-400">La fuente no publica movimientos para este equipo.</p>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de movimiento">
        {([['all', 'Todos'], ['in', 'Altas'], ['out', 'Bajas']] as const).map(([id, label]) => <button type="button" key={id} className={'sentinel-action ' + (direction === id ? 'border-emerald-500/60 text-emerald-300' : '')} aria-pressed={direction === id} onClick={() => setDirection(id)}>{label} · {id === 'all' ? dated.length : dated.filter(item => item.direction === id).length}</button>)}
      </div>
      <select aria-label="Año del movimiento" value={year} onChange={event => setYear(event.target.value)} className="rounded-lg border border-slate-700 bg-[#101722] px-3 py-2 text-sm">
        <option value="">Todos los años disponibles</option>{years.map(item => <option key={item}>{item}</option>)}
      </select>
    </div>
    {published.length > 0 && <div className="grid grid-cols-2 gap-2">
      {([['in', 'Gasto publicado'], ['out', 'Ingresos publicados']] as const).map(([id, label]) => {
        const total = subtotal(id);
        return <div key={id} className="sentinel-card p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold text-emerald-200">{total > 0 ? euros.format(total) : '—'}</p></div>;
      })}
    </div>}
    <p className="text-xs text-slate-400">Movimientos publicados por FotMob. Los importes estimados aparecen identificados.</p>
    {!visible.length && <p className="text-sm text-slate-400">No hay movimientos para estos filtros.</p>}
    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
      {visible.map((item, index) => {
        const incoming = item.direction === 'in';
        const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
        return <li key={item.player + item.date + index} className="flex flex-wrap items-start gap-3 px-3 py-3">
          <Icon size={17} className={incoming ? 'text-emerald-300' : 'text-amber-300'} />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.player}</p><p className="mt-0.5 text-xs text-slate-400">{incoming ? 'Desde' : 'A'} {item.club ?? 'club sin publicar'} · {kinds[item.kind]} · {formatearFechaCompleta(item.date)}</p></div>
          <span className="text-right text-xs font-semibold text-slate-200">{item.fee ? euros.format(item.fee) : item.estimate ? 'Estimado ' + euros.format(item.estimate) : item.kind === 'free' ? 'Sin coste de traspaso' : 'Importe sin publicar'}</span>
        </li>;
      })}
    </ul>
  </div>;
}

export function ClubSquad({ players }: { players: SportsPlayer[] }) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const portraitPlayers = players.filter(player => (!position || player.position === position) && sportsSearchText(player.name).includes(sportsSearchText(query)));
  const portraits = usePlayerPortraits(portraitPlayers);
  const roles = [...new Set(players.flatMap(player => player.position ?? []))];
  if (!players.length) return <p className="text-sm text-slate-400">El proveedor no publicó la plantilla.</p>;
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <input type="search" aria-label="Buscar jugador" placeholder="Buscar jugador" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 rounded-lg border border-slate-700 bg-[#101722] px-3 py-2 text-sm" />
      <select aria-label="Posición del jugador" value={position} onChange={event => setPosition(event.target.value)} className="min-w-0 rounded-lg border border-slate-700 bg-[#101722] px-3 py-2 text-sm">
        <option value="">Todas las posiciones</option>{roles.map(role => <option key={role} value={role}>{positions[role] ?? role}</option>)}
      </select>
    </div>
    {!portraitPlayers.length && <p className="text-sm text-slate-400">No hay jugadores para estos filtros.</p>}
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Plantilla del equipo">{portraitPlayers.map((player, index) => (
    <li key={player.name + index} className="sentinel-card flex min-w-0 items-center gap-2 p-2.5 text-sm">
      <SportsPlayerPortrait player={player} portrait={portraits[player.espnId ?? '']} large />
      <span className="w-6 shrink-0 font-mono text-slate-400">{player.number ?? '—'}</span>
      <div className="min-w-0"><p className="font-semibold">{player.name}</p><p className="text-xs text-slate-400">{[positions[player.position ?? ''] ?? player.position, player.age ? player.age + ' años' : undefined, player.nationality].filter(Boolean).join(' · ')}</p></div>
    </li>
  ))}</ul></div>;
}
