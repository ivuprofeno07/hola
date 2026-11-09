import { Article, ArticleCluster } from '../lib/types';

/**
 * Normalizes a URL by stripping tracking parameters (utm_*, ref, etc.) and protocol trailing slashes.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.hash = '';
    // Strip common tracking queries
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        lower.startsWith('utm_') ||
        lower === 'fbclid' ||
        lower === 'gclid' ||
        lower === 'ref' ||
        lower === 'source' ||
        lower === 'campaign'
      ) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach(param => url.searchParams.delete(param));
    let clean = url.toString();
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Normalizes text to token set for linguistic overlap calculation.
 */
export function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'with',
    'by', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'from', 'up', 'down', 'de', 'la', 'el', 'en', 'y', 'un', 'una', 'los', 'las', 'por', 'con', 'para', 'del'
  ]);

  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard similarity coefficient between two token sets (0.0 to 1.0).
 */
export function calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersectionCount = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) {
      intersectionCount++;
    }
  });
  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Determines whether two articles represent duplicates or reports of the exact same event.
 */
export function isDuplicateArticle(a: { title: string; url: string }, b: { title: string; url: string }): boolean {
  if (normalizeUrl(a.url) === normalizeUrl(b.url)) {
    return true;
  }
  const tokensA = tokenize(a.title);
  const tokensB = tokenize(b.title);
  const sim = calculateJaccardSimilarity(tokensA, tokensB);
  // High title similarity means same event coverage
  return sim >= 0.65;
}

/**
 * Groups related articles into event clusters.
 */
export function clusterArticles(articles: Article[], similarityThreshold = 0.45): ArticleCluster[] {
  const clusters: ArticleCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (assigned.has(article.id)) continue;

    const currentGroup: Article[] = [article];
    assigned.add(article.id);
    const tokensPrimary = tokenize(article.title);

    for (let j = i + 1; j < articles.length; j++) {
      const candidate = articles[j];
      if (assigned.has(candidate.id)) continue;

      const sameUrl = Boolean(article.url && candidate.url && normalizeUrl(article.url) === normalizeUrl(candidate.url));
      if (!sameUrl && Math.abs(Date.parse(article.publishedAt) - Date.parse(candidate.publishedAt)) > 72 * 3600000) continue;

      // Must be same category or both related
      if (article.category !== candidate.category && article.category !== 'world' && candidate.category !== 'world') {
        continue;
      }

      const tokensCandidate = tokenize(candidate.title);
      const similarity = calculateJaccardSimilarity(tokensPrimary, tokensCandidate);

      if (sameUrl || similarity >= similarityThreshold) {
        currentGroup.push(candidate);
        assigned.add(candidate.id);
      }
    }

    const uniqueSources = Array.from(new Set(currentGroup.map(a => a.source)));
    const latestDate = currentGroup.reduce((latest, a) => {
      return new Date(a.publishedAt) > new Date(latest) ? a.publishedAt : latest;
    }, currentGroup[0].publishedAt);

    clusters.push({
      id: `cluster-${article.id}`,
      title: article.title,
      category: article.category,
      articleCount: currentGroup.length,
      sources: uniqueSources,
      articles: currentGroup,
      latestPublishedAt: latestDate,
    });
  }

  // Sort clusters by latest published date
  return clusters.sort((a, b) => new Date(b.latestPublishedAt).getTime() - new Date(a.latestPublishedAt).getTime());
}
