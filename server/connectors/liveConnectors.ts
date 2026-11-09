import { saveMarketObservation } from '../marketData';
import { db } from '../db';
import crypto from 'node:crypto';
import { parseRssOrAtomXml } from '../../src/utils/feedParser';

export interface SyncResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  recordsCount: number;
  durationMs: number;
  message: string;
}

/**
 * Fetch timeout helper
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      headers: {
        'User-Agent': 'Sentinel-Intelligence-Platform/1.0 (+https://sentinel.internal)',
        Accept: 'application/json, text/xml, application/xml, text/csv, */*',
        ...(options.headers || {})
      }
  });
}

/**
 * Helper to update source health and sync log in SQLite
 */
export function logSyncEvent(
  sourceId: string,
  sourceName: string,
  success: boolean,
  durationMs: number,
  recordsCount: number,
  message: string
) {
  const status = success ? 'SUCCESS' : 'ERROR';
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO sync_logs (id, source_id, source_name, status, timestamp, duration_ms, records_fetched, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      sourceName,
      status,
      now,
      durationMs,
      recordsCount,
      message
    );

    db.prepare(`
      UPDATE sources
      SET status = ?,
          last_sync = ?,
          response_time_ms = ?,
          records_count = records_count + ?,
          error_count = CASE WHEN ? = 1 THEN error_count ELSE error_count + 1 END
      WHERE id = ?
    `).run(
      success ? 'HEALTHY' : /\b429\b/.test(message) ? 'RATE_LIMITED' : 'ERROR',
      now,
      durationMs,
      recordsCount,
      success ? 1 : 0,
      sourceId
    );
  } catch (err) {
    console.error('[SENTINEL] Failed to record sync log in DB:', err);
  }
}

// -------------------------------------------------------------
// 1. NOTICIAS Y ARTÍCULOS (RSS / ATOM / HACKER NEWS / DEV.TO)
// -------------------------------------------------------------

export async function syncHackerNews(): Promise<SyncResult> {
  const sourceId = 'hacker-news';
  const sourceName = 'Hacker News API';
  const startTime = Date.now();

  try {
    const topIdsRes = await fetchWithTimeout('https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=15&orderBy="$key"');
    if (!topIdsRes.ok) throw new Error(`HTTP ${topIdsRes.status}`);
    const storyIds: number[] = await topIdsRes.json();
    const top10 = storyIds.slice(0, 10);

    const insertOrReplace = db.prepare(`
      INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title, published_at = excluded.published_at
    `);

    let count = 0;
    for (const id of top10) {
      try {
        const itemRes = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {}, 4000);
        if (!itemRes.ok) continue;
        const item = await itemRes.json();
        if (!item || !item.title || !item.url) continue;

        insertOrReplace.run(
          `hn-${item.id}`,
          item.title,
          `Hacker News discussion: ${item.score || 0} points, ${item.descendants || 0} comments by ${item.by || 'anonymous'}.`,
          `Original submission on Hacker News with ${item.score} upvotes.`,
          'Hacker News',
          item.by || 'HN Community',
          'tech',
          new Date((item.time || Date.now() / 1000) * 1000).toISOString(),
          new Date().toISOString(),
          item.url,
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
          'en',
          'US',
          JSON.stringify(['Tech', 'HackerNews', 'Engineering', 'OpenSource'])
        );
        count++;
      } catch {
        // Individual item fetch failure: proceed
      }
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Successfully synced ${count} Hacker News stories.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} items` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `HN sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncRssFeed(
  sourceId: string,
  sourceName: string,
  feedUrl: string,
  category: import('../../src/lib/types').Article['category'],
  fallbackImage: string,
  edition?: { language: string; country: string }
): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout(feedUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const items = parseRssOrAtomXml(xml, sourceName, fallbackImage)
      .filter(item => Date.parse(item.publishedAt) <= Date.now() + 5 * 60000)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    if (edition && !items.length) throw new Error('El canal no devolvió noticias con fecha válida');

    const insertOrReplace = db.prepare(`
      INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        published_at = excluded.published_at,
        fetched_at = excluded.fetched_at,
        image_url = COALESCE(NULLIF(excluded.image_url, ''), articles.image_url),
        category = CASE WHEN excluded.category IN ('spain', 'football') THEN excluded.category ELSE articles.category END,
        source = CASE WHEN excluded.category IN ('spain', 'football') THEN excluded.source ELSE articles.source END,
        language = CASE WHEN excluded.category IN ('spain', 'football') THEN excluded.language ELSE articles.language END,
        country = CASE WHEN excluded.category IN ('spain', 'football') THEN excluded.country ELSE articles.country END
      WHERE articles.category NOT IN ('spain', 'football') OR excluded.category IN ('spain', 'football')
    `);

    let count = 0;
    const isSpanish = sourceId.includes('marca') || sourceId.includes('es');

    for (const item of items.slice(0, edition ? 30 : 15)) {
      const id = `rss-${crypto.createHash('sha256').update(item.url).digest('hex').slice(0, 20)}`;
      insertOrReplace.run(
        id,
        item.title,
        item.description,
        item.description,
        sourceName,
        item.author,
        category,
        item.publishedAt,
        new Date().toISOString(),
        item.url,
        item.imageUrl || fallbackImage,
        edition?.language ?? (isSpanish ? 'es' : 'en'),
        edition?.country ?? (isSpanish ? 'ES' : 'US'),
        JSON.stringify([category.toUpperCase(), sourceName])
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} articles from ${sourceName}`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} articles` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `RSS feed sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncDevToArticles(): Promise<SyncResult> {
  const sourceId = 'devto-articles';
  const sourceName = 'DEV Community API';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://dev.to/api/articles?top=7&per_page=15');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const articles = await res.json();

    const insertOrReplace = db.prepare(`
      INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 'dev', ?, ?, ?, ?, 'en', 'US', ?, 0, 0)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title, description = excluded.description
    `);

    let count = 0;
    for (const art of articles) {
      if (!art.title || !art.url) continue;
      const id = `devto-${art.id}`;
      insertOrReplace.run(
        id,
        art.title,
        art.description || 'Developer article on DEV Community.',
        art.description || '',
        'DEV Community',
        art.user?.name || 'DEV Contributor',
        art.published_at || new Date().toISOString(),
        new Date().toISOString(),
        art.url,
        art.cover_image || art.social_image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
        JSON.stringify(art.tag_list || ['programming', 'dev'])
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} articles from DEV.to`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} dev articles` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `DEV.to sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

// -------------------------------------------------------------
// 2. INVESTIGACIÓN CIENTÍFICA (ARXIV & OPENALEX)
// -------------------------------------------------------------

export async function syncArxiv(): Promise<SyncResult> {
  const sourceId = 'arxiv-ai';
  const sourceName = 'arXiv Open Research API';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout(
      'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20',
      {},
      9000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    const entries = xml.match(entryRegex) || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO research_papers (id, title, summary, authors, published_at, category, primary_category, arxiv_id, doi, pdf_url, citations_count, ai_takeaway)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        pdf_url = excluded.pdf_url
    `);

    let count = 0;
    for (const entryXml of entries) {
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/i);
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/i);
      const pubMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/i);
      const catMatch = entryXml.match(/<arxiv:primary_category[^>]+term=["']([^"']+)["']/i);
      const doiMatch = entryXml.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i);

      if (!idMatch || !titleMatch) continue;

      const rawId = idMatch[1].trim();
      const arxivId = rawId.split('/abs/').pop() || rawId;
      const title = titleMatch[1].replace(/[\r\n\t]+/g, ' ').replace(/<[^>]+>/g, '').trim();
      const summary = (summaryMatch ? summaryMatch[1] : '').replace(/[\r\n\t]+/g, ' ').replace(/<[^>]+>/g, '').trim();
      const publishedAt = pubMatch ? new Date(pubMatch[1].trim()).toISOString() : new Date().toISOString();
      const primaryCategory = catMatch ? catMatch[1].trim() : 'cs.AI';
      const doi = doiMatch ? doiMatch[1].trim() : null;

      // Authors
      const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
      const authors: string[] = [];
      let m;
      while ((m = authorRegex.exec(entryXml)) !== null) {
        if (m[1]) authors.push(m[1].trim());
      }

      const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
      const takeaway = `Paper científico de ${primaryCategory}: avances metodológicos verificados en preprint oficial.`;

      insertOrReplace.run(
        `arxiv-${arxivId}`,
        title,
        summary,
        JSON.stringify(authors.slice(0, 6)),
        publishedAt,
        'Inteligencia Artificial',
        primaryCategory,
        arxivId,
        doi,
        pdfUrl,
        takeaway
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} papers from arXiv.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} arXiv papers` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `arXiv sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncOpenAlex(): Promise<SyncResult> {
  const sourceId = 'openalex-science';
  const sourceName = 'OpenAlex Scientific Works';
  const startTime = Date.now();

  try {
    const mailto = process.env.ADMIN_EMAIL || 'sentinel-intel@example.com';
    const year = new Date().getFullYear();
    const url = `https://api.openalex.org/works?filter=from_publication_date:${year - 1}-01-01&sort=cited_by_count:desc&per-page=20&mailto=${encodeURIComponent(mailto)}`;

    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const works = data.results || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO research_papers (id, title, summary, authors, published_at, category, primary_category, arxiv_id, doi, pdf_url, citations_count, ai_takeaway)
      VALUES (?, ?, ?, ?, ?, 'Computer Science', 'Scientific Research', null, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        citations_count = excluded.citations_count,
        doi = excluded.doi,
        pdf_url = excluded.pdf_url
    `);

    let count = 0;
    for (const w of works) {
      if (!w.title || !w.id) continue;
      const cleanId = `openalex-${w.id.split('/').pop() || w.id}`;
      const authors = (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean);

      let summary = w.title;
      if (w.abstract_inverted_index) {
        const words: [string, number][] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) {
            words.push([word, pos]);
          }
        }
        words.sort((a, b) => a[1] - b[1]);
        summary = words.map(x => x[0]).join(' ').slice(0, 450);
      }

      insertOrReplace.run(
        cleanId,
        w.title,
        summary,
        JSON.stringify(authors.slice(0, 5)),
        w.publication_date ? new Date(w.publication_date).toISOString() : new Date().toISOString(),
        w.doi || null,
        w.primary_location?.pdf_url || w.open_access?.oa_url || null,
        w.cited_by_count || 0,
        `Trabajo con alto impacto en OpenAlex (${w.cited_by_count || 0} citas).`
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} scientific works from OpenAlex.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} OpenAlex papers` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `OpenAlex sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

// -------------------------------------------------------------
// 3. MODELOS DE IA Y DESARROLLO (OPENROUTER, HUGGING FACE, GITHUB)
// -------------------------------------------------------------

export async function syncOpenRouterModels(): Promise<SyncResult> {
  const sourceId = 'openrouter-models';
  const sourceName = 'OpenRouter Models Catalog';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models = json.data || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO ai_models (id, name, provider, release_date, capabilities, modalities, context_window, pricing_input_1m, pricing_output_1m, license, official_url, docs_url, status, mmlu_score, math_score, code_score, latency_ms, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', null, null, null, null, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        context_window = excluded.context_window,
        pricing_input_1m = excluded.pricing_input_1m,
        pricing_output_1m = excluded.pricing_output_1m,
        notes = excluded.notes
    `);

    let count = 0;
    // Map top 25 models
    for (const m of models.slice(0, 25)) {
      if (!m.id || !m.name) continue;

      const providerRaw = m.id.split('/')[0] || 'OpenRouter';
      const provider = providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);

      const pricingInput1M = m.pricing?.prompt ? parseFloat(m.pricing.prompt) * 1000000 : undefined;
      const pricingOutput1M = m.pricing?.completion ? parseFloat(m.pricing.completion) * 1000000 : undefined;

      insertOrReplace.run(
        `openrouter-${m.id.replace('/', '-')}`,
        m.name,
        provider,
        new Date().toISOString().split('T')[0],
        JSON.stringify(['chat', 'completion', 'reasoning']),
        JSON.stringify(['text', 'code']),
        m.context_length || null,
        pricingInput1M !== undefined && !isNaN(pricingInput1M) ? pricingInput1M : null,
        pricingOutput1M !== undefined && !isNaN(pricingOutput1M) ? pricingOutput1M : null,
        'Proprietary / OpenRouter API',
        `https://openrouter.ai/models/${m.id}`,
        'https://openrouter.ai/docs',
        `Catálogo público OpenRouter. Ventana de contexto: ${m.context_length || null} tokens.`
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} AI models from OpenRouter.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} models` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `OpenRouter sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncHuggingFaceTrending(): Promise<SyncResult> {
  const sourceId = 'huggingface-models';
  const sourceName = 'Hugging Face Hub API';
  const startTime = Date.now();

  try {
    let res = await fetchWithTimeout('https://huggingface.co/api/models?sort=trendingScore&limit=20', {}, 8000);
    if (!res.ok) {
      res = await fetchWithTimeout('https://huggingface.co/api/models?sort=downloads&limit=20', {}, 8000);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const models = await res.json();

    const insertOrReplace = db.prepare(`
      INSERT INTO ai_models (id, name, provider, release_date, capabilities, modalities, context_window, pricing_input_1m, pricing_output_1m, license, official_url, docs_url, status, mmlu_score, math_score, code_score, latency_ms, notes)
      VALUES (?, ?, ?, ?, ?, ?, null, null, null, 'Consultar ficha', ?, ?, 'active', null, null, null, null, ?)
      ON CONFLICT(id) DO UPDATE SET
        notes = excluded.notes
    `);

    let count = 0;
    for (const m of (Array.isArray(models) ? models : []).slice(0, 15)) {
      if (!m.id) continue;
      const provider = (m.id.split('/')[0] || 'Community').replace(/-/g, ' ');

      insertOrReplace.run(
        `hf-${m.id.replace('/', '-')}`,
        m.id.split('/').pop() || m.id,
        provider,
        new Date().toISOString().split('T')[0],
        JSON.stringify([m.pipeline_tag || 'text-generation']),
        JSON.stringify(['weights', 'open-source']),
        `https://huggingface.co/${m.id}`,
        `https://huggingface.co/${m.id}#readme`,
        `Hugging Face Trending: ${m.downloads || 0} descargas, ${m.likes || 0} likes.`
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} models from Hugging Face.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} HF models` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `Hugging Face sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncGitHubTrending(): Promise<SyncResult> {
  const sourceId = 'github-trending';
  const sourceName = 'GitHub REST API';
  const startTime = Date.now();
  const dateAgo = (days: number) => new Date(startTime - days * 86400000).toISOString().slice(0, 10);
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const baseQuery = `is:public archived:false fork:false pushed:>=${dateAgo(30)}`;
  const queries = [
    { id: 'popular', query: baseQuery + ' stars:>=1000' },
    { id: 'emerging', query: `${baseQuery} created:>=${dateAgo(90)} stars:>=50` },
  ];

  try {
    const collections = [];
    for (const item of queries) {
      const query = new URLSearchParams({ q: item.query, sort: 'stars', order: 'desc', per_page: '36' });
      const response = await fetchWithTimeout('https://api.github.com/search/repositories?' + query, { headers }, 12000);
      if (!response.ok) {
        const rateLimited = response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
        throw new Error(rateLimited ? 'HTTP 429 · Límite de búsqueda de GitHub' : `GitHub HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.incomplete_results || !Array.isArray(data.items) || !data.items.length) {
        throw new Error('GitHub no devolvió una clasificación completa');
      }
      collections.push({ id: item.id, repos: data.items });
    }

    const now = new Date().toISOString();
    const previousStars = db.prepare('SELECT stars FROM repositories WHERE id = ?');
    const saveRepo = db.prepare(`
      INSERT INTO repositories (id, name, full_name, description, owner, language, stars, forks, open_issues, updated_at, license, url, growth_rate, topics)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, full_name = excluded.full_name, description = excluded.description,
        owner = excluded.owner, language = excluded.language, stars = excluded.stars, forks = excluded.forks,
        open_issues = excluded.open_issues, updated_at = excluded.updated_at, license = excluded.license,
        url = excluded.url, growth_rate = excluded.growth_rate, topics = excluded.topics
    `);
    const saveRank = db.prepare('INSERT INTO github_rankings VALUES (?, ?, ?, ?, ?, ?)');
    const seen = new Set<string>();
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM github_rankings');
      for (const collection of collections) {
        for (const [index, repo] of collection.repos.entries()) {
          if (!Number.isInteger(repo.id) || !Number.isFinite(repo.stargazers_count)
            || !Number.isFinite(Date.parse(repo.pushed_at)) || !Number.isFinite(Date.parse(repo.created_at))
            || !/^https:\/\/github\.com\//.test(repo.html_url ?? '')) {
            throw new Error('GitHub devolvió datos incompletos de un repositorio');
          }
          const id = 'gh-' + repo.id;
          if (!seen.has(id)) {
            const previous = previousStars.get(id)?.stars;
            const difference = typeof previous === 'number' ? repo.stargazers_count - previous : 0;
            saveRepo.run(id, repo.name, repo.full_name, repo.description ?? '', repo.owner?.login ?? '',
              repo.language ?? 'Sin lenguaje principal', repo.stargazers_count, repo.forks_count ?? 0,
              repo.open_issues_count ?? 0, repo.updated_at ?? repo.pushed_at,
              repo.license?.spdx_id === 'NOASSERTION' ? null : repo.license?.spdx_id ?? null, repo.html_url,
              difference > 0 ? `+${difference} estrellas desde la consulta anterior` : null,
              JSON.stringify(Array.isArray(repo.topics) ? repo.topics : []));
            seen.add(id);
          }
          saveRank.run(collection.id, id, index + 1, now, repo.pushed_at, repo.created_at);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const durationMs = Date.now() - startTime;
    const message = `${seen.size} repositorios de GitHub en dos clasificaciones.`;
    logSyncEvent(sourceId, sourceName, true, durationMs, seen.size, message);
    return { sourceId, sourceName, success: true, recordsCount: seen.size, durationMs, message };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logSyncEvent(sourceId, sourceName, false, durationMs, 0, message);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs, message };
  }
}

const prepareRadarSignal = () => db.prepare(`
  INSERT INTO tech_radar (id, name, quadrant, ring, description, trending_score, metrics, is_new)
  VALUES (?, ?, ?, 'assess', ?, 0, ?, 0)
  ON CONFLICT(id) DO UPDATE SET metrics = excluded.metrics
`);

export async function syncNpmDownloads(): Promise<SyncResult> {
  const sourceId = 'npm-downloads';
  const sourceName = 'npm Registry Downloads API';
  const startTime = Date.now();

  const packages = ['react', 'vue', 'tailwindcss', 'vite', 'typescript', 'next', 'svelte', 'hono'];
  let count = 0;

  try {
    const saveRadarSignal = prepareRadarSignal();
    for (const pkg of packages) {
      try {
        const res = await fetchWithTimeout(`https://api.npmjs.org/downloads/point/last-week/${pkg}`, {}, 4000);
        if (!res.ok) continue;
        const data = await res.json();
        if (Number.isFinite(data.downloads) && typeof data.start === 'string' && typeof data.end === 'string') {
          count += Number(saveRadarSignal.run('npm-' + pkg, pkg, 'languages_frameworks',
            'Actividad publicada por el registro npm.',
            `${data.downloads.toLocaleString('es-ES')} descargas · ${data.start} a ${data.end}`).changes);
        }
      } catch {
        // Individual package failure: skip
      }
    }

    const duration = Date.now() - startTime;
    if (!count) throw new Error('npm no devolvió datos utilizables');
    logSyncEvent(sourceId, sourceName, true, duration, count, `Updated adoption metrics for ${count} npm packages.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Updated ${count} packages` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `npm downloads sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncPyPiReleases(): Promise<SyncResult> {
  const sourceId = 'pypi-releases';
  const sourceName = 'PyPI JSON API';
  const startTime = Date.now();

  const packages = ['torch', 'transformers', 'fastapi', 'langchain', 'pydantic'];
  let count = 0;

  try {
    const saveRadarSignal = prepareRadarSignal();
    for (const pkg of packages) {
      try {
        const res = await fetchWithTimeout(`https://pypi.org/pypi/${pkg}/json`, {}, 4000);
        if (!res.ok) continue;
        const data = await res.json();
        const version = data.info?.version;
        if (typeof version === 'string' && version) {
          count += Number(saveRadarSignal.run('pypi-' + pkg, pkg, 'tools',
            'Última versión publicada en el registro de paquetes de Python.',
            `Versión ${version} · consulta ${new Date().toISOString().slice(0, 10)}`).changes);
        }
      } catch {
        // Skip individual failure
      }
    }

    const duration = Date.now() - startTime;
    if (!count) throw new Error('PyPI no devolvió datos utilizables');
    logSyncEvent(sourceId, sourceName, true, duration, count, `Checked ${count} PyPI packages.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Checked ${count} packages` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `PyPI sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

// -------------------------------------------------------------
// 4. CIBERSEGURIDAD (CISA KEV, NVD CVSS, FIRST EPSS, OSV)
// -------------------------------------------------------------

export async function syncCisaKev(): Promise<SyncResult> {
  const sourceId = 'cisa-kev';
  const sourceName = 'CISA KEV Catalog';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const vulns = (data.vulnerabilities || []).slice(0, 15);

    const insertOrReplace = db.prepare(`
      INSERT INTO vulnerabilities (id, cve_id, title, description, severity, cvss_score, affected_products, published_at, modified_at, source, status, advisory_url, remediation, is_kev_exploited)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(cve_id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        remediation = excluded.remediation,
        is_kev_exploited = 1
    `);

    let count = 0;
    for (const v of vulns) {
      if (!v.cveID) continue;
      // Do NOT invent CVSS; mark N/D unless verified from NVD
      insertOrReplace.run(
        `cisa-${v.cveID}`,
        v.cveID,
        `${v.vendorProject || 'Vendor'} ${v.product || 'Product'} ${v.vulnerabilityName || 'Vulnerability'}`,
        v.shortDescription || 'Known actively exploited security vulnerability catalogued by CISA.',
        'N/D',
        null,
        JSON.stringify([`${v.vendorProject || 'Vendor'} ${v.product || 'Product'}`]),
        new Date(v.dateAdded || Date.now()).toISOString(),
        new Date().toISOString(),
        'CISA KEV Catalog',
        'KEV_EXPLOITED',
        `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
        v.requiredAction || 'Apply vendor updates per CISA binding operational directive.'
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Successfully synced ${count} CISA exploited vulnerabilities.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} CVEs` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `CISA KEV sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncNvdCvssEnrichment(): Promise<SyncResult> {
  const sourceId = 'nvd-nist';
  const sourceName = 'NVD / NIST CVE API';
  const startTime = Date.now();

  try {
    // Find CVEs with cvss_score is null (cached in SQLite so we do not re-query already scored CVEs)
    const pendingCves = db.prepare(`
      SELECT cve_id FROM vulnerabilities
      WHERE cvss_score IS NULL
      LIMIT 4
    `).all() as { cve_id: string }[];

    if (pendingCves.length === 0) {
      return {
        sourceId,
        sourceName,
        success: true,
        recordsCount: 0,
        durationMs: Date.now() - startTime,
        message: 'All CVEs currently enriched with verified CVSS in SQLite cache.'
      };
    }

    const headers: Record<string, string> = {};
    if (process.env.NVD_API_KEY) {
      headers.apiKey = process.env.NVD_API_KEY;
    }

    let enriched = 0;
    const updateStmt = db.prepare(`
      UPDATE vulnerabilities
      SET cvss_score = ?, severity = ?
      WHERE cve_id = ?
    `);

    for (const item of pendingCves) {
      try {
        const res = await fetchWithTimeout(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${item.cve_id}`,
          { headers },
          5000
        );
        if (!res.ok) continue;
        const data = await res.json();
        const vuln = data.vulnerabilities?.[0]?.cve;
        if (!vuln) continue;

        // Extract CVSS v3.1, v3.0, or v2.0
        const metrics = vuln.metrics || {};
        const v31 = metrics.cvssMetricV31?.[0]?.cvssData;
        const v30 = metrics.cvssMetricV30?.[0]?.cvssData;
        const v20 = metrics.cvssMetricV2?.[0]?.cvssData;

        const score = v31?.baseScore ?? v30?.baseScore ?? v20?.baseScore ?? null;
        let severity = v31?.baseSeverity ?? v30?.baseSeverity ?? (score >= 9.0 ? 'CRITICAL' : score >= 7.0 ? 'HIGH' : 'MEDIUM');

        if (score !== null && score !== undefined) {
          updateStmt.run(score, severity.toUpperCase(), item.cve_id);
          enriched++;
        }
      } catch {
        // Individual rate limit: proceed
      }
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, enriched, `Enriched ${enriched} CVEs with official NVD CVSS scores.`);
    return { sourceId, sourceName, success: true, recordsCount: enriched, durationMs: duration, message: `Enriched ${enriched} CVEs` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `NVD sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncEpssScores(): Promise<SyncResult> {
  const sourceId = 'first-epss';
  const sourceName = 'FIRST EPSS API';
  const startTime = Date.now();

  try {
    const recentCves = db.prepare('SELECT cve_id FROM vulnerabilities LIMIT 10').all() as { cve_id: string }[];
    if (recentCves.length === 0) {
      return { sourceId, sourceName, success: true, recordsCount: 0, durationMs: Date.now() - startTime, message: 'No CVEs to query' };
    }

    const cveList = recentCves.map(c => c.cve_id).join(',');
    const res = await fetchWithTimeout(`https://api.first.org/data/v1/epss?cve=${cveList}`, {}, 6000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const scores = data.data || [];

    let count = 0;
    const updateStmt = db.prepare(`
      UPDATE vulnerabilities
      SET remediation = remediation || ' [EPSS: ' || ? || '% prob. explotación]'
      WHERE cve_id = ? AND remediation NOT LIKE '%EPSS:%'
    `);

    for (const s of scores) {
      if (s.cve && s.epss) {
        const pct = (parseFloat(s.epss) * 100).toFixed(1);
        updateStmt.run(pct, s.cve);
        count++;
      }
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced EPSS exploitation probabilities for ${count} CVEs.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} EPSS scores` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `EPSS sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncOsvVulnerabilities(): Promise<SyncResult> {
  const sourceId = 'osv-dev';
  const sourceName = 'OSV Open Source Vulnerabilities';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name: 'express', ecosystem: 'npm' } })
    }, 6000);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const vulns = data.vulns || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO vulnerabilities (id, cve_id, title, description, severity, cvss_score, affected_products, published_at, modified_at, source, status, advisory_url, remediation, is_kev_exploited)
      VALUES (?, ?, ?, ?, ?, null, ?, ?, ?, 'OSV.dev', 'ANALYZED', ?, ?, 0)
      ON CONFLICT(cve_id) DO UPDATE SET modified_at = excluded.modified_at
    `);

    let count = 0;
    for (const v of vulns.slice(0, 5)) {
      const cve = v.aliases?.find((a: string) => a.startsWith('CVE-')) || v.id;
      insertOrReplace.run(
        `osv-${v.id}`,
        cve,
        v.summary || `Vulnerabilidad en paquete ${v.affected?.[0]?.package?.name || 'npm'}`,
        v.details || 'Identificada por base de datos OSV.',
        'HIGH',
        JSON.stringify([v.affected?.[0]?.package?.name || 'express']),
        v.published || new Date().toISOString(),
        v.modified || new Date().toISOString(),
        `https://osv.dev/vulnerability/${v.id}`,
        'Actualizar dependencias de paquete a versión parcheada.'
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} vulnerabilities from OSV.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} OSV advisories` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `OSV sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

// -------------------------------------------------------------
// 5. ECONOMÍA Y NEGOCIOS (FRANKFURTER, COINGECKO, WORLD BANK, STOOQ)
// -------------------------------------------------------------

export async function syncFrankfurterRates(): Promise<SyncResult> {
  const sourceId = 'frankfurter-fx';
  const sourceName = 'Frankfurter ECB FX Rates';
  const startTime = Date.now();

  try {
    let res = await fetchWithTimeout('https://api.frankfurter.dev/v1/latest?base=USD', {}, 5000);
    if (!res.ok) {
      res = await fetchWithTimeout('https://api.frankfurter.app/v1/latest?base=USD', {}, 5000);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rates = data.rates || {};

    let count = 0;
    for (const [code, id, symbol] of [['EUR', 'eurusd', 'EUR/USD'], ['GBP', 'gbpusd', 'GBP/USD'], ['JPY', 'usdjpy', 'USD/JPY']]) {
      const rate = rates[code];
      if (typeof rate !== 'number' || rate <= 0 || !data.date) continue;
      count += saveMarketObservation({
        id, symbol, name: symbol, category: 'currency', value: code === 'JPY' ? rate : 1 / rate,
        unit: code === 'JPY' ? 'JPY' : 'USD', observedAt: data.date, source: 'Frankfurter / BCE'
      });
    }
    if (!count) throw new Error('No se guardaron tipos de cambio con fecha del proveedor.');
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Updated ${count} foreign exchange rates.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Updated ${count} FX rates` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `Frankfurter sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncCoinGeckoPrices(): Promise<SyncResult> {
  const sourceId = 'coingecko-crypto';
  const sourceName = 'CoinGecko Crypto API';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',
      {},
      5000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let count = 0;
    for (const [providerId, id, symbol, name] of [['bitcoin', 'btc', 'BTC', 'Bitcoin'], ['ethereum', 'eth', 'ETH', 'Ethereum'], ['solana', 'sol', 'SOL', 'Solana']]) {
      const quote = data[providerId];
      if (!Number.isFinite(quote?.usd) || !Number.isFinite(quote?.last_updated_at)) continue;
      count += saveMarketObservation({
        id, symbol, name, category: 'crypto', value: quote.usd, unit: 'USD',
        observedAt: new Date(quote.last_updated_at * 1000).toISOString(), source: 'CoinGecko Live API',
        changePercent: Number.isFinite(quote.usd_24h_change) ? quote.usd_24h_change : undefined
      });
    }
    if (!count) throw new Error('No se guardaron cotizaciones con fecha del proveedor.');
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Updated ${count} cryptocurrency prices.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Updated ${count} crypto assets` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `CoinGecko sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncWorldBankData(): Promise<SyncResult> {
  const sourceId = 'world-bank-data';
  const sourceName = 'World Bank Open Data';
  const startTime = Date.now();

  try {
    // GDP growth annual %
    const res = await fetchWithTimeout(
      'https://api.worldbank.org/v2/country/ES;US;CN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=30',
      {},
      7000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const records = data[1] || [];

    let count = 0;
    for (const [country, code, name] of [['ESP', 'ES', 'España'], ['USA', 'US', 'Estados Unidos'], ['CHN', 'CN', 'China']]) {
      const latest = records.filter((row: any) => row.countryiso3code === country && Number.isFinite(row.value) && /^\d{4}$/.test(row.date))
        .sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
      if (!latest) continue;
      count += saveMarketObservation({
        id: 'gdp-' + code, symbol: 'PIB_' + code, name: 'Crecimiento del PIB · ' + name,
        category: 'macro', value: latest.value, unit: '%', observedAt: latest.date + '-12-31', source: 'Banco Mundial (PIB Anual)'
      });
    }
    if (!count) throw new Error('No se guardaron observaciones anuales del Banco Mundial.');
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced official macro indicators from World Bank.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Updated ${count} macro indicators` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `World Bank sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncMarketIndices(): Promise<SyncResult> {
  // Retain the existing source ID for saved settings and synchronization history.
  const sourceId = 'stooq-indices';
  const sourceName = 'Índices bursátiles · FRED y Yahoo Finance';
  const started = Date.now();
  const loadFred = async () => {
    const response = await fetchWithTimeout('https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500,NASDAQCOM', {}, 10000);
    if (!response.ok) throw new Error('FRED HTTP ' + response.status);
    const lines = (await response.text()).trim().split(/\r?\n/);
    if (!/^observation_date,SP500,NASDAQCOM$/i.test(lines.shift() ?? '')) throw new Error('Formato CSV inesperado de FRED');
    const rows = lines.map(line => line.split(','));
    return [
      { id: 'sp500', symbol: 'SP500', name: 'S&P 500', column: 1 },
      { id: 'nasdaq', symbol: 'NASDAQCOM', name: 'NASDAQ Composite', column: 2 },
    ].map(index => {
      const valid = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row[0]) && Number(row[index.column]) > 0);
      const last = valid.at(-1), previous = valid.at(-2);
      if (!last) throw new Error('FRED no devolvió ' + index.symbol);
      const value = Number(last[index.column]);
      return { ...index, category: 'index', unit: 'pts', source: 'FRED', observedAt: last[0], value,
        changePercent: previous ? (value / Number(previous[index.column]) - 1) * 100 : undefined };
    });
  };
  const loadIbex = async () => {
    const response = await fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/%5EIBEX?range=1mo&interval=1d', {}, 10000);
    if (!response.ok) throw new Error('Yahoo Finance HTTP ' + response.status);
    const data = (await response.json()).chart?.result?.[0];
    if (data?.meta?.symbol !== '^IBEX' || !Array.isArray(data.timestamp)) throw new Error('Serie IBEX 35 no disponible');
    const closes = data.indicators?.quote?.[0]?.close ?? [];
    const regular = data.meta.currentTradingPeriod?.regular;
    const observations: { date: string; value: number }[] = [];
    for (const [index, timestamp] of data.timestamp.entries()) {
      const value = closes[index];
      if (!Number.isFinite(timestamp) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
      if (regular && timestamp >= regular.start && timestamp < regular.end && Date.now() < regular.end * 1000) continue;
      observations.push({ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value });
    }
    const last = observations.at(-1), previous = observations.at(-2);
    if (!last) throw new Error('Yahoo Finance no devolvió un cierre del IBEX 35');
    return [{ id: 'ibex', symbol: '^IBEX', name: 'IBEX 35', category: 'index', unit: 'pts', source: 'Yahoo Finance',
      observedAt: last.date, value: last.value, changePercent: previous ? (last.value / previous.value - 1) * 100 : undefined }];
  };
  const results = await Promise.allSettled([loadFred(), loadIbex()]);
  const observations = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const recordsCount = observations.reduce((count, observation) => count + saveMarketObservation(observation), 0);
  const errors = results.flatMap(result => result.status === 'rejected' ? [String(result.reason?.message ?? result.reason)] : []);
  const success = errors.length === 0;
  const message = success ? 'Cierres disponibles de S&P 500, NASDAQ Composite e IBEX 35.' : errors.join(' · ');
  const durationMs = Date.now() - started;
  logSyncEvent(sourceId, sourceName, success, durationMs, recordsCount, message);
  return { sourceId, sourceName, success, durationMs, recordsCount, message };
}

// -------------------------------------------------------------
// 6. DEPORTES (THESPORTSDB, ESPN SCOREBOARD, OPENF1)
// -------------------------------------------------------------

export async function syncTheSportsDb(): Promise<SyncResult> {
  const sourceId = 'thesportsdb';
  const sourceName = 'TheSportsDB Livescore & League';
  const startTime = Date.now();

  try {
    // La Liga past matches (ID 4335)
    const resPast = await fetchWithTimeout('https://www.thesportsdb.com/api/v1/json/123/eventspastleague.php?id=4335', {}, 10000);
    if (!resPast.ok) throw new Error(`HTTP ${resPast.status}`);
    const dataPast = await resPast.json();
    const events = dataPast.events || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO sports_matches (id, sport, competition, home_team, away_team, home_score, away_score, status, match_time, minute, venue, home_crest, away_crest, source_url)
      VALUES (?, 'football', 'LaLiga EA Sports', ?, ?, ?, ?, 'FINISHED', ?, 'Finalizado', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        status = excluded.status
    `);

    let count = 0;
    for (const ev of events.slice(0, 6)) {
      if (!ev.strEvent || !ev.idEvent) continue;
      insertOrReplace.run(
        `tsdb-${ev.idEvent}`,
        ev.strHomeTeam || 'Equipo Local',
        ev.strAwayTeam || 'Equipo Visitante',
        ev.intHomeScore !== null && ev.intHomeScore !== undefined ? parseInt(ev.intHomeScore) : 0,
        ev.intAwayScore !== null && ev.intAwayScore !== undefined ? parseInt(ev.intAwayScore) : 0,
        ev.strTimestamp || new Date().toISOString(),
        ev.strVenue || 'Estadio Oficial',
        ev.strHomeTeamBadge || null,
        ev.strAwayTeamBadge || null,
        'https://www.thesportsdb.com'
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} official matches from TheSportsDB.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} matches` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `TheSportsDB sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncEspnScoreboard(): Promise<SyncResult> {
  const sourceId = 'espn-scoreboard';
  const sourceName = 'ESPN Live Scoreboard';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json'
      }
    }, 6000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = data.events || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO sports_matches (id, sport, competition, home_team, away_team, home_score, away_score, status, match_time, minute, venue, home_crest, away_crest, source_url)
      VALUES (?, 'football', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        status = excluded.status,
        minute = excluded.minute
    `);

    let count = 0;
    for (const ev of events.slice(0, 6)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;

      const statusState = ev.status?.type?.state === 'post' ? 'FINISHED' : ev.status?.type?.state === 'in' ? 'LIVE' : 'SCHEDULED';
      const minute = statusState === 'LIVE' ? `${ev.status?.displayClock || "En juego"}'` : statusState === 'FINISHED' ? 'Finalizado' : 'Programado';

      insertOrReplace.run(
        `espn-${ev.id}`,
        ev.season?.name || 'LaLiga EA Sports',
        home.team?.displayName || 'Local',
        away.team?.displayName || 'Visitante',
        home.score ? parseInt(home.score) : 0,
        away.score ? parseInt(away.score) : 0,
        statusState,
        ev.date || new Date().toISOString(),
        minute,
        comp.venue?.fullName || 'Estadio',
        home.team?.logo || null,
        away.team?.logo || null,
        'https://espn.com'
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} live match events from ESPN.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} ESPN events` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `ESPN sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncOpenF1Sessions(): Promise<SyncResult> {
  const sourceId = 'openf1-motorsport';
  const sourceName = 'OpenF1 Motorsport API';
  const startTime = Date.now();

  try {
    let res = await fetchWithTimeout('https://api.openf1.org/v1/sessions?year=2024', {}, 6000);
    if (!res.ok) {
      res = await fetchWithTimeout('https://api.openf1.org/v1/sessions?year=2023', {}, 6000);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const sessions = await res.json();

    const insertOrReplace = db.prepare(`
      INSERT INTO sports_matches (id, sport, competition, home_team, away_team, home_score, away_score, status, match_time, minute, venue, source_url)
      VALUES (?, 'motorsport', 'Fórmula 1', ?, ?, 0, 0, 'FINISHED', ?, 'Finalizado', ?, 'https://openf1.org')
      ON CONFLICT(id) DO UPDATE SET minute = excluded.minute
    `);

    let count = 0;
    for (const s of (Array.isArray(sessions) ? sessions : []).slice(0, 4)) {
      if (!s.session_name || !s.session_key) continue;
      insertOrReplace.run(
        `f1-${s.session_key}`,
        s.circuit_short_name || 'Grand Prix',
        s.session_name || 'Carrera Oficial',
        s.date_start || new Date().toISOString(),
        s.location || 'Circuito Internacional'
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} F1 sessions from OpenF1.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} F1 sessions` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `OpenF1 sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

// -------------------------------------------------------------
// 7. CIENCIA Y MUNDO (USGS TERREMOTOS, NASA EONET, NASA APOD, GDELT)
// -------------------------------------------------------------

export async function syncUsgsEarthquakes(): Promise<SyncResult> {
  const sourceId = 'usgs-earthquakes';
  const sourceName = 'USGS Earthquakes Feed';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson', {}, 6000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const features = data.features || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
      VALUES (?, ?, ?, ?, 'USGS Science', 'USGS Seismology', 'science', ?, ?, ?, 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80', 'en', 'US', ?, 0, 0)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title
    `);

    let count = 0;
    for (const f of features.slice(0, 5)) {
      const p = f.properties;
      if (!p || !p.title || !p.url) continue;

      insertOrReplace.run(
        `usgs-${f.id}`,
        p.title,
        `Magnitud ${p.mag} en ${p.place}. Profundidad y coordenadas monitorizadas por red sísmica global.`,
        `Reporte sismológico oficial: magnitud ${p.mag}, significancia ${p.sig}.`,
        new Date(p.time || Date.now()).toISOString(),
        new Date().toISOString(),
        p.url,
        JSON.stringify(['Geofísica', 'Sismología', 'USGS'])
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} significant seismic events.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} earthquakes` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `USGS sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}

export async function syncNasaEonet(): Promise<SyncResult> {
  const sourceId = 'nasa-eonet';
  const sourceName = 'NASA EONET Events';
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=15', {}, 6000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = data.events || [];

    const insertOrReplace = db.prepare(`
      INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
      VALUES (?, ?, ?, ?, 'NASA Earth Observatory', 'NASA EONET', 'science', ?, ?, ?, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80', 'en', 'GLOBAL', ?, 0, 0)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title
    `);

    let count = 0;
    for (const ev of events.slice(0, 6)) {
      if (!ev.title) continue;
      const link = ev.sources?.[0]?.url || `https://eonet.gsfc.nasa.gov/events/${ev.id}`;
      const categoryName = ev.categories?.[0]?.title || 'Fenómeno Natural';

      insertOrReplace.run(
        `eonet-${ev.id}`,
        `${categoryName}: ${ev.title}`,
        `Evento natural activo monitorizado por satélites de la NASA. Categoría: ${categoryName}.`,
        `Observatorio terrestre de la NASA registra actividad activa.`,
        ev.geometry?.[0]?.date || new Date().toISOString(),
        new Date().toISOString(),
        link,
        JSON.stringify(['NASA', 'EONET', categoryName])
      );
      count++;
    }

    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, true, duration, count, `Synced ${count} natural events from NASA EONET.`);
    return { sourceId, sourceName, success: true, recordsCount: count, durationMs: duration, message: `Synced ${count} EONET events` };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logSyncEvent(sourceId, sourceName, false, duration, 0, `NASA EONET sync failed: ${err.message}`);
    return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: duration, message: err.message };
  }
}
