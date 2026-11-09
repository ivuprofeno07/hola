import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bot, Cpu, FileText, MapPin, Newspaper, Radio, ShieldAlert, Trophy } from 'lucide-react';
import type { DashboardData, SourcesData } from '../lib/api';
import type { Article, SportsScoreboard, WatchlistAlert } from '../lib/types';
import type { ActiveTab } from './Navigation';
import { formatearHora, tiempoRelativo } from '../utils/formatters';
import { StoryArtwork, StoryCard, StoryEmpty, storyLabels } from './StoryCard';

interface Props {
  data: DashboardData | null;
  sources: SourcesData;
  alerts: WatchlistAlert[];
  loading: boolean;
  onSelectArticle: (article: Article) => void;
  onNavigate: (tab: ActiveTab) => void;
  onToggleSaveArticle: (id: string) => void;
}

const dateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });

function LivePreview() {
  const [board, setBoard] = useState<SportsScoreboard | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch('/api/sports/live', { signal: controller.signal });
        if (!response.ok) throw new Error('Live unavailable');
        const result = await response.json();
        if (!controller.signal.aborted) { setBoard(result); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally { inFlight = false; }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  const matches = failed ? [] : board?.matches.filter(match => match.status === 'LIVE') ?? [];
  const sample = [...matches].sort((a, b) => Number(b.sport === 'football') - Number(a.sport === 'football')).slice(0, 3);

  return <section aria-label="Marcadores en directo" className="sentinel-card min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
      <h2 className="flex items-center gap-2 text-base font-bold"><Radio size={16} className="text-emerald-300" /> En juego {matches.length > 0 && <span className="edition-tag">{matches.length}</span>}</h2>
      <a href="#directos" className="sentinel-text-link">Ver directos <ArrowUpRight size={14} /></a>
    </header>
    {sample.length ? <ul className="divide-y divide-white/10">{sample.map(match => <li key={match.id} className="px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-2 text-xs text-slate-400"><span>{match.competition}</span><span className="shrink-0 font-mono text-emerald-300">{match.minute || 'En juego'}</span></div>
      {match.eventName ? <p className="text-sm font-semibold">{match.eventName}</p> : [
        [match.homeTeam, match.homeCrest, match.homeScore], [match.awayTeam, match.awayCrest, match.awayScore]
      ].map(([name, crest, score], index) => <div key={index} className="flex items-center gap-2 py-0.5 text-sm">
        {typeof crest === 'string' && <img src={crest} alt="" className="size-4 shrink-0 object-contain" />}
        <span className="min-w-0 flex-1">{name}</span><span className="shrink-0 font-mono font-bold text-emerald-300">{score ?? '–'}</span>
      </div>)}
    </li>)}</ul> : <p className="p-4 text-sm text-slate-400">{failed || (board && !board.updatedAt) ? 'El proveedor no respondió.' : board ? 'El proveedor no informa de encuentros en juego ahora.' : 'Consultando el marcador…'}</p>}
    {board?.updatedAt && !failed && <p className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">ESPN · Consulta {formatearHora(board.updatedAt, false)}{board.unavailable.length ? ' · Cobertura parcial' : ''}</p>}
  </section>;
}

export function DashboardView({ data, sources, alerts, loading, onSelectArticle, onNavigate, onToggleSaveArticle }: Props) {
  if (loading && !data) return <div className="editorial-page"><p className="editorial-hero p-8 text-sm text-slate-300" role="status">Cargando la portada…</p></div>;
  if (!data) return <div className="editorial-page"><StoryEmpty text="No se pudo cargar la portada." /></div>;

  const lead = data.editions.spain.find(article => article.imageUrl) ?? data.articles.find(article => article.imageUrl) ?? data.articles[0];
  const editions = [
    { name: 'España', tab: 'spain', icon: MapPin, text: 'Actualidad nacional', articles: data.editions.spain },
    { name: 'Fútbol', tab: 'football-news', icon: Trophy, text: 'Noticias de clubes y selecciones', articles: data.editions.football },
  ] as const;
  const enabled = sources.sources.filter(source => source.enabled);
  const issues = enabled.filter(source => source.status === 'ERROR' || source.status === 'RATE_LIMITED');
  const rest = data.articles.filter(article => article.id !== lead?.id && article.category !== 'spain' && article.category !== 'football').slice(0, 3);
  return (
    <div className="editorial-page space-y-7">
      <header className="editorial-hero grid items-stretch gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-8">
        <div className="relative flex min-w-0 flex-col justify-center py-2 lg:py-4">
          <p className="editorial-kicker">{dateLabel.format(new Date())}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-.055em] text-white sm:text-5xl 2xl:text-6xl">Actualidad y marcadores</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-50/75 sm:text-base">Noticias de España y del mundo, fútbol en directo y alertas de tus temas de interés.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('spain')} className="sentinel-action editorial-primary"><MapPin size={16} /> Noticias de España</button>
            <button type="button" onClick={() => onNavigate('football-news')} className="sentinel-action"><Trophy size={16} /> Noticias de fútbol</button>
          </div>
        </div>
        {lead ? <button type="button" onClick={() => onSelectArticle(lead)} className="editorial-feature">
          <StoryArtwork article={lead} eager />
          <span className={'edition-tag edition-tag--' + lead.category}>{storyLabels[lead.category] ?? 'Actualidad'}</span>
          <span className="mt-2 block max-w-xl text-xl font-bold leading-tight sm:text-2xl">{lead.title}</span>
          <span className="mt-3 flex items-center gap-2 text-xs text-white/85">{lead.source} · {tiempoRelativo(lead.publishedAt)} <ArrowUpRight size={14} /></span>
        </button> : <div className="editorial-feature"><p className="text-sm">Aún no hay un titular destacado.</p></div>}
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,.35fr)]">
        <section aria-label="Ediciones" className="grid min-w-0 gap-4 sm:grid-cols-2">
          {editions.map(({ name, tab, icon: Icon, text, articles }) => {
            const story = articles.find(article => article.id !== lead?.id && article.imageUrl) ?? articles.find(article => article.id !== lead?.id) ?? articles[0];
            return <div key={tab} className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div><p className="editorial-kicker">{text}</p><h2 className="mt-0.5 flex items-center gap-2 text-xl font-bold"><Icon size={18} className="text-emerald-300" />{name}</h2></div>
                <button type="button" onClick={() => onNavigate(tab)} className="sentinel-text-link">Abrir sección <ArrowRight size={14} /></button>
              </div>
              {story ? <StoryCard article={story} onOpen={onSelectArticle} onSave={onToggleSaveArticle} /> : <StoryEmpty text="Esperando la primera actualización de esta edición." />}
            </div>;
          })}
        </section>
        <LivePreview />
      </div>

      {!!rest.length && <section aria-label="Más actualidad" className="space-y-3">
        <div className="flex justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><Newspaper size={18} className="text-emerald-300" /> Más actualidad</h2><button type="button" className="sentinel-text-link" onClick={() => onNavigate('news')}>Todas las noticias <ArrowRight size={14} /></button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rest.map(article => <StoryCard key={article.id} article={article} onOpen={onSelectArticle} onSave={onToggleSaveArticle} />)}</div>
      </section>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="sentinel-card p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={16} className="text-emerald-300" /> Ciberseguridad</h2>
          <ul className="mt-2 space-y-2">{data.vulnerabilities.slice(0, 3).map(item => <li key={item.id}><a href={item.advisoryUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-300 hover:text-emerald-300">{item.cveId} · {item.title}</a></li>)}</ul>
          <button type="button" className="sentinel-text-link mt-3" onClick={() => onNavigate('cybersecurity')}>Ver boletines <ArrowRight size={14} /></button>
        </section>
        <section className="sentinel-card p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Radio size={16} className="text-emerald-300" /> Fuentes</h2>
          <p className="mt-3 text-sm text-slate-300"><strong className="text-emerald-300">{enabled.length}</strong> habilitadas · {issues.length} con incidencias</p>
          <button type="button" className="sentinel-text-link mt-3" onClick={() => onNavigate('sources')}>Estado de las fuentes <ArrowRight size={14} /></button>
        </section>
        <section className="sentinel-card p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><FileText size={16} className="text-emerald-300" /> Seguimiento</h2>
          <ul className="mt-2 space-y-2">{alerts.slice(0, 2).map(alert => <li key={alert.id}>{alert.article ? <button type="button" onClick={() => onSelectArticle(alert.article!)} className="text-left text-xs text-slate-300 hover:text-emerald-300">{alert.title}</button> : <a href={alert.url} target="_blank" rel="noreferrer" className="text-xs text-slate-300 hover:text-emerald-300">{alert.title}</a>}</li>)}</ul>
          <button type="button" className="sentinel-text-link mt-3" onClick={() => onNavigate('alerts')}>Ver alertas <ArrowRight size={14} /></button>
        </section>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate('briefing')} className="sentinel-action"><FileText size={15} /> Informe diario</button><button type="button" onClick={() => onNavigate('analyst')} className="sentinel-action"><Bot size={15} /> Analista</button><button type="button" onClick={() => onNavigate('ai')} className="sentinel-action"><Cpu size={15} /> Modelos de IA</button></div>
    </div>
  );
}
