import type { Article, BriefingSource } from '../src/lib/types';
import { db } from './db';

export const liveArticles = "id NOT LIKE 'art-%' AND NOT (id LIKE 'apod-%' AND (title = 'NASA APOD: NASA Science' OR url LIKE '%nasa-logo%'))";
export const liveModels = "(id LIKE 'openrouter-%' OR id LIKE 'hf-%')";
export const liveRepositories = "id NOT LIKE 'repo-%'";
export const liveResearch = "id NOT LIKE 'paper-%'";
export const liveMarkets = "source IN ('Frankfurter / BCE', 'CoinGecko Live API', 'Banco Mundial (PIB Anual)', 'Stooq Market Data', 'FRED', 'Yahoo Finance')";

export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* A source may have no public URL. */ }
}

export function formatArticle(row: any): Article {
  return {
    id: row.id, title: row.title, description: row.description ?? '', content: row.content,
    source: row.source, author: row.author, category: row.category, publishedAt: row.published_at,
    fetchedAt: row.fetched_at, url: safeSourceUrl(row.url) ?? '', imageUrl: safeSourceUrl(row.image_url),
    language: row.language, country: row.country, tags: row.tags ? JSON.parse(row.tags) : [],
    isSaved: Boolean(row.is_saved), isRead: Boolean(row.is_read), isExample: row.id.startsWith('art-')
  };
}

export function recentSources(limit = 8): BriefingSource[] {
  const rows = db.prepare(`
    SELECT title, source, published_at, url FROM articles
    WHERE ${liveArticles} AND julianday(published_at) BETWEEN julianday('now', '-2 days') AND julianday('now', '+5 minutes')
    ORDER BY julianday(published_at) DESC LIMIT ?
  `).all(limit) as { title: string; source: string; published_at: string; url: string }[];
  return rows.flatMap(row => {
    const url = safeSourceUrl(row.url);
    return url ? [{ title: row.title, source: row.source, publishedAt: row.published_at, url }] : [];
  });
}
