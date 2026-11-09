import {
  syncHackerNews,
  syncCisaKev,
  syncRssFeed,
  syncGitHubTrending,
  syncArxiv,
  syncOpenAlex,
  syncOpenRouterModels,
  syncHuggingFaceTrending,
  syncNpmDownloads,
  syncPyPiReleases,
  syncDevToArticles,
  syncNvdCvssEnrichment,
  syncEpssScores,
  syncOsvVulnerabilities,
  syncFrankfurterRates,
  syncCoinGeckoPrices,
  syncWorldBankData,
  syncMarketIndices,
  syncTheSportsDb,
  syncEspnScoreboard,
  syncOpenF1Sessions,
  syncUsgsEarthquakes,
  syncNasaEonet,
  logSyncEvent,
  SyncResult
} from './connectors/liveConnectors';
import { db } from './db';
import { editorialFeeds } from './editorialFeeds';

let isSyncRunning = false;
const activeIntervals: NodeJS.Timeout[] = [];
const sourceSyncs = new Map<string, Promise<SyncResult>>();

export function isSynchronizationActive(): boolean {
  return isSyncRunning;
}

/**
 * Trigger manual or programmatic synchronization for any registered source
 */
export async function triggerSourceSync(sourceId: string): Promise<SyncResult> {
  const source = db.prepare('SELECT name, enabled FROM sources WHERE id = ?').get(sourceId) as
    { name: string; enabled: number } | undefined;
  if (!source) throw new Error(`Unknown source: ${sourceId}`);

  if (!source.enabled) {
    return {
      sourceId,
      sourceName: source.name,
      success: false,
      recordsCount: 0,
      durationMs: 0,
      message: 'Source is paused.'
    };
  }

  const activeSync = sourceSyncs.get(sourceId);
  if (activeSync) return activeSync;

  const sync = runSourceSync(sourceId).finally(() => sourceSyncs.delete(sourceId));
  sourceSyncs.set(sourceId, sync);
  return sync;
}

async function runSourceSync(sourceId: string): Promise<SyncResult> {
  const feed = editorialFeeds.find(item => item.id === sourceId);
  if (feed) return syncRssFeed(feed.id, feed.name, feed.url, feed.category, '', feed);
  console.log(`[SENTINEL SCHEDULER] Triggering sync for source: ${sourceId}`);

  switch (sourceId) {
    // 1. Tech & News Feeds
    case 'hacker-news':
      return await syncHackerNews();
    case 'devto-articles':
      return await syncDevToArticles();
    case 'techcrunch-rss':
      return await syncRssFeed(
        'techcrunch-rss',
        'TechCrunch Feed',
        'https://techcrunch.com/feed/',
        'tech',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
      );
    case 'the-verge-rss':
      return await syncRssFeed(
        'the-verge-rss',
        'The Verge RSS',
        'https://www.theverge.com/rss/index.xml',
        'tech',
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80'
      );
    case 'wired-rss':
      return await syncRssFeed(
        'wired-rss',
        'Wired Science & Tech',
        'https://www.wired.com/feed/rss',
        'science',
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80'
      );
    case 'ars-technica-rss':
      return await syncRssFeed(
        'ars-technica-rss',
        'Ars Technica Feed',
        'https://feeds.arstechnica.com/arstechnica/index',
        'tech',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80'
      );
    case 'bbc-world-rss':
      return await syncRssFeed(
        'bbc-world-rss',
        'BBC World News',
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'world',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80'
      );
    case 'nasa-rss':
      return await syncRssFeed(
        'nasa-rss',
        'NASA Official Feed',
        'https://www.nasa.gov/feed/',
        'science',
        'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&auto=format&fit=crop&q=80'
      );
    case 'nature-rss':
      return await syncRssFeed(
        'nature-rss',
        'Nature Science Feed',
        'https://www.nature.com/nature.rss',
        'science',
        'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80'
      );
    case 'gdelt-doc':
      // Stable source ID retains the user's settings after the provider change.
      return await syncRssFeed('gdelt-doc', 'MIT Technology Review · IA',
        'https://www.technologyreview.com/topic/artificial-intelligence/feed', 'ai', '', { language: 'en', country: 'US' });

    // 2. Cybersecurity
    case 'cisa-kev':
      return await syncCisaKev();
    case 'nvd-nist':
      return await syncNvdCvssEnrichment();
    case 'first-epss':
      return await syncEpssScores();
    case 'osv-dev':
      return await syncOsvVulnerabilities();
    case 'bleeping-security-rss':
      return await syncRssFeed(
        'bleeping-security-rss',
        'BleepingComputer Security',
        'https://www.bleepingcomputer.com/feed/',
        'security',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80'
      );
    case 'krebs-security-rss':
      return await syncRssFeed(
        'krebs-security-rss',
        'Krebs on Security',
        'https://krebsonsecurity.com/feed/',
        'security',
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80'
      );

    // 3. AI Models & Developer
    case 'openrouter-models':
      return await syncOpenRouterModels();
    case 'huggingface-models':
      return await syncHuggingFaceTrending();
    case 'github-trending':
      return await syncGitHubTrending();
    case 'npm-downloads':
      return await syncNpmDownloads();
    case 'pypi-releases':
      return await syncPyPiReleases();

    // 4. Research
    case 'arxiv-ai':
      return await syncArxiv();
    case 'openalex-science':
      return await syncOpenAlex();

    // 5. Economy & Markets
    case 'frankfurter-fx':
      return await syncFrankfurterRates();
    case 'coingecko-crypto':
      return await syncCoinGeckoPrices();
    case 'world-bank-data':
      return await syncWorldBankData();
    case 'stooq-indices':
      return await syncMarketIndices();

    // 6. Sports
    case 'marca-rss':
      return await syncRssFeed(
        'marca-rss',
        'MARCA Deportes RSS',
        'https://e00-marca.uecdn.es/rss/portada.xml',
        'sports',
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80'
      );
    case 'thesportsdb':
      return await syncTheSportsDb();
    case 'espn-scoreboard':
      return await syncEspnScoreboard();
    case 'openf1-motorsport':
      return await syncOpenF1Sessions();

    // 7. Science & Disasters
    case 'usgs-earthquakes':
      return await syncUsgsEarthquakes();
    case 'nasa-eonet':
      return await syncNasaEonet();
    case 'nasa-apod':
      return await syncRssFeed('nasa-apod', 'NASA · Imagen astronómica del día',
        'https://science.nasa.gov/feed/apod-basic/', 'science', '', { language: 'en', country: 'US' });

    default: {
      const sourceName = String(db.prepare('SELECT name FROM sources WHERE id = ?').get(sourceId)?.name ?? sourceId);
      const message = 'La fuente no tiene un conector registrado.';
      logSyncEvent(sourceId, sourceName, false, 0, 0, message);
      return { sourceId, sourceName, success: false, recordsCount: 0, durationMs: 0, message };
    }
  }
}

export async function syncAllActiveSources(): Promise<SyncResult[]> {
  if (isSyncRunning) {
    console.warn('[SENTINEL SCHEDULER] Sync request skipped: concurrent cycle already in progress.');
    throw new Error('Synchronization cycle already active. Please wait for current sync to finish.');
  }

  isSyncRunning = true;
  console.log('[SENTINEL SCHEDULER] Running global synchronization cycle with lock acquired...');
  try {
    const activeSources = db.prepare('SELECT id FROM sources WHERE enabled = 1').all() as { id: string }[];
    const results: SyncResult[] = [];

    for (const s of activeSources) {
      try {
        const res = await triggerSourceSync(s.id);
        results.push(res);
      } catch (err: any) {
        results.push({
          sourceId: s.id,
          sourceName: s.id,
          success: false,
          recordsCount: 0,
          durationMs: 0,
          message: err.message
        });
      }
    }

    return results;
  } finally {
    isSyncRunning = false;
    console.log('[SENTINEL SCHEDULER] Global synchronization cycle finished. Lock released.');
  }
}

/**
 * Autonomous daemon with tiered intervals respecting API constraints
 */
export function startBackgroundScheduler() {
  if (activeIntervals.length > 0) return;
  const syncEditorial = () => { void Promise.allSettled(editorialFeeds.map(feed => triggerSourceSync(feed.id))); };
  setTimeout(syncEditorial, 1500);
  activeIntervals.push(setInterval(syncEditorial, 10 * 60 * 1000));

  console.log('[SENTINEL SCHEDULER] Initializing autonomous background synchronization daemon with customized intervals...');

  // Staggered cold-start warmup (first 25 seconds)
  setTimeout(() => {
    triggerSourceSync('frankfurter-fx').catch(console.error);
    triggerSourceSync('coingecko-crypto').catch(console.error);
    triggerSourceSync('hacker-news').catch(console.error);
    triggerSourceSync('cisa-kev').catch(console.error);
  }, 4000);

  setTimeout(() => {
    triggerSourceSync('espn-scoreboard').catch(console.error);
    triggerSourceSync('arxiv-ai').catch(console.error);
    triggerSourceSync('openrouter-models').catch(console.error);
  }, 12000);

  setTimeout(() => {
    triggerSourceSync('usgs-earthquakes').catch(console.error);
    triggerSourceSync('nasa-eonet').catch(console.error);
    triggerSourceSync('github-trending').catch(console.error);
  }, 20000);

  // 1. Tier 5 minutes: Real-time FX, Crypto, ESPN livescores
  const interval5m = setInterval(async () => {
    try {
      await triggerSourceSync('frankfurter-fx');
      await triggerSourceSync('coingecko-crypto');
      await triggerSourceSync('espn-scoreboard');
    } catch (e) {
      console.error('[SCHEDULER 5m error]', e);
    }
  }, 5 * 60 * 1000);
  activeIntervals.push(interval5m);

  // 2. Tier 15 minutes: Stooq market indices, USGS Earthquakes
  const interval15m = setInterval(async () => {
    try {
      await triggerSourceSync('stooq-indices');
      await triggerSourceSync('usgs-earthquakes');
    } catch (e) {
      console.error('[SCHEDULER 15m error]', e);
    }
  }, 15 * 60 * 1000);
  activeIntervals.push(interval15m);

  // 3. Tier 30 minutes: Main News & Tech RSS feeds, Hacker News, Dev.to
  const interval30m = setInterval(async () => {
    try {
      await triggerSourceSync('hacker-news');
      await triggerSourceSync('devto-articles');
      await triggerSourceSync('techcrunch-rss');
      await triggerSourceSync('the-verge-rss');
      await triggerSourceSync('wired-rss');
      await triggerSourceSync('ars-technica-rss');
      await triggerSourceSync('bbc-world-rss');
      await triggerSourceSync('marca-rss');
      await triggerSourceSync('bleeping-security-rss');
      await triggerSourceSync('krebs-security-rss');
    } catch (e) {
      console.error('[SCHEDULER 30m error]', e);
    }
  }, 30 * 60 * 1000);
  activeIntervals.push(interval30m);

  // 4. Tier 1 hour: GitHub Search, CISA KEV, TheSportsDB, NASA EONET, NVD CVSS enrichment
  const interval1h = setInterval(async () => {
    try {
      await triggerSourceSync('github-trending');
      await triggerSourceSync('cisa-kev');
      await triggerSourceSync('thesportsdb');
      await triggerSourceSync('nasa-eonet');
      await triggerSourceSync('nvd-nist');
    } catch (e) {
      console.error('[SCHEDULER 1h error]', e);
    }
  }, 60 * 60 * 1000);
  activeIntervals.push(interval1h);

  // 5. Tier 2 hours: GDELT Global AI news
  const interval2h = setInterval(async () => {
    try {
      await triggerSourceSync('gdelt-doc');
    } catch (e) {
      console.error('[SCHEDULER 2h error]', e);
    }
  }, 2 * 3600 * 1000);
  activeIntervals.push(interval2h);

  // 6. Tier 6 hours: arXiv AI Research, Hugging Face models, OpenF1, EPSS FIRST, OSV
  const interval6h = setInterval(async () => {
    try {
      await triggerSourceSync('arxiv-ai');
      await triggerSourceSync('huggingface-models');
      await triggerSourceSync('openf1-motorsport');
      await triggerSourceSync('first-epss');
      await triggerSourceSync('osv-dev');
    } catch (e) {
      console.error('[SCHEDULER 6h error]', e);
    }
  }, 6 * 3600 * 1000);
  activeIntervals.push(interval6h);

  // 7. Tier 12 hours: OpenRouter models catalog, OpenAlex, npm downloads, PyPI releases, NASA APOD, Nature RSS
  const interval12h = setInterval(async () => {
    try {
      await triggerSourceSync('openrouter-models');
      await triggerSourceSync('openalex-science');
      await triggerSourceSync('npm-downloads');
      await triggerSourceSync('pypi-releases');
      await triggerSourceSync('nasa-apod');
      await triggerSourceSync('nature-rss');
      await triggerSourceSync('nasa-rss');
    } catch (e) {
      console.error('[SCHEDULER 12h error]', e);
    }
  }, 12 * 3600 * 1000);
  activeIntervals.push(interval12h);

  // 8. Tier 24 hours: World Bank Macroeconomic Data
  const interval24h = setInterval(async () => {
    try {
      await triggerSourceSync('world-bank-data');
    } catch (e) {
      console.error('[SCHEDULER 24h error]', e);
    }
  }, 24 * 3600 * 1000);
  activeIntervals.push(interval24h);
}
