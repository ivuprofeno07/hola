import { useState } from 'react';
import { ArrowUpRight, Bookmark, Globe2, MapPin, Newspaper, Trophy } from 'lucide-react';
import type { Article } from '../lib/types';
import { formatearFechaCompleta } from '../utils/formatters';

export const storyLabels: Partial<Record<Article['category'], string>> = {
  spain: 'España', football: 'Fútbol', world: 'Mundo', tech: 'Tecnología', ai: 'IA', security: 'Ciberseguridad',
  sports: 'Deportes', science: 'Ciencia', economy: 'Economía', business: 'Empresas', dev: 'Desarrollo'
};

export function StoryArtwork({ article, eager = false }: { article: Article; eager?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const category = article.category;
  const Icon = category === 'spain' ? MapPin : category === 'football' || category === 'sports' ? Trophy : Globe2;
  return <span className={'editorial-art editorial-art--' + category} aria-hidden="true">
    <span className="editorial-art-symbol"><Icon size={80} strokeWidth={1} /></span>
    {article.imageUrl && failed !== article.imageUrl && <img src={article.imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(article.imageUrl)} />}
  </span>;
}

export function StoryCard({ article, onOpen, onSave, featured = false }: {
  article: Article;
  onOpen: (article: Article) => void;
  onSave?: (id: string) => void;
  featured?: boolean;
}) {
  return (
    <article className={'editorial-card ' + (featured ? 'editorial-card--featured' : '')}>
      <button type="button" className="editorial-card-main" onClick={() => onOpen(article)}>
        <span className="editorial-card-cover"><StoryArtwork article={article} eager={featured} /><span className={'edition-tag edition-tag--' + article.category}>{storyLabels[article.category] ?? 'Noticias'}</span></span>
        <span className="editorial-card-copy">
          <span className="editorial-kicker">{article.isExample ? 'Ejemplo guardado' : article.source}</span>
          <span className="editorial-card-title">{article.title}</span>
          {featured && article.description && <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-300">{article.description}</span>}
        </span>
      </button>
      <div className="editorial-card-footer">
        <time dateTime={article.publishedAt}>{formatearFechaCompleta(article.publishedAt)}</time>
        <div className="flex shrink-0 gap-1">
          {onSave && <button type="button" onClick={() => onSave(article.id)} className="editorial-icon" aria-label={article.isSaved ? 'Quitar de guardados' : 'Guardar noticia'} aria-pressed={Boolean(article.isSaved)}><Bookmark size={16} fill={article.isSaved ? 'currentColor' : 'none'} /></button>}
          {article.url && <a href={article.url} target="_blank" rel="noreferrer" className="editorial-icon" aria-label={'Abrir fuente original de ' + article.title}><ArrowUpRight size={16} /></a>}
        </div>
      </div>
    </article>
  );
}

export function StoryEmpty({ text }: { text: string }) {
  return <p className="sentinel-card flex items-center gap-3 p-5 text-sm text-slate-400"><Newspaper size={20} className="shrink-0 text-emerald-400" />{text}</p>;
}
