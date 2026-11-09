import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { fetchArticles } from '../lib/api';
import type { Article, AIModel, Repository, SportsMatch, Vulnerability } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  models: AIModel[];
  repositories: Repository[];
  vulnerabilities: Vulnerability[];
  matches: SportsMatch[];
  onSelectArticle: (article: Article) => void;
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function GlobalSearchModal({ isOpen, onClose, articles, models, repositories, vulnerabilities, matches, onSelectArticle }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ query: string; results: Article[]; failed: boolean }>();
  const search = normalize(query);

  useEffect(() => {
    const element = dialog.current;
    if (isOpen && element && !element.open) element.showModal();
    if (!isOpen && element?.open) element.close();
    if (!isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || search.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchArticles(undefined, query.trim(), false, { signal: controller.signal }).then(data => {
        if (!controller.signal.aborted) setRemote({ query, results: data.articles, failed: false });
      }).catch(() => { if (!controller.signal.aborted) setRemote({ query, results: [], failed: true }); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [isOpen, query, search]);

  const includes = (...values: (string | undefined)[]) => normalize(values.filter(Boolean).join(' ')).includes(search);
  const localNews = articles.filter(article => includes(article.title, article.description, article.source));
  const news = [...new Map([...(remote?.query === query ? remote.results : []), ...localNews].map(article => [article.id, article])).values()].slice(0, 6);
  const groups = [
    { label: 'Modelos de IA', results: models.filter(model => includes(model.name, model.provider)).slice(0, 4).map(model => ({ id: model.id, title: model.name, source: model.provider, url: model.officialUrl })) },
    { label: 'Ciberseguridad', results: vulnerabilities.filter(vuln => includes(vuln.cveId, vuln.title)).slice(0, 4).map(vuln => ({ id: vuln.id, title: vuln.cveId + ' · ' + vuln.title, source: vuln.source, url: vuln.advisoryUrl })) },
    { label: 'Repositorios', results: repositories.filter(repo => includes(repo.fullName, repo.description)).slice(0, 4).map(repo => ({ id: repo.id, title: repo.fullName, source: 'GitHub', url: repo.url })) },
    { label: 'Deportes', results: matches.filter(match => match.sourceUrl && includes(match.homeTeam, match.awayTeam, match.competition)).slice(0, 4).map(match => ({ id: match.id, title: match.homeTeam + ' · ' + match.awayTeam, source: match.competition, url: match.sourceUrl! })) }
  ];
  const resultClass = 'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-950/35 hover:text-emerald-300 focus-visible:outline-emerald-400';

  return (
    <dialog ref={dialog} aria-labelledby="global-search-title" onCancel={event => { event.preventDefault(); onClose(); }} className="custom-scrollbar scheme-dark fixed inset-x-0 top-[8dvh] mx-auto max-h-[82dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-auto rounded-xl border border-slate-700 bg-[#080C13] text-slate-100 shadow-2xl backdrop:bg-black/70">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#0D121D] p-4">
        <h2 id="global-search-title" className="mb-2 font-sans text-sm font-semibold">Buscar en Sentinel</h2>
        <div className="flex items-center gap-3">
          <Search size={16} className="shrink-0 text-emerald-400" />
          <input autoFocus type="search" aria-label="Buscar en Sentinel" placeholder="Noticias, CVE, modelos, equipos…" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" value={query} onChange={event => setQuery(event.target.value)} />
          <button type="button" aria-label="Cerrar búsqueda" onClick={onClose} className="sentinel-action"><X size={16} /></button>
        </div>
      </div>
      <div className="space-y-4 p-3">
        {search.length < 2 && <p className="p-2 text-sm text-slate-400">Escribe al menos dos caracteres.</p>}
        {search.length >= 2 && <>
          {!!news.length && <section><h3 className="px-3 text-xs font-semibold text-emerald-300">Noticias</h3>{news.map(article => <button type="button" key={article.id} className={resultClass} onClick={() => { onSelectArticle(article); onClose(); }}><span>{article.title}<span className="block text-xs text-slate-400">{article.source}</span></span><ArrowUpRight size={14} className="shrink-0" /></button>)}</section>}
          {groups.map(group => group.results.length ? <section key={group.label}><h3 className="px-3 text-xs font-semibold text-emerald-300">{group.label}</h3>{group.results.map(result => /^https?:\/\//i.test(result.url) ? <a key={result.id} className={resultClass} href={result.url} target="_blank" rel="noreferrer"><span>{result.title}<span className="block text-xs text-slate-400">{result.source}</span></span><ArrowUpRight size={14} className="shrink-0" /></a> : <p key={result.id} className="px-3 py-2 text-sm">{result.title}</p>)}</section> : null)}
          {!news.length && groups.every(group => !group.results.length) && <p className="p-2 text-sm text-slate-400" role="status">{remote?.query !== query ? 'Buscando…' : remote.failed ? 'No se pudo consultar el archivo de noticias.' : 'No hay coincidencias.'}</p>}
        </>}
      </div>
    </dialog>
  );
}
