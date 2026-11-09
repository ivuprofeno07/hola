import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, ExternalLink, Search, Flame, Terminal, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Vulnerability } from '../lib/types';
import { i18n } from '../i18n/translations';
import { formatearFecha } from '../utils/formatters';

interface CybersecurityViewProps {
  vulnerabilities: Vulnerability[];
  loading: boolean;
  kevOnly?: boolean;
  vulnerabilityCatalog?: boolean;
}

export const CybersecurityView: React.FC<CybersecurityViewProps> = ({
  vulnerabilities,
  loading,
  kevOnly = false,
  vulnerabilityCatalog = false
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = vulnerabilities.filter(v => {
    if (kevOnly && !v.isKevExploited && v.status !== 'KEV_EXPLOITED') return false;
    if (severityFilter === 'KEV') {
      if (!v.isKevExploited && v.status !== 'KEV_EXPLOITED') return false;
    } else if (severityFilter !== 'all') {
      if (v.severity !== severityFilter) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.cveId.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.affectedProducts.some(p => p.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getCvssBadge = (score: number | null) => {
    if (score === null || score === undefined || isNaN(score)) {
      return 'bg-slate-800 text-slate-400 border-slate-700/60';
    }
    if (score >= 9.0) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (score >= 7.0) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Warning Banner */}
      <div className="sentinel-card rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                {kevOnly ? 'Amenazas explotadas (CISA KEV)' : vulnerabilityCatalog ? 'Catálogo de vulnerabilidades' : i18n.cybersecurity.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {i18n.cybersecurity.subtitle}
              </p>
            </div>
          </div>

          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por CVE, producto, fabricante..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#121724] border border-[#212B3E] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#182030] text-xs font-mono">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider mr-1">Filtrar por nivel:</span>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'KEV', label: 'CISA KEV (Explotadas)' },
            { id: 'CRITICAL', label: 'Críticas (CVSS ≥ 9.0)' },
            { id: 'HIGH', label: 'Altas (CVSS 7.0 - 8.9)' },
            { id: 'MEDIUM', label: 'Medias' },
            { id: 'LOW', label: 'Bajas' },
            { id: 'N/D', label: 'N/D' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSeverityFilter(f.id)} aria-pressed={severityFilter === f.id}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                severityFilter === f.id
                  ? f.id === 'KEV' || f.id === 'CRITICAL'
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : 'bg-violet-600 text-white font-bold shadow-sm'
                  : 'bg-[#121724] text-slate-400 hover:text-slate-200 hover:bg-[#1A2234] border border-[#212B3E]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vulnerabilities List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="sentinel-card rounded-xl p-8 text-center text-xs text-slate-400">
            {i18n.cybersecurity.empty}
          </div>
        ) : (
          filtered.map(vuln => (
            <div
              key={vuln.id}
              className="sentinel-card hover:border-rose-500/40 rounded-xl p-5 transition-all space-y-3.5 shadow-sm"
            >
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-mono font-bold text-slate-100 bg-[#121724] px-2.5 py-1 rounded-md border border-[#212B3E]">
                    {vuln.cveId}
                  </span>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${getCvssBadge(vuln.cvssScore)}`}>
                    CVSS {vuln.cvssScore !== null && vuln.cvssScore !== undefined ? vuln.cvssScore.toFixed(1) : 'N/D'} • {vuln.severity}
                  </span>
                  {(vuln.status === 'KEV_EXPLOITED' || vuln.isKevExploited) && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <Flame size={11} className="text-rose-400 animate-pulse" />
                      {i18n.cybersecurity.badges.kevExploited}
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                  <span>{vuln.source} · Publicado: {formatearFecha(vuln.publishedAt)}</span>
                  <a
                    href={vuln.advisoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                    title="Boletín de Seguridad Oficial"
                  >
                    <span>Boletín Oficial</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{vuln.title}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{vuln.description}</p>
              </div>

              {/* Affected products */}
              <div className="pt-2 border-t border-[#182030] flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-slate-400 text-[10px] uppercase">Componentes Afectados:</span>
                {vuln.affectedProducts.map((prod, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-[#121724] text-slate-300 border border-[#212B3E] text-[11px]"
                  >
                    {prod}
                  </span>
                ))}
              </div>

              {/* Remediation directive */}
              {vuln.remediation && (
                <div className="p-3 rounded-lg bg-[#141A28] border border-amber-500/25 flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-bold text-amber-300 text-[11px] uppercase mr-2">
                      {i18n.cybersecurity.remediationLabel}
                    </span>
                    <span className="text-slate-300 leading-relaxed">{vuln.remediation}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};


