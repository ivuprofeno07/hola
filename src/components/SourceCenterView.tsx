import React, { useState, useMemo } from 'react';
import { Radio, RefreshCw, CheckCircle, AlertTriangle, XCircle, Power, Terminal, Filter, Zap } from 'lucide-react';
import { SourceInfo, SyncLog } from '../lib/types';
import { i18n } from '../i18n/translations';
import { formatearFechaCompleta, formatearHora, formatearNumero } from '../utils/formatters';

interface SourceCenterViewProps {
  sources: SourceInfo[];
  logs: SyncLog[];
  onSyncSource: (id: string) => Promise<void>;
  onToggleSource: (id: string) => Promise<void>;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
}

export const SourceCenterView: React.FC<SourceCenterViewProps> = ({
  sources,
  logs,
  onSyncSource,
  onToggleSource,
  onSyncAll,
  isSyncing
}) => {
  const [activeSyncingId, setActiveSyncingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceActionError, setSourceActionError] = useState('');

  const handleSyncOne = async (id: string) => {
    setActiveSyncingId(id);
    setSourceActionError('');
    try {
      await onSyncSource(id);
    } catch {
      setSourceActionError('No se pudo sincronizar la fuente. Revisa su estado e inténtalo de nuevo.');
    } finally {
      setActiveSyncingId(null);
    }
  };

  const handleToggle = async (id: string) => {
    setSourceActionError('');
    try {
      await onToggleSource(id);
    } catch {
      setSourceActionError('No se pudo cambiar el estado de la fuente.');
    }
  };

  const categories = useMemo(() => {
    const set = new Set(sources.map(s => s.category));
    return ['all', ...Array.from(set)];
  }, [sources]);

  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
      const matchSearch =
        searchQuery === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.endpointUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchState = sourceFilter === 'all'
        || (sourceFilter === 'paused' && !s.enabled)
        || (sourceFilter === 'issues' && s.enabled && (s.status === 'ERROR' || s.status === 'RATE_LIMITED'));
      return matchCat && matchSearch && matchState;
    });
  }, [sources, selectedCategory, searchQuery, sourceFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
            <CheckCircle size={11} /> {i18n.sourceCenter.statusHealthy}
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
            <AlertTriangle size={11} /> Límite de solicitudes
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/30">
            <XCircle size={11} /> {i18n.sourceCenter.statusError}
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono text-slate-400 bg-[#0A0E16] px-2 py-0.5 rounded-md border border-slate-800">
            {status === 'STANDBY' ? 'Sin consultar' : status}
          </span>
        );
    }
  };

  const activeCount = sources.filter(s => s.enabled).length;
  const issueCount = sources.filter(s => s.enabled && (s.status === 'ERROR' || s.status === 'RATE_LIMITED')).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header Banner */}
      <div className="sentinel-card p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-mono font-bold text-emerald-300 uppercase mb-1.5">
            <Zap size={11} className="text-emerald-400" />
            <span>CENTRO DE CONEXIÓN GLOBAL</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-serif text-slate-100 flex items-center gap-2">
            <Radio size={19} className="text-emerald-400" />
            <span>{i18n.headerTitles.sources.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans">
            {i18n.headerTitles.sources.subtitle} — Monitorización en tiempo real de {sources.length} conectores con ejecución en el servidor e intervalos adaptados a límites oficiales.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex flex-col text-right font-mono text-xs">
            <span className="text-emerald-400 font-bold">{activeCount} habilitadas</span>
            <span className="text-slate-400">{issueCount} con incidencias · {sources.length - activeCount} pausadas</span>
          </div>

          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-400/60 hover:border-emerald-300 text-emerald-300 hover:text-white text-xs font-bold font-mono shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-emerald-400' : ''} />
            <span>{isSyncing ? 'Sincronización Global...' : 'Sincronizar Todas'}</span>
          </button>
        </div>
      </div>

      {sourceActionError && <p role="alert" className="text-sm text-rose-400">{sourceActionError}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado de las fuentes">
        {[
          { id: 'all', label: 'Todas', count: sources.length },
          { id: 'issues', label: 'Con incidencias', count: issueCount },
          { id: 'paused', label: 'Pausadas', count: sources.length - activeCount }
        ].map(({ id, label, count }) => (
          <button key={id} type="button" onClick={() => setSourceFilter(id)} aria-pressed={sourceFilter === id} className={`sentinel-action ${sourceFilter === id ? 'border-emerald-500/50 text-emerald-300' : ''}`}>
            {label} <span className="font-mono text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#06080D] p-3 rounded-xl border border-emerald-500/20">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-500 text-[11px] uppercase mr-1 flex items-center gap-1">
            <Filter size={12} className="text-emerald-400" />
            <span>Filtrar:</span>
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)} aria-pressed={selectedCategory === cat}
              className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[10px] font-semibold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-[#0A0E16] border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'Todas' : cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Buscar conector, URL, API..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full md:w-64 bg-[#0A0E16] border border-emerald-500/20 focus:border-emerald-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
          />
        </div>
      </div>

      {filteredSources.length === 0 && <p className="py-4 text-sm text-slate-400">No hay fuentes que coincidan con estos filtros.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSources.map(source => {
          const isThisSyncing = activeSyncingId === source.id;
          return (
            <div
              key={source.id}
              className={`sentinel-card p-4 sm:p-5 flex flex-col justify-between transition-all ${
                source.enabled ? 'hover:border-emerald-400/50' : 'opacity-60 border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-mono uppercase text-emerald-400 font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/25">
                        {source.category}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0A0E16] text-slate-400 border border-slate-800">
                        {source.integrationType}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 font-serif truncate" title={source.name}>
                      {source.name}
                    </h3>
                  </div>

                  <div>{source.enabled ? getStatusBadge(source.status) : <span className="text-xs text-slate-400">Pausada</span>}</div>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <p>Último éxito: {source.lastSuccessAt ? formatearFechaCompleta(source.lastSuccessAt) : 'sin registro'}</p>
                  {source.lastMessage && (source.status === 'ERROR' || source.status === 'RATE_LIMITED') && <p className="break-words text-amber-200">{source.lastMessage}</p>}
                </div>

                {/* Telemetry info */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                  <div className="bg-[#05070B] p-2 rounded-lg border border-emerald-500/15">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Latencia</span>
                    <span className="font-semibold text-emerald-400">{source.responseTimeMs} ms</span>
                  </div>
                  <div className="bg-[#05070B] p-2 rounded-lg border border-emerald-500/15">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Registros</span>
                    <span className="font-semibold text-slate-200">{formatearNumero(source.recordsCount)}</span>
                  </div>
                  <div className="bg-[#05070B] p-2 rounded-lg border border-emerald-500/15">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Límite</span>
                    <span className="text-slate-300 truncate block text-[9px]" title={source.rateLimit}>{source.rateLimit}</span>
                  </div>
                  <div className="bg-[#05070B] p-2 rounded-lg border border-emerald-500/15">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Autenticación</span>
                    <span className="text-slate-300 truncate block text-[9px]">{source.requiresAuth ? 'Token / API Key' : 'Pública / Libre'}</span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-500 truncate" title={source.endpointUrl}>
                  <span className="text-emerald-500/70 font-semibold">URL:</span> {source.endpointUrl}
                </div>
              </div>

              {/* Action row */}
              <div className="pt-3 mt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-mono">
                <button
                  onClick={() => handleToggle(source.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-[10px] font-semibold ${
                    source.enabled
                      ? 'text-emerald-400 hover:bg-emerald-500/15'
                      : 'text-slate-500 hover:bg-slate-800'
                  }`}
                  title={source.enabled ? 'Deshabilitar fuente' : 'Habilitar fuente'}
                >
                  <Power size={11} />
                  <span>{source.enabled ? 'Pausar' : 'Habilitar'}</span>
                </button>

                <button
                  onClick={() => handleSyncOne(source.id)}
                  disabled={activeSyncingId !== null || !source.enabled}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 hover:text-white transition-all disabled:opacity-40 text-[10px] font-bold"
                >
                  <RefreshCw size={10} className={isThisSyncing ? 'animate-spin text-emerald-400' : ''} />
                  <span>{isThisSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Logs Table */}
      <div className="sentinel-card overflow-hidden">
        <div className="p-4 border-b border-emerald-500/20 flex items-center justify-between bg-[#06080D]">
          <div className="flex items-center space-x-2">
            <Terminal size={15} className="text-emerald-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              {i18n.sourceCenter.syncLogsTitle}
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80">Daemon Autónomo de Conexión en Servidor</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-emerald-500/20 text-slate-400 text-[10px] uppercase bg-[#05070B]">
                <th className="py-2.5 px-4">Hora</th>
                <th className="py-2.5 px-3">Fuente</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Duración</th>
                <th className="py-2.5 px-3">Registros</th>
                <th className="py-2.5 px-4">Mensaje de Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-emerald-950/15 transition-colors">
                  <td className="py-2 px-4 text-slate-400 text-[11px]">
                    {formatearHora(log.timestamp, true)}
                  </td>
                  <td className="py-2 px-3 text-slate-200 font-semibold">{log.sourceName}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {log.status === 'SUCCESS' ? 'CORRECTO' : 'ERROR'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-emerald-400">{log.durationMs}ms</td>
                  <td className="py-2 px-3 text-slate-300">{formatearNumero(log.recordsFetched)}</td>
                  <td className="py-2 px-4 text-slate-400 text-[11px] truncate max-w-xs">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

