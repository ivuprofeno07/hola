import { useEffect, useState } from 'react';
import { fetchAlerts } from '../lib/api';
import { ArrowUpRight, Bell, Bookmark, Plus, Trash2 } from 'lucide-react';
import type { Article, WatchlistAlert, WatchlistItem } from '../lib/types';
import { formatearFechaCompleta } from '../utils/formatters';

interface Props {
  watchlists: WatchlistItem[];
  alerts: WatchlistAlert[];
  alertsOnly: boolean;
  loading: boolean;
  onAddWatchlist: (type: string, title: string, keyword: string) => Promise<void>;
  onDeleteWatchlist: (id: string) => Promise<void>;
  onSelectArticle: (article: Article) => void;
}

const itemTypes = [
  ['topic', 'Tema'], ['company', 'Empresa'], ['model', 'Modelo de IA'],
  ['technology', 'Tecnología'], ['repo', 'Repositorio'], ['team', 'Equipo'], ['cve', 'CVE']
];
const input = 'mt-1 w-full rounded-lg border border-slate-700 bg-[#101722] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none';

export function WatchlistsAlertsView({ watchlists, alerts, alertsOnly, loading, onAddWatchlist, onDeleteWatchlist, onSelectArticle }: Props) {
  const [editing, setEditing] = useState(false);
  const [itemType, setItemType] = useState('topic');
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rule, setRule] = useState('');
  const [filtered, setFiltered] = useState<{ rule: string; items?: WatchlistAlert[] }>();
  const selected = filtered?.rule === rule ? filtered : undefined;
  const matches = rule ? selected?.items ?? [] : alerts;
  useEffect(() => {
    if (!rule) return;
    const controller = new AbortController();
    void fetchAlerts(rule, controller.signal).then(items => {
      if (!controller.signal.aborted) setFiltered({ rule, items });
    }).catch(() => { if (!controller.signal.aborted) setFiltered({ rule }); });
    return () => controller.abort();
  }, [rule, alerts]);

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try { await action(); } catch { setError('No se pudo guardar el cambio. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-sans text-2xl font-semibold sm:text-3xl">{alertsOnly ? <Bell className="text-emerald-400" /> : <Bookmark className="text-emerald-400" />}{alertsOnly ? 'Alertas' : 'Seguimiento'}</h1>
          <p className="mt-2 text-sm text-slate-400">Coincidencias con noticias y boletines CVE de los últimos 30 días.</p>
        </div>
        {!alertsOnly && <button type="button" className="sentinel-action" onClick={() => setEditing(value => !value)}><Plus size={15} /> Nueva regla</button>}
      </header>

      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      {!alertsOnly && editing && (
        <form className="sentinel-card space-y-4 p-4" onSubmit={event => {
          event.preventDefault();
          if (!title.trim() || !keyword.trim()) return;
          void run(async () => {
            await onAddWatchlist(itemType, title.trim(), keyword.trim());
            setEditing(false); setTitle(''); setKeyword('');
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Nombre<input required maxLength={100} className={input} value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label className="text-sm">Categoría<select className={input} value={itemType} onChange={event => setItemType(event.target.value)}>{itemTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          </div>
          <label className="block text-sm">Palabras o frases separadas por comas<input required maxLength={100} className={input} value={keyword} onChange={event => setKeyword(event.target.value)} /></label>
          <button type="submit" className="sentinel-action" disabled={busy}>Guardar regla</button>
        </form>
      )}

      {!alertsOnly && <section aria-label="Reglas de seguimiento" className="sentinel-card divide-y divide-slate-800">
        {!watchlists.length && <p className="p-4 text-sm text-slate-400">{loading ? 'Cargando reglas…' : 'Aún no hay reglas de seguimiento.'}</p>}
        {watchlists.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1"><h2 className="font-sans text-sm font-semibold">{item.title}</h2><p className="mt-1 break-words text-xs text-slate-400">{itemTypes.find(([id]) => id === item.itemType)?.[1] ?? 'Tema'} · {item.keyword}</p></div>
          <button type="button" onClick={() => setRule(rule === item.id ? '' : item.id)} aria-pressed={rule === item.id} className="sentinel-action">{item.matchCount} coincidencias</button>
          <button type="button" onClick={() => void run(async () => { await onDeleteWatchlist(item.id); if (rule === item.id) setRule(''); })} disabled={busy} className="sentinel-action" aria-label={'Eliminar regla ' + item.title}><Trash2 size={15} /></button>
        </div>)}
      </section>}

      <section className="sentinel-card" aria-label="Coincidencias recientes">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
          <h2 className="font-sans text-base font-semibold">Coincidencias recientes</h2>
          {rule && <button type="button" onClick={() => setRule('')} className="sentinel-text-link">Ver todas</button>}
        </div>
        {!matches.length && <p className="p-4 text-sm text-slate-400">{loading || (rule && !selected) ? 'Consultando coincidencias…' : rule && !selected?.items ? 'No se pudieron consultar las coincidencias de esta regla.' : 'No hay coincidencias en el periodo consultado.'}</p>}
        <ul className="divide-y divide-slate-800">
          {matches.map(alert => (
            <li key={alert.id} className="flex items-center gap-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-emerald-300">{alert.watchlistTitle}</p>
                {alert.article ? <button type="button" className="mt-1 text-left text-sm font-medium hover:text-emerald-300" onClick={() => onSelectArticle(alert.article!)}>{alert.title}</button>
                  : <a href={alert.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium hover:text-emerald-300">{alert.title}</a>}
                <p className="mt-1 text-xs text-slate-400">{alert.source} · {formatearFechaCompleta(alert.timestamp)}</p>
              </div>
              {alert.url && <a href={alert.url} target="_blank" rel="noreferrer" className="sentinel-action" aria-label={'Abrir fuente de ' + alert.title}><ArrowUpRight size={14} /></a>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
