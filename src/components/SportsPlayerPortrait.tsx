import { useEffect, useState } from 'react';
import type { SportsPlayer } from '../lib/types';

export interface Portrait {
  url: string;
  creditUrl: string;
  credit: string;
}

export function usePlayerPortraits(players: SportsPlayer[]) {
  const ids = [...new Set(players.flatMap(player => player.football && player.espnId && !player.photo ? [player.espnId] : []))].sort().slice(0, 60).join(',');
  const [result, setResult] = useState<{ ids: string; data: Record<string, Portrait> }>();
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    void fetch('/api/sports/portraits?' + new URLSearchParams({ ids }), { signal: controller.signal })
      .then(response => response.ok ? response.json() : {})
      .then(data => { if (!controller.signal.aborted) setResult({ ids, data }); })
      .catch(() => {});
    return () => controller.abort();
  }, [ids]);
  return result?.ids === ids ? result.data : {};
}

export function SportsPlayerPortrait({ player, portrait, large = false }: { player: SportsPlayer; portrait?: Portrait; large?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const url = player.photo ?? portrait?.url;
  const size = large ? 'size-9' : 'size-7';
  const initials = player.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  if (!url || failed === url) return <span aria-hidden="true" title="Retrato no disponible" className={size + ' grid shrink-0 place-items-center rounded-full bg-slate-800 text-[9px] font-semibold text-slate-300'}>{initials}</span>;
  const photo = <img src={url} alt="" loading="lazy" className={size + ' shrink-0 rounded-full border border-slate-700 bg-slate-900 object-cover object-top'} onError={() => setFailed(url)} />;
  return portrait && !player.photo ? <a href={portrait.creditUrl} target="_blank" rel="noreferrer" title={portrait.credit} aria-label={'Créditos del retrato de ' + player.name + ' · ' + portrait.credit} className="inline-flex shrink-0 rounded-full">{photo}</a> : photo;
}
