import React, { useState } from 'react';
import { GraduationCap, FileText, Download, ExternalLink, Search, Sparkles, BookOpen, Quote } from 'lucide-react';
import { ResearchPaper } from '../lib/types';
import { i18n } from '../i18n/translations';
import { formatearFecha } from '../utils/formatters';

interface ResearchViewProps {
  papers: ResearchPaper[];
  loading: boolean;
}

export const ResearchView: React.FC<ResearchViewProps> = ({ papers, loading }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [source, setSource] = useState('all');

  const filtered = papers.filter(p => {
    if (source !== 'all' && (p.id.startsWith('arxiv-') ? 'arxiv' : 'openalex') !== source) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.authors.some(a => a.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="sentinel-card rounded-xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <GraduationCap size={18} className="text-violet-400" />
            <span>{i18n.headerTitles.research.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {i18n.headerTitles.research.subtitle}
          </p>
        </div>

        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar preprints, autores, términos..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#121724] border border-[#212B3E] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition-colors"
          />
        </div>
      </div>

      <label className="block text-sm text-slate-300">Fuente <select value={source} onChange={event => setSource(event.target.value)} className="ml-2 rounded-lg border border-slate-700 bg-[#101722] p-2 text-sm"><option value="all">Todas</option><option value="arxiv">arXiv</option><option value="openalex">OpenAlex</option></select></label>
      {!filtered.length && <p className="sentinel-card p-4 text-sm text-slate-400">{loading ? 'Consultando publicaciones…' : 'No hay publicaciones para estos filtros.'}</p>}
      <div className="space-y-4">
        {filtered.map(paper => {
          const isExpanded = expandedId === paper.id;
          return (
            <div
              key={paper.id}
              className="sentinel-card hover:border-violet-500/40 rounded-xl p-5 transition-all space-y-3.5 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 uppercase font-semibold">
                      {paper.primaryCategory}
                    </span>
                    {paper.arxivId && (
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        arXiv:{paper.arxivId}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">
                      {paper.id.startsWith("arxiv-") ? "arXiv" : "OpenAlex"} · {formatearFecha(paper.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 hover:text-cyan-300 transition-colors">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Autores: {paper.authors.join(', ')}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0 pt-1">
                  {paper.pdfUrl && (
                    <a
                      href={paper.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-[#121724] hover:bg-[#1A2234] border border-[#212B3E] text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <Download size={13} className="text-cyan-400" />
                      <span>Descargar PDF</span>
                    </a>
                  )}
                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1A2234]"
                      title="Ver Cita DOI"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Abstract */}
              <p className={`text-xs text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                {paper.summary}
              </p>
              <button
                onClick={() => setExpandedId(isExpanded ? null : paper.id)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono font-medium"
              >
                {isExpanded ? 'Contraer resumen' : 'Leer resumen completo →'}
              </button>

              {/* AI Strategic Takeaway */}
              {paper.aiTakeaway && (
                <div className="p-3.5 rounded-lg bg-gradient-to-r from-violet-950/25 to-indigo-950/20 border border-violet-500/30 flex items-start gap-2.5 text-xs">
                  <Sparkles size={14} className="text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-bold text-violet-300 text-[10px] uppercase mr-2">
                      Síntesis Ejecutiva SENTINEL IA:
                    </span>
                    <span className="text-slate-200 leading-relaxed">{paper.aiTakeaway}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


