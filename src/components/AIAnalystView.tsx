import React, { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, Copy, Check, Terminal, Shield, RefreshCw, RotateCcw } from 'lucide-react';
import { askAiAnalyst } from '../lib/api';
import { i18n } from '../i18n/translations';
import { formatearHora } from '../utils/formatters';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const AIAnalystView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: "Pregunta por una noticia, un CVE, un modelo o un repositorio. Consultaré los registros disponibles en Sentinel.",
      timestamp: formatearHora(new Date(), false)
    }
  ]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/status', { signal: controller.signal }).then(response => response.json())
      .then(data => setConfigured(Boolean(data.configured))).catch(() => {});
    return () => controller.abort();
  }, []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const samplePrompts = i18n.aiAnalyst.quickQuestions;

  const handleSend = async (queryText?: string) => {
    const q = queryText || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: formatearHora(new Date(), false)
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const answer = await askAiAnalyst(q, history);
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: formatearHora(new Date(), false)
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error al consultar el servicio de análisis: ${err.message}. Verifica la conexión con el servidor de SENTINEL.`,
          timestamp: formatearHora(new Date(), false)
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const [copyError, setCopyError] = useState(false);
  const handleCopy = async (content: string, id: string) => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { setCopyError(true); }
  };

  const resetSession = () => {
    setMessages(messages.slice(0, 1));
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {configured === false && <p className="sentinel-card px-4 py-3 text-xs text-slate-300">Modo local. Para activar Gemini, añade GEMINI_API_KEY a .env.local y reinicia Sentinel.</p>}
      {copyError && <p role="alert" className="p-2 text-xs text-rose-300">No se pudo copiar la respuesta.</p>}
      {/* Header bar */}
      <div className="sentinel-card rounded-t-xl p-4 shrink-0 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-violet-500/20">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              {i18n.aiAnalyst.title}
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                FUNDAMENTADO EN BD
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              {i18n.aiAnalyst.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={resetSession}
          disabled={loading}
          aria-label="Reiniciar sesión"
          className="text-xs font-mono text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-md hover:bg-[#151C2C] border border-transparent hover:border-[#212B3E] transition-all flex items-center gap-1.5"
          title={i18n.aiAnalyst.clearHistory}
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Reiniciar Sesión</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-[#080B11] border-x border-[#1E2638] p-4 sm:p-6 space-y-4 custom-scrollbar">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-mono text-slate-400 px-1">
              <span>{msg.role === 'user' ? 'OPERADOR' : 'ANALISTA SENTINEL'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-2xl rounded-xl p-4 text-xs leading-relaxed relative group shadow-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/40 text-slate-100'
                  : 'sentinel-card text-slate-200'
              }`}
            >
                            <div className="whitespace-pre-wrap break-words">{msg.content.split(/(https?:\/\/[^\s<>()]+)/g).map((part, index) =>
                /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer" className="text-emerald-300 underline">{part}</a> : part
              )}</div>

              {msg.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(msg.content, msg.id)}
                  className="absolute top-3 right-3 p-1 rounded-md bg-[#151C2C] text-slate-400 hover:text-white border border-[#212B3E] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copiar respuesta"
                >
                  {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <div className="text-[10px] font-mono text-slate-400 mb-1 px-1">
              ANALISTA SENTINEL • PROCESANDO
            </div>
            <div className="sentinel-card rounded-xl p-4 flex items-center space-x-2.5 text-xs text-slate-300 shadow-sm">
              <RefreshCw size={14} className="animate-spin text-cyan-400" />
              <span>{i18n.aiAnalyst.thinking}</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      <div className="bg-[#0D121D] border-x border-[#1E2638] px-4 py-2.5 flex items-center space-x-2 overflow-x-auto text-[11px] font-mono custom-scrollbar">
        <span className="text-slate-400 shrink-0 text-[10px] uppercase font-semibold">Consultas Rápidas:</span>
        {samplePrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="px-2.5 py-1 rounded-md bg-[#121724] hover:bg-[#1A2234] border border-[#212B3E] text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="sentinel-card rounded-b-xl p-3 shrink-0 shadow-sm">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={i18n.aiAnalyst.placeholder}
            disabled={loading}
            className="min-w-0 flex-1 px-3.5 py-2 rounded-lg bg-[#121724] border border-[#212B3E] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/60 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-40 shadow-sm"
          >
            <span>{i18n.aiAnalyst.send}</span>
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};


