import React, { useState } from 'react';
import { Radar, Target, Filter, Info, Sparkles, CheckCircle2 } from 'lucide-react';
import { TechRadarItem } from '../lib/types';
import { i18n } from '../i18n/translations';

interface TechRadarViewProps {
  items: TechRadarItem[];
  loading: boolean;
}

export const TechRadarView: React.FC<TechRadarViewProps> = ({ items, loading }) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>('all');
  const [selectedRing, setSelectedRing] = useState<string>('all');

  const quadrants = [
    { id: 'all', label: 'Todos los Cuadrantes' },
    { id: 'techniques', label: 'Técnicas y Arquitecturas' },
    { id: 'platforms', label: 'Plataformas' },
    { id: 'tools', label: 'Herramientas' },
    { id: 'languages_frameworks', label: 'Lenguajes y Frameworks' }
  ];

  const rings = [
    { id: 'all', label: 'Todos los Anillos', color: 'text-slate-300' },
    { id: 'adopt', label: 'ADOPTAR', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'trial', label: 'PROBAR', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
    { id: 'assess', label: 'EVALUAR', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    { id: 'hold', label: 'RETENER', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
  ];

  const filtered = items.filter(item => {
    if (selectedQuadrant !== 'all' && item.quadrant !== selectedQuadrant) return false;
    if (selectedRing !== 'all' && item.ring !== selectedRing) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="sentinel-card rounded-xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Radar size={18} className="text-cyan-400" />
            <span>{i18n.headerTitles.radar.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {i18n.headerTitles.radar.subtitle}
          </p>
        </div>

        {/* Ring Legend Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          {rings.slice(1).map(r => (
            <span key={r.id} className={`px-2 py-0.5 rounded-md border ${r.color} font-bold`}>
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="sentinel-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {quadrants.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuadrant(q.id)} aria-pressed={selectedQuadrant === q.id}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedQuadrant === q.id
                  ? 'bg-violet-600 text-white font-semibold shadow-sm'
                  : 'bg-[#121724] text-slate-400 hover:text-slate-200 border border-[#212B3E]'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {rings.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRing(r.id)} aria-pressed={selectedRing === r.id}
              className={`px-2.5 py-1 rounded-md font-mono uppercase text-[10px] font-bold transition-all ${
                selectedRing === r.id
                  ? 'bg-slate-200 text-slate-900 shadow-sm'
                  : 'bg-[#121724] text-slate-400 hover:text-slate-200 border border-[#212B3E]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!filtered.length && <p role="status" className="sentinel-card p-4 text-sm text-slate-400">{loading ? 'Consultando el radar…' : 'No hay tecnologías para estos filtros.'}</p>}
      {/* Radar Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => {
          const ringObj = rings.find(r => r.id === item.ring);
          return (
            <div
              key={item.id}
              className="sentinel-card hover:border-cyan-500/40 rounded-xl p-5 flex flex-col justify-between transition-all space-y-3.5 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">{quadrants.find(itemType => itemType.id === item.quadrant)?.label ?? item.quadrant}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border uppercase font-bold ${ringObj?.color}`}>
                    {ringObj?.label || item.ring}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100 mt-1 flex items-center gap-1.5">
                  {item.name}
                  {item.isNew && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      NUEVO
                    </span>
                  )}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed mt-2">{item.description}</p>
              </div>

              {/* Observable metrics footer */}
              <div className="pt-3 border-t border-[#182030] text-[11px] font-mono">
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-semibold">{item.metrics ? (item.id.startsWith("npm-") ? "Registro npm" : "Registro PyPI") : "Selección editorial"}</span>
                <span className="text-slate-200 mt-0.5 block">{item.metrics}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

