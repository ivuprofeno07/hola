import { db } from './db';

export function saveMarketObservation(item: {
  id: string; symbol: string; name: string; category: string; value: number;
  unit: string; observedAt: string; source: string; changePercent?: number;
}) {
  if (!Number.isFinite(item.value) || !Number.isFinite(Date.parse(item.observedAt))) return 0;
  const result = db.prepare(`
    INSERT INTO economic_indicators
      (id, symbol, name, category, value, unit, change, change_percent, updated_at, source, sparkline, change_known)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, '[]', ?)
    ON CONFLICT(id) DO UPDATE SET
      symbol = excluded.symbol, name = excluded.name, value = excluded.value, unit = excluded.unit,
      change = 0, change_percent = excluded.change_percent, updated_at = excluded.updated_at,
      source = excluded.source, sparkline = '[]', change_known = excluded.change_known
    WHERE economic_indicators.source <> excluded.source
       OR julianday(excluded.updated_at) >= julianday(economic_indicators.updated_at)
  `).run(item.id, item.symbol, item.name, item.category, item.value, item.unit, item.changePercent ?? 0,
    item.observedAt, item.source, Number(item.changePercent !== undefined));
  return Number(result.changes);
}
