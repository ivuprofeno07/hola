import React, { useState } from 'react';
import { Sliders, Database, Server, Cpu, Radio, Shield, Terminal, RefreshCw } from 'lucide-react';
import { SystemMetrics } from '../lib/types';
import { i18n } from '../i18n/translations';
import { formatearNumero, formatearDecimal } from '../utils/formatters';

interface AdminViewProps {
  metrics: SystemMetrics | null;
  onRefreshMetrics: () => Promise<void>;
  loading: boolean;
}

export const AdminView: React.FC<AdminViewProps> = ({
  metrics,
  onRefreshMetrics,
  loading
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  async function refresh() {
    setRefreshing(true);
    setError(false);
    try { await onRefreshMetrics(); } catch { setError(true); }
    finally { setRefreshing(false); }
  }
  const rows = (value?: number) => value === undefined ? '—' : formatearNumero(value) + ' filas';
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sentinel-card rounded-xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Sliders size={18} className="text-slate-400" />
            <span>{i18n.headerTitles.admin.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {i18n.headerTitles.admin.subtitle}
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading || refreshing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#121724] hover:bg-[#1A2234] border border-[#212B3E] text-slate-300 text-xs font-mono transition-colors shadow-sm"
        >
          <RefreshCw size={12} className={loading || refreshing ? 'animate-spin' : ''} />
          <span>Actualizar Métricas</span>
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">No se pudieron actualizar las métricas. Puedes reintentar.</p>}
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sentinel-card rounded-xl p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TAMAÑO DE LA BASE DE DATOS</span>
            <Database size={15} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {metrics ? `${formatearDecimal(metrics.databaseSizeBytes / 1024, 1)} KB` : '—'}
          </div>
          <div className="text-[10px] font-mono text-emerald-400">SQLite (Modo WAL Activo)</div>
        </div>

        <div className="sentinel-card rounded-xl p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>CONECTORES ACTIVOS</span>
            <Radio size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{metrics?.activeSources ?? '—'}</div>
          <div className="text-[10px] font-mono text-slate-400">{metrics ? `${metrics.healthySources} operativos de ${metrics.activeSources} habilitados` : 'Estado pendiente'}</div>
        </div>

        <div className="sentinel-card rounded-xl p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ENTIDADES INDEXADAS</span>
            <Server size={15} className="text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {metrics ? formatearNumero(metrics.totalArticles + metrics.totalVulnerabilities + metrics.totalModels + metrics.totalRepos + metrics.totalPapers) : '—'}
          </div>
          <div className="text-[10px] font-mono text-slate-400">Registros relacionales totales</div>
        </div>

        <div className="sentinel-card rounded-xl p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>MOTOR DE SINCRONIZACIÓN</span>
            <Cpu size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{metrics ? (metrics.syncRunning ? 'Sincronizando' : 'En espera') : '—'}</div>
          <div className="text-[10px] font-mono text-slate-400">Ciclo global de sincronización</div>
        </div>
      </div>

      {/* Database Schema Inspector */}
      <div className="sentinel-card rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
          Tablas de Almacenamiento Relacional (SQLite)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">articles</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalArticles)}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">ai_models</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalModels)}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">vulnerabilities</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalVulnerabilities)}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">repositories</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalRepos)}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">research_papers</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalPapers)}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#121724] border border-[#212B3E] flex justify-between items-center">
            <span className="text-slate-400">sources</span>
            <span className="text-slate-100 font-bold">{rows(metrics?.totalSources)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

