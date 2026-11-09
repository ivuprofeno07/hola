import React, { useState } from 'react';
import { FileText, Sparkles, RefreshCw, Copy, Check, Download, ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react';
import { DailyBriefing } from '../lib/types';
import { generateBriefing } from '../lib/api';
import { i18n } from '../i18n/translations';
import { formatearFechaCompleta } from '../utils/formatters';

interface DailyBriefingViewProps {
  briefing: DailyBriefing | null;
  onRefreshBriefing: () => Promise<void>;
  loading: boolean;
}

export const DailyBriefingView: React.FC<DailyBriefingViewProps> = ({
  briefing,
  onRefreshBriefing,
  loading
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(false);
    try {
      await onRefreshBriefing();
    } catch {
      setError(true);
    } finally {
      setGenerating(false);
    }
  };

  const [copyError, setCopyError] = useState(false);
  const handleCopyMarkdown = async () => {
    if (!briefing) return;
    const md = `# ${briefing.title}
Fecha: ${briefing.date}

## RESUMEN EJECUTIVO
${briefing.executiveSummary}

## ASPECTOS CLAVE
${briefing.highlights.map(h => `- ${h}`).join('\n')}

## HECHOS VERIFICADOS
${briefing.confirmedFacts.map(f => `- [VERIFICADO] ${f}`).join('\n')}

## TENDENCIAS OBSERVABLES
${briefing.trendsObserved.map(t => `- ${t}`).join('\n')}

## FUENTES
${(briefing.sources ?? []).map(item => `- ${item.source} · ${item.title}\n  ${item.url}`).join('\n')}

---
Generado automáticamente por SENTINEL — Global Intelligence Platform
`;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError(true); }
  };

  if (!briefing && loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-20 bg-[#0D121D] rounded-xl border border-[#1E2638]"></div>
        <div className="h-64 bg-[#0D121D] rounded-xl border border-[#1E2638]"></div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <FileText size={32} className="mx-auto text-slate-500" />
        {error && <p role="alert" className="text-rose-300">No se pudo generar el informe.</p>}
        <p className="text-slate-300">Aún no se ha generado ningún informe diario consolidado.</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-all"
        >
          {generating ? 'Generando...' : 'Generar Informe Diario Ahora'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {error && <p role="alert" className="text-rose-300">No se pudo generar el informe.</p>}
      {copyError && <p role="alert" className="text-sm text-rose-300">No se pudo copiar el informe.</p>}
      {!!briefing.sources?.length && <section className="sentinel-card p-4">
        <h2 className="font-sans text-base font-semibold">Fuentes del informe</h2>
        <ul className="mt-2 divide-y divide-slate-800">
          {briefing.sources.map(source => <li key={source.url} className="py-2"><a href={source.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-300 hover:underline">{source.title}</a><p className="text-xs text-slate-400">{source.source} · {formatearFechaCompleta(source.publishedAt)}</p></li>)}
        </ul>
      </section>}
      <div className="sentinel-card rounded-xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
            DOSSIER ESTRATÉGICO SENTINEL
          </span>
          <h2 className="text-lg font-bold text-slate-100">{briefing.title}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Fecha de emisión: {formatearFechaCompleta(briefing.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#121724] hover:bg-[#1A2234] border border-[#212B3E] text-slate-300 hover:text-white text-xs font-mono transition-colors shadow-sm"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copiado' : 'Copiar en Markdown'}</span>
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md disabled:opacity-50"
          >
            <Sparkles size={13} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Sintetizando...' : 'Regenerar Dossier'}</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Callout */}
      <div className="bg-gradient-to-r from-[#141A28] via-[#0D121D] to-[#121724] border border-violet-500/30 rounded-xl p-5 space-y-2.5 shadow-sm">
        <span className="text-[10px] font-mono font-bold uppercase text-violet-300 tracking-wider flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-cyan-400" />
          RESUMEN EJECUTIVO DE INTELIGENCIA
        </span>
        <p className="text-sm text-slate-200 leading-relaxed font-normal">{briefing.executiveSummary}</p>
      </div>

      {/* Key Highlights */}
      <div className="sentinel-card rounded-xl p-5 space-y-3.5 shadow-sm">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
          Aspectos Estratégicos y Conclusiones Clave
        </h3>
        <ul className="space-y-2.5">
          {briefing.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5"></span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {briefing.categories.map((cat, i) => (
          <div key={i} className="sentinel-card rounded-xl p-4 space-y-2 shadow-sm">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 uppercase font-semibold">
              {cat.category}
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{cat.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};


