import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Zap,
  ExternalLink,
  BookOpen,
  DollarSign,
  BarChart2,
  Check,
  Plus,
  X,
  Gauge
} from 'lucide-react';
import { AIModel } from '../lib/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { i18n } from '../i18n/translations';
import { formatearNumero, formatearDecimal } from '../utils/formatters';

interface AIIntelligenceViewProps {
  models: AIModel[];
  loading: boolean;
}

export const AIIntelligenceView: React.FC<AIIntelligenceViewProps> = ({ models, loading }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<'catalog' | 'compare' | 'benchmarks'>('catalog');

  const providers = ['all', ...new Set(models.map(model => model.provider))];
  const [search, setSearch] = useState('');
  const measurement = (value: number | null | undefined, suffix = '') => value == null ? 'N/D' : value + suffix;

  const filteredModels = models.filter(m => {
    if (selectedProvider !== 'all' && m.provider !== selectedProvider) return false;
    return (m.name + ' ' + m.provider).toLowerCase().includes(search.trim().toLowerCase());
  });

  const comparedModels = models.filter(m => compareIds.includes(m.id));

  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter(x => x !== id));
    } else {
      if (compareIds.length >= 3) {
        setCompareIds([...compareIds.slice(1), id]);
      } else {
        setCompareIds([...compareIds, id]);
      }
    }
  };

  const chartData = models.filter(m => m.mmluScore != null || m.mathScore != null || m.codeScore != null).map(m => ({
    name: m.name.replace('Gemini ', '').replace('Claude ', '').replace('DeepSeek-', 'DS-'),
    MMLU: m.mmluScore ?? null,
    Matemáticas: m.mathScore ?? null,
    Código: m.codeScore ?? null
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Sub-Nav */}
      <div className="sentinel-card rounded-xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Cpu size={18} className="text-cyan-400" />
            <span>{i18n.headerTitles.ai.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {i18n.headerTitles.ai.subtitle}
          </p>
        </div>

        <div className="flex items-center bg-[#121724] border border-[#212B3E] rounded-lg p-1 text-xs">
          <button
            onClick={() => setViewTab('catalog')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewTab === 'catalog' ? 'bg-violet-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Catálogo de Modelos
          </button>
          <button
            onClick={() => setViewTab('compare')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewTab === 'compare' ? 'bg-violet-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Comparativa ({comparedModels.length})
          </button>
          <button
            onClick={() => setViewTab('benchmarks')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewTab === 'benchmarks' ? 'bg-violet-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Benchmarks
          </button>
        </div>
      </div>

      {/* Provider Filter Bar */}
      {viewTab === 'catalog' && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
          {providers.map(p => (
            <button
              key={p}
              onClick={() => setSelectedProvider(p)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedProvider === p
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                  : 'bg-[#0D121D] text-slate-400 hover:text-slate-200 hover:bg-[#121724] border border-[#1E2638]'
              }`}
            >
              {p === 'all' ? 'Todos los Proveedores' : p}
            </button>
          ))}
        </div>
      )}

      <label className="block text-sm text-slate-300">Buscar modelo
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o proveedor" className="ml-2 max-w-full rounded-lg border border-slate-700 bg-[#101722] p-2 text-sm" />
      </label>
      {viewTab === 'catalog' && !filteredModels.length && <p className="sentinel-card p-4 text-sm text-slate-400">{loading ? 'Cargando modelos…' : 'No hay modelos para este filtro.'}</p>}
      {/* Mode 1: Model Catalog */}
      {viewTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map(model => {
            const isCompared = compareIds.includes(model.id);
            return (
              <div
                key={model.id}
                className={`bg-[#0D121D] border rounded-xl p-5 flex flex-col justify-between transition-all shadow-sm ${
                  isCompared ? 'border-violet-500/60 shadow-lg shadow-violet-500/5' : 'border-[#1E2638] hover:border-[#2C3852]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">{model.provider}</span>
                      <h3 className="text-base font-bold text-slate-100">{model.name}</h3>
                    </div>
                    <button
                      onClick={() => toggleCompare(model.id)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 border transition-all ${
                        isCompared
                          ? 'bg-violet-600/20 text-violet-300 border-violet-500/40 font-semibold'
                          : 'bg-[#121724] text-slate-400 border-[#212B3E] hover:text-slate-200 hover:bg-[#1A2234]'
                      }`}
                    >
                      {isCompared ? <Check size={12} /> : <Plus size={12} />}
                      <span>{isCompared ? 'En Comparativa' : 'Comparar'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{model.notes}</p>

                  {/* Capabilities Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {model.capabilities.slice(0, 3).map((cap, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121724] text-slate-300 border border-[#212B3E]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Specs Matrix */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#182030] text-[11px] font-mono">
                    <div className="bg-[#121724] p-2.5 rounded-lg border border-[#212B3E]">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Ventana de Contexto</span>
                      <span className="font-semibold text-slate-200">
                        {!model.contextWindow ? "N/D" : model.contextWindow >= 1000000
                          ? `${formatearDecimal(model.contextWindow / 1000000, 1)}M tokens`
                          : `${formatearNumero(model.contextWindow / 1000)}k tokens`}
                      </span>
                    </div>

                    <div className="bg-[#121724] p-2.5 rounded-lg border border-[#212B3E]">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Coste Entrada / Salida</span>
                      <span className="font-semibold text-slate-200">
                        {model.pricingInput1M == null ? "N/D" : "$" + model.pricingInput1M} / {model.pricingOutput1M == null ? "N/D" : "$" + model.pricingOutput1M}
                      </span>
                    </div>

                    <div className="bg-[#121724] p-2.5 rounded-lg border border-[#212B3E]">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">MMLU / Matemáticas</span>
                      <span className="font-semibold text-emerald-400">
                        {measurement(model.mmluScore, "%")} / {measurement(model.mathScore, "%")}
                      </span>
                    </div>

                    <div className="bg-[#121724] p-2.5 rounded-lg border border-[#212B3E]">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Latencia Medida</span>
                      <span className="font-semibold text-cyan-400">{measurement(model.latencyMs, " ms")}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-[#182030] flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{model.id.startsWith("hf-") ? "Hugging Face" : "OpenRouter"}{model.fetchedAt ? " · " + new Date(model.fetchedAt).toLocaleDateString("es-ES") : ""}</span>
                  <div className="flex items-center space-x-2">
                    <a
                      href={model.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1A2234] flex items-center gap-1"
                      title="Documentación técnica"
                    >
                      <BookOpen size={12} />
                      <span className="text-[10px]">Docs</span>
                    </a>
                    <a
                      href={model.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1A2234] flex items-center gap-1"
                      title="Página Oficial del Modelo"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 2: Side-by-Side Comparison Matrix */}
      {viewTab === 'compare' && (
        <div className="sentinel-card rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">
                Matriz Técnica Comparativa de Modelos
              </h3>
              <p className="text-xs text-slate-400">Comparando {comparedModels.length} modelos de frontera seleccionados.</p>
            </div>
            {comparedModels.length < 3 && (
              <span className="text-xs text-amber-400 font-mono">Selecciona más modelos desde el catálogo para comparar hasta 3</span>
            )}
          </div>

          {!comparedModels.length && <p className="text-sm text-slate-400" role="status">Selecciona modelos en el catálogo para ver sus datos lado a lado.</p>}
          {!!comparedModels.length && <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E2638] text-slate-400 bg-[#101522]">
                  <th className="py-3 px-4 w-44">Parámetro Técnico</th>
                  {comparedModels.map(m => (
                    <th key={m.id} className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-cyan-400 uppercase font-semibold">{m.provider}</div>
                          <div className="text-sm font-bold text-slate-100">{m.name}</div>
                        </div>
                        <button
                          onClick={() => toggleCompare(m.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1A2234]"
                          title="Quitar de comparativa"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161D2B]">
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Ventana de Contexto</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-200 font-semibold">
                      {m.contextWindow ? formatearNumero(m.contextWindow / 1000) + "k tokens" : "N/D"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Precio Entrada / Salida (1M)</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-emerald-400 font-semibold">
                      {m.pricingInput1M == null ? "N/D" : "$" + m.pricingInput1M} / {m.pricingOutput1M == null ? "N/D" : "$" + m.pricingOutput1M}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Conocimiento General MMLU</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-200">
                      {measurement(m.mmluScore, "%")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Razonamiento Matemático (MATH)</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-200 font-bold text-cyan-300">
                      {measurement(m.mathScore, "%")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Generación de Código (HumanEval)</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-200 font-bold text-violet-300">
                      {measurement(m.codeScore, "%")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Latencia Medida</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-300">
                      {measurement(m.latencyMs, " ms")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Modalidades de Entrada/Salida</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-300">
                      {m.modalities.join(', ')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-400 font-medium">Licencia y Disponibilidad</td>
                  {comparedModels.map(m => (
                    <td key={m.id} className="py-3 px-4 text-slate-400 text-[10px]">
                      {m.license}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Mode 3: Benchmark Chart */}
      {viewTab === 'benchmarks' && (
        <div className="sentinel-card rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">
              Rendimiento Evaluado en Benchmarks (MMLU vs Matemáticas vs Código)
            </h3>
            <span className="text-xs text-slate-400 font-mono">Valores expresados en porcentaje de precisión</span>
          </div>

          {!chartData.length && <p className="text-sm text-slate-400">Los catálogos consultados no entregaron benchmarks comparables.</p>}
          {!!chartData.length && <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182030" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis domain={[60, 100]} stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D121D',
                    borderColor: '#212B3E',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1', paddingTop: '10px' }} />
                <Bar dataKey="MMLU" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Matemáticas" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Código" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>
      )}
    </div>
  );
};


