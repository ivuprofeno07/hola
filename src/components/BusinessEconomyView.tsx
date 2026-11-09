import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { EconomicIndicator } from '../lib/types';
import { formatearDecimal, formatearFechaCompleta } from '../utils/formatters';

const categories = { index: 'Índices', currency: 'Divisas', crypto: 'Cripto', macro: 'Macroeconomía', commodity: 'Materias primas' };

export function BusinessEconomyView({ indicators, loading }: { indicators: EconomicIndicator[]; loading: boolean }) {
  const [category, setCategory] = useState('all');
  const visible = indicators.filter(item => category === 'all' || item.category === category);
  const groups = [...new Set(indicators.map(item => item.category))];
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-7">
      <header>
        <h1 className="flex items-center gap-3 font-sans text-2xl font-semibold sm:text-3xl"><TrendingUp className="text-emerald-400" /> Mercados y economía</h1>
        <p className="mt-2 text-sm text-slate-400">Última observación disponible de cada proveedor. Consulta la fecha antes de comparar valores.</p>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Categorías de mercado" role="group">
        <button type="button" className="sentinel-action" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Todos</button>
        {groups.map(group => <button key={group} type="button" className="sentinel-action" aria-pressed={category === group} onClick={() => setCategory(group)}>{categories[group]}</button>)}
      </div>
      {!visible.length && <p className="sentinel-card p-5 text-sm text-slate-400">{loading ? 'Consultando indicadores…' : 'No hay observaciones de proveedor para este filtro.'}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(item => {
          const stale = item.category !== 'macro' && Date.now() - Date.parse(item.updatedAt) > (item.category === 'crypto' ? 2 : 96) * 3600000;
          return (
            <section key={item.id} className="sentinel-card space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-mono text-xs text-emerald-300">{item.symbol}</p><h2 className="font-sans text-sm font-semibold">{item.name}</h2></div>
                {stale && <span className="text-xs text-amber-300">Dato anterior</span>}
              </div>
              <div><span className="font-mono text-2xl font-semibold">{formatearDecimal(item.value, 2)}</span> <span className="text-xs text-slate-400">{item.unit}</span></div>
              {item.changeKnown && <p className={item.changePercent < 0 ? 'text-sm text-rose-300' : 'text-sm text-emerald-300'}>{item.changePercent > 0 ? '+' : ''}{formatearDecimal(item.changePercent, 2)} % {item.category === 'index' ? 'frente al cierre anterior' : 'en 24 h'}</p>}
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
                <p>{item.source}</p>
                <p className="mt-1">{item.category === 'macro' ? 'Periodo: ' + item.updatedAt.slice(0, 4) : 'Observado: ' + (item.updatedAt.length === 10 ? item.updatedAt : formatearFechaCompleta(item.updatedAt))}</p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
