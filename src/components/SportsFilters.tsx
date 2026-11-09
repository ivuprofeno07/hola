import { useState } from 'react';
import { Search, SlidersHorizontal, Star, X } from 'lucide-react';
import type { SportsLeague } from '../lib/sportsLeagues';

const isCountry = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 70;
const isLeague = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,55}$/.test(value);
const storageKey = 'sentinel.sports.filters.v1';

export interface SportsPreferences {
  scope: string;
  favorites: string[];
  leagues: string[] | null;
}

export function loadSportsPreferences(): SportsPreferences {
  const defaults = { scope: 'all', favorites: [], leagues: null };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!stored) return defaults;
    return {
      scope: isCountry(stored.scope) ? stored.scope : defaults.scope,
      favorites: Array.isArray(stored.favorites) ? [...new Set<string>(stored.favorites.filter(isCountry))] : [],
      leagues: Array.isArray(stored.leagues) ? [...new Set<string>(stored.leagues.filter(isLeague))] : null
    };
  } catch {
    return defaults;
  }
}

export function storeSportsPreferences(preferences: SportsPreferences) {
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Browser storage is optional. */ }
}

function scopeLeagues({ scope, favorites }: SportsPreferences, catalog: SportsLeague[]) {
  return catalog.filter(league => {
    if (league.sport !== 'football') return false;
    if (scope === 'all') return true;
    if (scope === 'featured') return league.featured;
    if (scope === 'favorites') return favorites.includes(league.country);
    return league.country === scope;
  });
}

export function selectedFootballLeagues(preferences: SportsPreferences, catalog: SportsLeague[]) {
  const leagues = scopeLeagues(preferences, catalog);
  return leagues.filter(league => preferences.leagues === null || preferences.leagues.includes(league.id)).map(league => league.id);
}

export function sportsSearchText(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const selectClass = 'w-full rounded-lg border border-slate-700 bg-[#101722] p-2 text-sm text-slate-100';

export function SportsFilters({ preferences, catalog, onChange }: { preferences: SportsPreferences; catalog: SportsLeague[]; onChange: (preferences: SportsPreferences) => void }) {
  const leagues = scopeLeagues(preferences, catalog);
  const countries = [...new Set([
    ...catalog.filter(league => league.sport === 'football').map(league => league.country),
    ...preferences.favorites,
    ...(['featured', 'all', 'favorites'].includes(preferences.scope) ? [] : [preferences.scope])
  ])].sort((a, b) => a.localeCompare(b, 'es'));
  const availableCountries = countries.filter(country => !preferences.favorites.includes(country));
  const selected = selectedFootballLeagues(preferences, catalog);
  const [search, setSearch] = useState('');
  const shownLeagues = leagues.filter(league => sportsSearchText(league.name + ' ' + league.country).includes(sportsSearchText(search)));

  return (
    <details className="sentinel-card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:text-emerald-300">
        <SlidersHorizontal size={16} className="text-emerald-400" /> Personalizar ligas de fútbol
        <span className="ml-auto text-xs font-normal text-slate-400">{selected.length} seleccionadas</span>
      </summary>
      <div className="space-y-4 border-t border-slate-800 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-slate-300">
            <span>Qué quieres ver</span>
            <select className={selectClass} value={preferences.scope} onChange={event => onChange({ ...preferences, scope: event.target.value, leagues: null })}>
              <option value="featured">Competiciones destacadas</option>
              <option value="all">Todas las competiciones</option>
              <option value="favorites">Mis países favoritos</option>
              <optgroup label="País o región">{countries.map(country => <option key={country}>{country}</option>)}</optgroup>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5"><Star size={13} className="text-amber-300" /> Añadir país o región a favoritos</span>
            <select className={selectClass} value="" onChange={event => { if (event.target.value) onChange({ ...preferences, favorites: [...preferences.favorites, event.target.value] }); }}>
              <option value="" disabled>Elige un país o región</option>
              {availableCountries.map(country => <option key={country}>{country}</option>)}
            </select>
          </label>
        </div>
        {!!preferences.favorites.length && <ul className="flex flex-wrap gap-2" aria-label="Países y regiones favoritos">
          {preferences.favorites.map(country => <li key={country}><button type="button" onClick={() => onChange({ ...preferences, favorites: preferences.favorites.filter(item => item !== country) })} className="sentinel-action" aria-label={'Quitar ' + country + ' de favoritos'}><Star size={13} className="text-amber-300" />{country}<X size={13} /></button></li>)}
        </ul>}
        {leagues.length ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-300">Elegir competiciones</legend>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101722] px-3">
              <Search size={15} className="text-slate-400" />
              <input type="search" aria-label="Buscar competición" placeholder="Buscar liga o país" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
            </label>
            <button type="button" onClick={() => onChange({ ...preferences, leagues: null })} className="sentinel-text-link">Seleccionar todas las de este filtro</button>
            <div className="grid max-h-52 gap-1 overflow-y-auto rounded-lg border border-slate-800 p-2 sm:grid-cols-2">
              {!shownLeagues.length && <p className="px-2 py-1 text-sm text-slate-400">No hay competiciones que coincidan.</p>}
              {shownLeagues.map(league => (
                <label key={league.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                  <input type="checkbox" checked={selected.includes(league.id)} onChange={() => {
                    const next = selected.includes(league.id) ? selected.filter(id => id !== league.id) : [...selected, league.id];
                    onChange({ ...preferences, leagues: next });
                  }} className="accent-emerald-500" />
                  <span>{league.name}<span className="ml-1 text-slate-400">· {league.country}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : <p className="text-sm text-slate-400">Añade un país o región a favoritos para ver sus competiciones.</p>}
      </div>
    </details>
  );
}
