import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Globe2, Layers, LayoutGrid, MapPin, Search, Trophy } from 'lucide-react';
import type { Article, ArticleCluster, SourceInfo } from '../lib/types';
import { fetchArticles } from '../lib/api';
import { formatearFechaCompleta } from '../utils/formatters';
import { StoryCard, StoryEmpty } from './StoryCard';

interface Props {
  articles: Article[];
  clusters: ArticleCluster[];
  sources: SourceInfo[];
  onSelectArticle: (article: Article) => void;
  onToggleSave: (id: string) => Promise<void>;
  loading: boolean;
  edition?: 'spain' | 'football';
}

const categories = [
  ['all', 'Todas'], ['world', 'Mundo'], ['spain', 'España'], ['football', 'Fútbol'], ['tech', 'Tecnología'], ['ai', 'IA'],
  ['security', 'Ciberseguridad'], ['sports', 'Deportes'], ['science', 'Ciencia'], ['economy', 'Economía'], ['business', 'Empresas'], ['dev', 'Desarrollo']
];

const editions = {
  spain: { title: 'Noticias de España', kicker: 'Edición nacional', description: 'Política, sociedad y actualidad nacional.', icon: MapPin, tint: 'edition-tag--spain' },
  football: { title: 'Noticias de fútbol', kicker: 'Edición deportiva', description: 'Clubes, selecciones y actualidad del fútbol español e internacional.', icon: Trophy, tint: 'edition-tag--football' },
  general: { title: 'Últimas noticias', kicker: 'Redacción Sentinel', description: 'Titulares del mundo, tecnología, ciencia y economía.', icon: Globe2, tint: '' },
};

export function NewsView({ articles, clusters, sources, onSelectArticle, onToggleSave, loading, edition }: Props) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(edition === 'football' ? 'es' : 'all');
  const [source, setSource] = useState('');
  const [mode, setMode] = useState<'feed' | 'clusters' | 'saved'>('feed');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; articles: Article[]; clusters: ArticleCluster[] }>();
  const [error, setError] = useState('');
  const search = query.trim();
  const scope = edition ?? category;
  const key = JSON.stringify([scope, search, mode === 'saved', language, source]);
  const needsQuery = scope !== 'all' || !!search || mode === 'saved';
  const current = needsQuery ? result?.key === key ? result : null : { articles, clusters };
  const section = editions[edition ?? 'general'];
  const Icon = section.icon;

  useEffect(() => {
    if (!needsQuery) return;
    const controller = new AbortController();
    let inFlight = false;
    setError('');
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      void fetchArticles(scope, search, mode === 'saved', { language, source, signal: controller.signal }).then(data => {
        if (!controller.signal.aborted) { setResult({ key, ...data }); setError(''); }
      }).catch(() => { if (!controller.signal.aborted) setError('No se pudieron consultar las noticias.'); }).finally(() => { inFlight = false; });
    };
    const timer = window.setTimeout(load, search ? 200 : 0);
    const interval = window.setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(interval); };
  }, [key, language, mode, needsQuery, revision, scope, search, source]);

  const stories = current?.articles ?? [];
  const grouped = current?.clusters ?? [];
  const footballSources = sources.filter(item => item.category === 'football').sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const sourceNames = [...new Set(stories.map(story => story.source))].slice(0, 5);

  function save(id: string) {
    void onToggleSave(id).then(() => setRevision(value => value + 1)).catch(() => setError('No se pudo actualizar el guardado.'));
  }

  return (
    <div className="editorial-page space-y-5">
      <header className={`editorial-hero flex flex-wrap items-end justify-between gap-4 p-5 sm:p-8 ${edition === "football" ? "football-hero" : ""}`}>
        <div className="relative min-w-0">
          <span className={'edition-tag inline-flex items-center gap-1.5 ' + section.tint}><Icon size={14} />{section.kicker}</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-white sm:text-5xl">{section.title}</h1>
          <p className="mt-2 text-sm text-emerald-50/75">{section.description}</p>
        </div>
        {edition === 'football' && <a href="#directos" className="sentinel-action editorial-primary relative">Marcadores en directo <ArrowRight size={15} /></a>}
      </header>

      <div className="sentinel-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-[#101c1c] px-3 focus-within:border-emerald-400">
            <Search size={16} className="text-emerald-400" /><input type="search" aria-label="Buscar noticias" placeholder="Buscar título, texto o fuente" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
          </label>
          {!edition && <select aria-label="Categoría" value={category} onChange={event => setCategory(event.target.value)} className="rounded-lg border border-slate-700 bg-[#101c1c] px-3 py-2 text-sm">{categories.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select>}
          {edition === 'football' && <select aria-label="Idioma de las noticias" value={language} onChange={event => { setLanguage(event.target.value); setSource(''); }} className="rounded-lg border border-slate-700 bg-[#101c1c] px-3 py-2 text-sm"><option value="all">Todos los idiomas</option><option value="es">En español</option><option value="en">En inglés</option></select>}
        </div>
        {edition === 'football' && footballSources.length > 0 && <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
          Medio <select value={source} onChange={event => { setSource(event.target.value); setLanguage('all'); }} className="min-h-10 rounded-lg border border-slate-700 bg-[#101c1c] px-3 text-sm">
            <option value="">Todos los medios</option>
            {footballSources.map(item => <option value={item.name} key={item.id}>{item.name}</option>)}
          </select>
        </label>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vista de noticias">
          {([['feed', 'Últimas', LayoutGrid], ['clusters', 'Cobertura agrupada', Layers], ['saved', 'Guardados', Bookmark]] as const).map(([id, label, ViewIcon]) => <button type="button" key={id} onClick={() => setMode(id)} aria-pressed={mode === id} className={'sentinel-action ' + (mode === id ? 'border-emerald-500/60 text-emerald-300' : '')}><ViewIcon size={15} />{label}</button>)}
        </div>
      </div>

      {error && <div className="sentinel-card flex flex-wrap items-center justify-between gap-3 p-4" role="alert"><p className="text-sm text-rose-300">{error}</p><button type="button" className="sentinel-action" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
      {current && !error && edition === 'football' && <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <h2 className="text-lg font-bold">{mode === 'saved' ? 'Noticias guardadas' : mode === 'clusters' ? 'Cobertura de fútbol' : 'Últimos titulares'}</h2>
        <span className="text-xs tabular-nums text-slate-400" aria-live="polite">{stories.length} {stories.length === 1 ? 'noticia' : 'noticias'}</span>
      </div>}
      {!stories.length && !error && <StoryEmpty text={loading || !current ? 'Consultando noticias…' : 'No hay noticias para este filtro.'} />}
      {!!sourceNames.length && <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">Fuentes en esta vista {sourceNames.map(name => <span key={name} className="rounded-full border border-white/10 px-2.5 py-1 text-slate-200">{name}</span>)}</p>}

      {mode === 'clusters' ? <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map(group => <section key={group.id} className="sentinel-card min-w-0 divide-y divide-white/10">
          {group.articles.length > 1 && <p className="px-4 py-2 text-xs text-emerald-300">{group.articles.length} publicaciones relacionadas</p>}
          {group.articles.map(article => <div key={article.id} className="flex items-center gap-2 p-4">
            <button type="button" className="min-w-0 flex-1 text-left text-sm font-semibold hover:text-emerald-300" onClick={() => onSelectArticle(article)}>{article.title}<span className="mt-1 block text-xs font-normal text-slate-400">{article.source} · {formatearFechaCompleta(article.publishedAt)}</span></button>
            <button type="button" className="editorial-icon" aria-label={article.isSaved ? 'Quitar de guardados' : 'Guardar noticia'} aria-pressed={Boolean(article.isSaved)} onClick={() => save(article.id)}><Bookmark size={16} fill={article.isSaved ? 'currentColor' : 'none'} /></button>
            {article.url && <a className="editorial-icon" href={article.url} target="_blank" rel="noreferrer" aria-label={'Abrir fuente original de ' + article.title}><ArrowUpRight size={16} /></a>}
          </div>)}
        </section>)}
      </div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stories.map((article, index) => <div key={article.id} className={index === 0 && mode === 'feed' ? 'sm:col-span-2 [&>article]:h-full' : '[&>article]:h-full'}>
          <StoryCard article={article} featured={index === 0 && mode === 'feed'} onOpen={onSelectArticle} onSave={save} />
        </div>)}
      </div>}
    </div>
  );
}
