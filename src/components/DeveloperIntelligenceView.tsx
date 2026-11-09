import { useEffect, useRef, useState } from 'react';
import { Code2, GitFork, Star, AlertCircle, ExternalLink, Copy, Check, Search, RefreshCw } from 'lucide-react';
import type { GitHubHighlights } from '../lib/types';
import { fetchGitHubHighlights } from '../lib/api';
import { formatearFecha, formatearFechaCompleta, formatearNumero } from '../utils/formatters';

const collections = {
  popular: { label: 'Más populares', description: 'Ordenados por estrellas. Repositorios con al menos 1.000 estrellas y actividad en los últimos 30 días.' },
  emerging: { label: 'Proyectos emergentes', description: 'Ordenados por estrellas. Creados en los últimos 90 días, con al menos 50 estrellas y actividad en los últimos 30 días.' },
};

export function DeveloperIntelligenceView({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [collection, setCollection] = useState<keyof typeof collections>('popular');
  const [data, setData] = useState<GitHubHighlights>();
  const [readError, setReadError] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const repositories = data?.[collection] ?? [];

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function load() {
      if (running || document.hidden) return;
      running = true;
      try {
        const snapshot = await fetchGitHubHighlights(controller.signal);
        if (!controller.signal.aborted) { setData(snapshot); setReadError(false); }
      } catch {
        if (!controller.signal.aborted) setReadError(true);
      } finally {
        running = false;
      }
    }
    void load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [revision]);

  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError(false);
    try { await onRefresh(); }
    catch { setRefreshError(true); }
    finally {
      setRevision(value => value + 1);
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [copyError, setCopyError] = useState(false);
  const languages = ['all', ...[...new Set(repositories.map(repo => repo.language).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))];

  const filtered = repositories.filter(repo => {
    if (selectedLanguage !== 'all' && repo.language.toLowerCase() !== selectedLanguage.toLowerCase()) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        repo.name.toLowerCase().includes(q) ||
        repo.fullName.toLowerCase().includes(q) ||
        repo.description.toLowerCase().includes(q) ||
        repo.topics?.some(topic => topic.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopyClone = async (fullName: string, id: string) => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(`git clone https://github.com/${fullName}.git`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { setCopyError(true); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="editorial-hero flex flex-wrap items-end justify-between gap-4 p-5 sm:p-8">
        <div className="relative min-w-0">
          <span className="edition-tag inline-flex items-center gap-1.5"><Code2 size={14} /> Código abierto y desarrollo</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Repositorios de GitHub</h1>
          <p className="mt-2 text-sm text-emerald-50/75">Proyectos públicos destacados por estrellas y actividad reciente.</p>
        </div>
        <div className="relative space-y-2">
          <button type="button" onClick={refresh} disabled={refreshing} className="sentinel-action editorial-primary"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Actualizando…' : 'Actualizar ahora'}</button>
          <p className="text-xs text-slate-300" aria-live="polite">{data?.updatedAt ? 'Última consulta · ' + formatearFechaCompleta(data.updatedAt) : 'Esperando la primera consulta'}</p>
        </div>
      </header>
      <div className="sentinel-card rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Clasificación de repositorios">
              {(Object.keys(collections) as (keyof typeof collections)[]).map(id => (
                <button key={id} type="button" onClick={() => { setCollection(id); setSelectedLanguage('all'); }} aria-pressed={collection === id}
                  className={'sentinel-action ' + (collection === id ? 'border-emerald-500/60 text-emerald-300' : '')}>{collections[id].label}</button>
              ))}
            </div>
            <p className="max-w-xl text-xs text-slate-400">{collections[collection].description} Se renueva cada hora mientras Sentinel está en marcha.</p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar repositorio"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, tema o descripción"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#121724] border border-[#212B3E] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Language Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {languages.map(lang => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)} aria-pressed={selectedLanguage === lang}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                selectedLanguage === lang
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'bg-[#121724] text-slate-400 hover:text-slate-200 hover:bg-[#1A2234] border border-[#212B3E]'
              }`}
            >
              {lang === 'all' ? 'Todos los Lenguajes' : lang}
            </button>
          ))}
        </div>
      </div>

      {(refreshError || readError) && <p role="alert" className="sentinel-card p-3 text-sm text-amber-200">No se pudo actualizar la clasificación. {data?.updatedAt ? 'Se muestra la última consulta guardada.' : 'Puedes reintentar con Actualizar ahora.'}</p>}
      {!filtered.length && !readError && <p role="status" className="sentinel-card p-4 text-sm text-slate-400">{!data ? 'Consultando GitHub…' : !data.updatedAt ? 'La clasificación aparecerá al completarse la primera sincronización.' : 'No hay repositorios para estos filtros.'}</p>}
      {copyError && <p role="alert" className="text-sm text-rose-300">No se pudo copiar el comando.</p>}
      {/* Repositories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(repo => {
          const isCopied = copiedId === repo.id;
          return (
            <div
              key={repo.id}
              className="sentinel-card hover:border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between transition-all group shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400"><span className="mr-2 text-emerald-300">#{repo.rank}</span>{repo.owner} /</span>
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                      {repo.name}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1A2234] transition-colors"
                      title="Abrir en GitHub"
                      aria-label={'Abrir ' + repo.fullName + ' en GitHub'}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">{repo.description}</p>

                {/* Topics */}
                {repo.topics && repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {repo.topics.slice(0, 4).map(topic => (
                      <span
                        key={topic}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121724] text-slate-400 border border-[#212B3E]"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-slate-400">Último envío de código: {formatearFecha(repo.pushedAt)} · Creado: {formatearFecha(repo.createdAt)}{repo.license ? ' · ' + repo.license : ''}</p>
              {repo.growthRate && <p className="mt-1 text-xs text-emerald-300">{repo.growthRate}</p>}
              <div className="pt-3.5 mt-4 border-t border-[#182030] flex flex-wrap gap-2 items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-3.5">
                  <span className="flex items-center gap-1 text-slate-200 font-semibold">
                    <Star size={13} className="text-amber-400 fill-amber-400" />
                    {formatearNumero(repo.stars)}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork size={13} className="text-slate-400" />
                    {formatearNumero(repo.forks)}
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <AlertCircle size={13} className="text-slate-500" />
                    {formatearNumero(repo.openIssues)} incidencias
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#121724] text-cyan-300 border border-[#212B3E]">
                    {repo.language}
                  </span>
                  <button
                    onClick={() => handleCopyClone(repo.fullName, repo.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1A2234] flex items-center gap-1 text-[10px] border border-transparent hover:border-[#212B3E] transition-all"
                    title="Copiar comando git clone"
                  >
                    {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span className="hidden sm:inline">{isCopied ? 'Copiado' : 'Clonar'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


