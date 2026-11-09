import { db } from './db';
import { formatArticle, liveArticles, safeSourceUrl } from './dataRecords';
import type { WatchlistAlert } from '../src/lib/types';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function getWatchlistMatches(watchlistId?: string) {
  const rules = db.prepare('SELECT id, title, keyword, item_type FROM watchlists').all() as { id: string; title: string; keyword: string; item_type: string }[];
  const activeRules = watchlistId ? rules.filter(rule => rule.id === watchlistId) : rules;
  if (!activeRules.length) return [];
  const articles = db.prepare(`
    SELECT * FROM articles WHERE ${liveArticles}
      AND julianday(published_at) BETWEEN julianday('now', '-30 days') AND julianday('now', '+5 minutes')
    ORDER BY julianday(published_at) DESC LIMIT 1000
  `).all();
  const cves = db.prepare(`
    SELECT cve_id, title, description, published_at, modified_at, advisory_url, source
    FROM vulnerabilities WHERE id NOT LIKE 'vuln-%'
    AND julianday(COALESCE(modified_at, published_at)) >= julianday('now', '-30 days')
    ORDER BY julianday(COALESCE(modified_at, published_at)) DESC LIMIT 1000
  `).all() as any[];
  const candidates = [
    ...articles.map(row => {
      const article = formatArticle(row);
      return { key: article.id, title: article.title, source: article.source, timestamp: article.publishedAt,
        url: article.url, article, text: normalize(article.title + ' ' + article.description) };
    }),
    ...cves.flatMap(row => {
      const url = safeSourceUrl(row.advisory_url);
      return url ? [{ key: row.cve_id, title: row.cve_id + ' · ' + row.title, source: row.source,
        timestamp: row.modified_at ?? row.published_at, url, article: undefined,
        text: normalize(row.cve_id + ' ' + row.title + ' ' + row.description) }] : [];
    })
  ];
  const alerts: WatchlistAlert[] = [];
  for (const rule of activeRules) {
    const terms = rule.keyword.split(',').map(normalize).filter(Boolean);
    if (!terms.length) continue;
    for (const item of candidates) {
      if (rule.item_type === 'cve' && item.article && item.article.category !== 'security') continue;
      if (rule.item_type === 'team' && item.article?.category !== 'football' && item.article?.category !== 'sports') continue;
      if (rule.item_type === 'model' && item.article?.category !== 'ai' && item.article?.category !== 'tech') continue;
      if (rule.item_type === 'repo' && item.article?.category !== 'dev' && item.article?.category !== 'tech') continue;
      if (rule.item_type === 'company' && !item.article) continue;
      const haystack = ' ' + item.text + ' ';
      if (!terms.some(term => haystack.includes(' ' + term + ' '))) continue;
      const { text, key, ...target } = item;
      alerts.push({ ...target, id: rule.id + '/' + key, watchlistId: rule.id, watchlistTitle: rule.title });
    }
  }
  return alerts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
