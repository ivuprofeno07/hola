import React, { useState } from 'react';
import { X, ExternalLink, Bookmark, Sparkles, Calendar, User, Globe, Share2, Check } from 'lucide-react';
import { Article } from '../lib/types';
import { fetchArticleTakeaway } from '../lib/api';
import { formatearFechaCompleta } from '../utils/formatters';

interface ArticleDrawerProps {
  article: Article | null;
  onClose: () => void;
  onToggleSave: (id: string) => void;
}

export const ArticleDrawer: React.FC<ArticleDrawerProps> = ({
  article,
  onClose,
  onToggleSave
}) => {
  const [takeaway, setTakeaway] = useState<string[] | null>(null);
  const [loadingTakeaway, setLoadingTakeaway] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!article) return null;

  const handleGenerateTakeaway = async () => {
    setLoadingTakeaway(true);
    try {
      const bullets = await fetchArticleTakeaway(article.title, article.description);
      setTakeaway(bullets);
    } catch {
      setTakeaway(['No se pudo generar el resumen. Puedes consultar la publicación original.']);
    } finally {
      setLoadingTakeaway(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(article.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-[#070B10] border-l border-emerald-500/25 shadow-2xl flex flex-col h-full z-10">
        {/* Top bar */}
        <div className="h-16 border-b border-emerald-500/20 px-5 flex items-center justify-between shrink-0 bg-[#090D14]">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-semibold">
              {article.category}
            </span>
            <span className="text-xs font-mono text-slate-300 font-semibold">{article.isExample ? 'Ejemplo guardado' : article.source}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggleSave(article.id)}
              className={`p-1.5 rounded-md hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/30 transition-colors ${
                article.isSaved ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Guardar noticia"
            >
              <Bookmark size={15} fill={article.isSaved ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/30 transition-colors"
              title="Copiar enlace"
            >
              {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/30 transition-colors"
              aria-label="Cerrar panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {article.imageUrl && (
            <div className="w-full h-52 rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/25 shadow-sm">
              <img src={article.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-100 leading-snug font-serif">{article.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-emerald-400" />
                {formatearFechaCompleta(article.publishedAt)}
              </span>
              {article.author && (
                <span className="flex items-center gap-1">
                  <User size={12} className="text-emerald-400" />
                  {article.author}
                </span>
              )}
            </div>
          </div>

          {/* AI Takeaway Section */}
          <div className="bg-[#0B1017] border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                SÍNTESIS ESTRATÉGICA DE IA
              </span>
              {!takeaway && (
                <button
                  onClick={handleGenerateTakeaway}
                  disabled={loadingTakeaway}
                  className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 disabled:opacity-50 font-semibold"
                >
                  {loadingTakeaway ? 'Generando...' : 'Sintetizar 3 Puntos Clave →'}
                </button>
              )}
            </div>

            {takeaway ? (
              <ul className="space-y-2 text-xs text-slate-200">
                {takeaway.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Genera un análisis sintético estructurado mediante IA con el contexto multidisciplinar de SENTINEL.
              </p>
            )}
          </div>

          {/* Description & Full Extract */}
          <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
            <p className="font-medium text-slate-200 text-sm leading-relaxed">{article.description}</p>
            {article.content && <p className="text-slate-300 leading-relaxed">{article.content}</p>}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="pt-3 border-t border-emerald-500/20">
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1.5 font-semibold">Entidades Etiquetadas:</span>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0D131C] text-slate-300 border border-emerald-500/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-emerald-500/20 bg-[#090D14] shrink-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-full bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-400/60 text-emerald-300 hover:text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <span>Abrir noticia original en {article.source}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
};
