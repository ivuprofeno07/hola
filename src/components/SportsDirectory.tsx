import { useState } from 'react';
import { ChevronRight, Search, Star, Trophy } from 'lucide-react';
import type { ScoreboardSport, SportsLeague } from '../lib/sportsLeagues';
import { sportsSearchText } from './SportsFilters';

export function SportsDirectory({ sport, catalog, selected, pinned, onSelect, onPin }: {
  sport: ScoreboardSport;
  catalog: SportsLeague[];
  selected: string | null;
  pinned: string[];
  onSelect: (id: string | null) => void;
  onPin: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const search = sportsSearchText(query);
  const leagues = catalog.filter(league => league.sport === sport);
  const matching = leagues.filter(league => sportsSearchText(league.name + ' ' + league.country + ' ' + league.id).includes(search));
  const countries = [...new Set(matching.map(league => league.country))].sort((a, b) => a.localeCompare(b, 'es'));
  const pinnedLeagues = matching.filter(league => pinned.includes(league.id));
  function leagueRow(league: typeof leagues[number]) {
    const isPinned = pinned.includes(league.id);
    return (
      <li key={league.id} className="flex min-w-0 items-center gap-1 rounded-lg hover:bg-slate-800/70">
        <button type="button" aria-pressed={selected === league.id} onClick={() => onSelect(league.id)} className={'min-w-0 flex-1 break-words rounded-lg px-2 py-2 text-left text-xs ' + (selected === league.id ? 'bg-emerald-950/60 font-semibold text-emerald-300' : 'text-slate-200')}>{league.name}</button>
        <button type="button" aria-label={(isPinned ? 'Desfijar ' : 'Fijar ') + league.name} aria-pressed={isPinned} onClick={() => onPin(league.id)} className={'rounded p-2 ' + (isPinned ? 'text-amber-300' : 'text-slate-500 hover:text-amber-300')}><Star size={14} fill={isPinned ? 'currentColor' : 'none'} /></button>
      </li>
    );
  }
  return (
    <section className="sentinel-card min-w-0 p-3" aria-label="Directorio de competiciones">
      <h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><Trophy size={15} className="text-emerald-400" /> Competiciones <span className="ml-auto text-xs text-slate-400">{leagues.length}</span></h2>
      <label className="my-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101722] px-2 focus-within:border-emerald-400"><Search size={14} className="shrink-0 text-slate-400" /><input type="search" aria-label="Buscar liga en el directorio" placeholder="Liga o país" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none" /></label>
      <button type="button" onClick={() => onSelect(null)} className="sentinel-action w-full">Mi calendario</button>
      <div className="custom-scrollbar mt-3 max-h-[55dvh] space-y-3 overflow-y-auto">
        {!!pinnedLeagues.length && <div><h3 className="mb-1 px-2 font-sans text-xs text-amber-300">Fijadas</h3><ul>{pinnedLeagues.map(leagueRow)}</ul></div>}
        {!matching.length && <p className="p-2 text-xs text-slate-400">No hay ligas que coincidan.</p>}
        {countries.map(country => (
          <details key={country + Boolean(search)} open={search ? true : undefined} className="group rounded-lg border border-slate-800/80">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-xs text-slate-300"><ChevronRight size={13} className="group-open:rotate-90" /><span className="flex-1">{country}</span><span className="text-slate-500">{matching.filter(league => league.country === country).length}</span></summary>
            <ul className="px-1 pb-1">{matching.filter(league => league.country === country).map(leagueRow)}</ul>
          </details>
        ))}
      </div>
    </section>
  );
}
