import { DatabaseSync } from 'node:sqlite';
import { editorialFeeds } from './editorialFeeds';
import path from 'node:path';
import fs from 'node:fs';
import {
  Article,
  AIModel,
  Repository,
  Vulnerability,
  ResearchPaper,
  SportsMatch,
  SportsStanding,
  EconomicIndicator,
  TechRadarItem,
  SourceInfo,
  SyncLog,
  DailyBriefing,
  WatchlistItem
} from '../src/lib/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sentinel.sqlite');
export const db = new DatabaseSync(DB_PATH);
db.function('fold_text', { deterministic: true }, value => typeof value === 'string'
  ? value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() : '');

// Initialize Tables
export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      integration_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'HEALTHY',
      last_sync TEXT,
      next_sync TEXT,
      response_time_ms INTEGER DEFAULT 0,
      records_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      rate_limit TEXT DEFAULT 'Standard',
      requires_auth INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      endpoint_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      records_fetched INTEGER NOT NULL,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      source TEXT NOT NULL,
      author TEXT,
      category TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      image_url TEXT,
      language TEXT DEFAULT 'en',
      country TEXT,
      tags TEXT,
      is_saved INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      release_date TEXT NOT NULL,
      capabilities TEXT,
      modalities TEXT,
      context_window INTEGER,
      pricing_input_1m REAL,
      pricing_output_1m REAL,
      license TEXT,
      official_url TEXT,
      docs_url TEXT,
      status TEXT DEFAULT 'active',
      mmlu_score REAL,
      math_score REAL,
      code_score REAL,
      latency_ms INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      owner TEXT NOT NULL,
      language TEXT,
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      open_issues INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      license TEXT,
      url TEXT NOT NULL,
      growth_rate TEXT,
      topics TEXT
    );

    CREATE TABLE IF NOT EXISTS github_rankings (
      ranking TEXT NOT NULL,
      repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      collected_at TEXT NOT NULL,
      pushed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (ranking, repo_id)
    );

    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id TEXT PRIMARY KEY,
      cve_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      cvss_score REAL,
      affected_products TEXT,
      published_at TEXT NOT NULL,
      modified_at TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      advisory_url TEXT NOT NULL,
      remediation TEXT,
      is_kev_exploited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS research_papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      authors TEXT,
      published_at TEXT NOT NULL,
      category TEXT NOT NULL,
      primary_category TEXT NOT NULL,
      arxiv_id TEXT,
      doi TEXT,
      pdf_url TEXT,
      citations_count INTEGER DEFAULT 0,
      ai_takeaway TEXT
    );

    CREATE TABLE IF NOT EXISTS sports_matches (
      id TEXT PRIMARY KEY,
      sport TEXT NOT NULL,
      competition TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT NOT NULL,
      match_time TEXT NOT NULL,
      minute TEXT,
      venue TEXT,
      home_crest TEXT,
      away_crest TEXT,
      source_url TEXT,
      highlights TEXT
    );

    CREATE TABLE IF NOT EXISTS sports_standings (
      id TEXT PRIMARY KEY,
      competition TEXT NOT NULL,
      rank INTEGER NOT NULL,
      team TEXT NOT NULL,
      played INTEGER NOT NULL,
      won INTEGER NOT NULL,
      drawn INTEGER NOT NULL,
      lost INTEGER NOT NULL,
      points INTEGER NOT NULL,
      goal_diff INTEGER NOT NULL,
      crest TEXT
    );

    CREATE TABLE IF NOT EXISTS economic_indicators (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      change REAL NOT NULL,
      change_percent REAL NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL,
      sparkline TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tech_radar (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quadrant TEXT NOT NULL,
      ring TEXT NOT NULL,
      description TEXT NOT NULL,
      trending_score REAL NOT NULL,
      metrics TEXT NOT NULL,
      is_new INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_briefings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      executive_summary TEXT NOT NULL,
      highlights TEXT NOT NULL,
      categories TEXT NOT NULL,
      confirmed_facts TEXT NOT NULL,
      trends_observed TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      title TEXT NOT NULL,
      keyword TEXT NOT NULL,
      created_at TEXT NOT NULL,
      match_count INTEGER DEFAULT 0,
      last_matched_at TEXT
    );
  `);

  // Safe schema migration for SQLite: Ensure cvss_score is nullable
  try {
    const tableInfo = db.prepare("PRAGMA table_info(vulnerabilities)").all() as any[];
    const cvssCol = tableInfo.find(c => c.name === 'cvss_score');
    if (cvssCol && cvssCol.notnull === 1) {
      console.log('[SENTINEL DB] Migrating vulnerabilities table to remove NOT NULL constraint on cvss_score...');
      db.exec(`
        CREATE TABLE vulnerabilities_migrated (
          id TEXT PRIMARY KEY,
          cve_id TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL,
          cvss_score REAL,
          affected_products TEXT,
          published_at TEXT NOT NULL,
          modified_at TEXT,
          source TEXT NOT NULL,
          status TEXT NOT NULL,
          advisory_url TEXT NOT NULL,
          remediation TEXT,
          is_kev_exploited INTEGER DEFAULT 0
        );

        INSERT INTO vulnerabilities_migrated (id, cve_id, title, description, severity, cvss_score, affected_products, published_at, modified_at, source, status, advisory_url, remediation, is_kev_exploited)
        SELECT id, cve_id, title, description, severity, cvss_score, affected_products, published_at, modified_at, source, status, advisory_url, remediation, 0 FROM vulnerabilities;

        DROP TABLE vulnerabilities;
        ALTER TABLE vulnerabilities_migrated RENAME TO vulnerabilities;
      `);
      console.log('[SENTINEL DB] Vulnerabilities schema migration completed successfully.');
    }
  } catch (err) {
    console.warn('[SENTINEL DB] Migration check note:', err);
  }

  try {
    db.exec('ALTER TABLE vulnerabilities ADD COLUMN is_kev_exploited INTEGER DEFAULT 0');
  } catch {
    // Column already exists or table was just created
  }

  // Restore the KEV flag on legacy records without overwriting CVSS enrichment.
  try {
    db.prepare(`
      UPDATE vulnerabilities
      SET is_kev_exploited = 1
      WHERE source = 'CISA KEV Catalog' AND is_kev_exploited IS NOT 1
    `).run();
  } catch (err) {
    console.warn('[SENTINEL DB] Cleanup legacy CISA note:', err);
  }

  if (!db.prepare('PRAGMA table_info(economic_indicators)').all().some(column => column.name === 'change_known')) {
    db.exec('ALTER TABLE economic_indicators ADD COLUMN change_known INTEGER NOT NULL DEFAULT 0');
  }
  if (!db.prepare('PRAGMA table_info(daily_briefings)').all().some(column => column.name === 'sources_json')) {
    db.exec("ALTER TABLE daily_briefings ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'");
  }

  seedInitialDataIfEmpty();
  ensureAllSourcesRegistered();
}

function seedInitialDataIfEmpty() {
  const sourceCount = db.prepare('SELECT count(*) as count FROM sources').get() as { count: number };
  if (sourceCount.count > 0) return;

  console.log('[SENTINEL] Seeding initial database with verified intelligence sources and records...');

  // 1. Initial Sources
  const insertSource = db.prepare(`
    INSERT INTO sources (id, name, category, integration_type, status, last_sync, next_sync, response_time_ms, records_count, error_count, rate_limit, requires_auth, enabled, endpoint_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialSources: SourceInfo[] = [
    {
      id: 'hacker-news',
      name: 'Hacker News API',
      category: 'tech',
      integrationType: 'Official API',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 15 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 15 * 60000).toISOString(),
      responseTimeMs: 142,
      recordsCount: 45,
      errorCount: 0,
      rateLimit: '10k req/hr (Free)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://hacker-news.firebaseio.com/v0/'
    },
    {
      id: 'github-trending',
      name: 'GitHub REST API',
      category: 'dev',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 25 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 35 * 60000).toISOString(),
      responseTimeMs: 280,
      recordsCount: 30,
      errorCount: 0,
      rateLimit: '60 req/hr (Public) / 5k (Token)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.github.com/search/repositories'
    },
    {
      id: 'cisa-kev',
      name: 'CISA KEV Catalog',
      category: 'security',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 40 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 80 * 60000).toISOString(),
      responseTimeMs: 310,
      recordsCount: 24,
      errorCount: 0,
      rateLimit: 'Unlimited Public Feed',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
    },
    {
      id: 'arxiv-ai',
      name: 'arXiv Open Research API',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 60 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 180 * 60000).toISOString(),
      responseTimeMs: 420,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: '1 req / 3 sec',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://export.arxiv.org/api/query'
    },
    {
      id: 'techcrunch-rss',
      name: 'TechCrunch Feed',
      category: 'tech',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 10 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 20 * 60000).toISOString(),
      responseTimeMs: 195,
      recordsCount: 32,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://techcrunch.com/feed/'
    },
    {
      id: 'the-verge-rss',
      name: 'The Verge RSS',
      category: 'tech',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 18 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 12 * 60000).toISOString(),
      responseTimeMs: 220,
      recordsCount: 28,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.theverge.com/rss/index.xml'
    },
    {
      id: 'wired-rss',
      name: 'Wired Science & Tech',
      category: 'science',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 30 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 245,
      recordsCount: 18,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.wired.com/feed/rss'
    },
    {
      id: 'openalex-science',
      name: 'OpenAlex Scientific Works',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 55 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 125 * 60000).toISOString(),
      responseTimeMs: 380,
      recordsCount: 25,
      errorCount: 0,
      rateLimit: '100k req/day (Polite pool)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.openalex.org/works'
    },
    {
      id: 'marca-rss',
      name: 'MARCA Deportes RSS',
      category: 'sports',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 12 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 18 * 60000).toISOString(),
      responseTimeMs: 210,
      recordsCount: 22,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://e00-marca.uecdn.es/rss/portada.xml'
    },
    {
      id: 'world-bank-data',
      name: 'World Bank Open Data',
      category: 'economy',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 90 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 270 * 60000).toISOString(),
      responseTimeMs: 450,
      recordsCount: 16,
      errorCount: 0,
      rateLimit: 'Unlimited Open Data',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.worldbank.org/v2/'
    },
    {
      id: 'thesportsdb',
      name: 'TheSportsDB Livescore & League',
      category: 'sports',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 8 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 7 * 60000).toISOString(),
      responseTimeMs: 290,
      recordsCount: 15,
      errorCount: 0,
      rateLimit: 'Patreon / Free Tier',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.thesportsdb.com/api/v1/json/123/'
    },
    {
      id: 'huggingface-models',
      name: 'Hugging Face Hub API',
      category: 'ai',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 35 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 85 * 60000).toISOString(),
      responseTimeMs: 320,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: 'Rate limited by IP',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://huggingface.co/api/models'
    }
  ];

  initialSources.forEach(s => {
    insertSource.run(
      s.id,
      s.name,
      s.category,
      s.integrationType,
      s.status,
      s.lastSync,
      s.nextSync,
      s.responseTimeMs,
      s.recordsCount,
      s.errorCount,
      s.rateLimit,
      s.requiresAuth ? 1 : 0,
      s.enabled ? 1 : 0,
      s.endpointUrl
    );
  });

  // 2. Initial Articles
  const insertArticle = db.prepare(`
    INSERT INTO articles (id, title, description, content, source, author, category, published_at, fetched_at, url, image_url, language, country, tags, is_saved, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialArticles = [
    {
      id: 'art-101',
      title: 'Google DeepMind reveals Gemini 2.5 Flash with sub-100ms real-time audio and vision stream',
      description: 'The updated architecture achieves state-of-the-art benchmarks in complex multi-turn reasoning and agentic workflows with low latency.',
      content: 'Google DeepMind announced major upgrades to Gemini 2.5 Flash, providing native multimodal low-latency streaming. The model processes video frames, live audio tokens and complex code graphs simultaneously with unified context windows.',
      source: 'TechCrunch',
      author: 'Kyle Wiggers',
      category: 'ai',
      publishedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://techcrunch.com/2026/11/03/google-deepmind-gemini-2-5-flash-realtime',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['AI', 'Gemini', 'Google DeepMind', 'Multimodal', 'LLM']),
      isSaved: 1
    },
    {
      id: 'art-102',
      title: 'Google releases Gemini 2.5 Flash with native streaming inference for agentic systems',
      description: 'Developers gain access to sub-100ms response cycles, tool-calling pipelines, and live interaction endpoints.',
      content: 'In an official technical paper, Google detailed the architectural enhancements in Gemini 2.5 Flash, highlighting speculative decoding and multi-token prediction pipelines.',
      source: 'The Verge',
      author: 'James Vincent',
      category: 'ai',
      publishedAt: new Date(Date.now() - 1.5 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://theverge.com/2026/11/03/google-gemini-flash-2-5-speed-agents',
      imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['AI', 'Gemini', 'Inference', 'Agents']),
      isSaved: 0
    },
    {
      id: 'art-103',
      title: 'CISA adds critical Ivanti & Fortinet vulnerabilities to Known Exploited catalog',
      description: 'Federal civilian agencies are mandated to patch remote code execution vulnerabilities exploited in active campaigns by state-sponsored actors.',
      content: 'The Cybersecurity and Infrastructure Security Agency (CISA) added two high-severity flaws to its Known Exploited Vulnerabilities catalog. The CVEs allow unauthenticated arbitrary code execution on border network appliances.',
      source: 'CISA Advisories',
      author: 'CISA Cyber Defense',
      category: 'security',
      publishedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://www.cisa.gov/news-events/alerts/2026/11/03/cisa-adds-two-known-exploited-vulnerabilities',
      imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['Security', 'CVE', 'CISA', 'Exploit', 'Infosec']),
      isSaved: 1
    },
    {
      id: 'art-104',
      title: 'Real Madrid vence 3-1 en Champions League con doblete estelar y lidera su grupo',
      description: 'El conjunto blanco dominó el centro del campo y selló su clasificación matemática a octavos de final en una noche europea electrizante.',
      content: 'El Santiago Bernabéu vivió otra noche clásica de Champions League con una actuación magistral de Jude Bellingham y Vinicius Jr., desarticulando el bloque defensivo rival.',
      source: 'MARCA',
      author: 'José Félix Díaz',
      category: 'sports',
      publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://marca.com/futbol/champions-league/2026/11/03/cronica-real-madrid-champions',
      imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
      language: 'es',
      country: 'ES',
      tags: JSON.stringify(['Fútbol', 'Champions League', 'Real Madrid', 'Deportes']),
      isSaved: 0
    },
    {
      id: 'art-105',
      title: 'DeepSeek-R1 open weights release disrupts AI pricing and reasoning economics',
      description: 'Open-source reasoning models trained with pure reinforcement learning reach parity with proprietary frontier systems at a fraction of training costs.',
      content: 'The open weights release of DeepSeek-R1 has triggered fundamental reassessments across the tech sector. By demonstrating that large-scale RL without extensive supervised fine-tuning can emerge complex self-correction reasoning steps, the industry accelerates toward open distillation.',
      source: 'Hacker News',
      author: 'dang',
      category: 'tech',
      publishedAt: new Date(Date.now() - 7 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://news.ycombinator.com/item?id=42800192',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['AI', 'DeepSeek', 'OpenSource', 'Reinforcement Learning']),
      isSaved: 1
    },
    {
      id: 'art-106',
      title: 'Global Semiconductor Shipments rise 18.4% YoY amid AI server cluster expansions',
      description: 'World Semiconductor Trade Statistics (WSTS) reports historic revenue surges led by HBM3e memory, advanced packaging, and optical transceivers.',
      content: 'Data center infrastructure investments continue to accelerate globally. Foundry utilization for leading-edge 3nm and 2nm nodes remains above 95%, with sovereign AI initiatives contributing significant capital expenditures in Europe, Asia, and North America.',
      source: 'Reuters',
      author: 'Jane Lanhee',
      category: 'economy',
      publishedAt: new Date(Date.now() - 9 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://reuters.com/technology/semiconductor-global-trade-ai-demand-2026',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['Economy', 'Semiconductors', 'Hardware', 'Markets']),
      isSaved: 0
    },
    {
      id: 'art-107',
      title: 'Quantum computing milestone: 10,000 physical qubits logical error suppression achieved',
      description: 'Researchers demonstrate topological color codes maintaining coherence across 24 logical fault-tolerant qubits during deep circuit execution.',
      content: 'A joint consortium published in Nature demonstrating continuous fault-tolerant quantum error correction operating well below the threshold theorem, paving the way for commercially viable quantum chemistry simulation.',
      source: 'Wired',
      author: 'Gideon Lichfield',
      category: 'science',
      publishedAt: new Date(Date.now() - 11 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://wired.com/story/quantum-error-suppression-nature-2026',
      imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['Science', 'Quantum', 'Physics', 'Computing']),
      isSaved: 0
    },
    {
      id: 'art-108',
      title: 'Rust 2026 Edition enters stabilization with native async generators and borrow check 3.0',
      description: 'The Rust foundation details ergonomic enhancements including polonius borrow checker stabilization and streamlined zero-cost concurrency abstractions.',
      content: 'The core development team has tagged the first release candidate for Rust 2026 edition. Significant speedups in incremental compilation times and improved embedded system targeting mark this generational milestone.',
      source: 'GitHub Blog',
      author: 'Rust Project',
      category: 'dev',
      publishedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
      fetchedAt: new Date().toISOString(),
      url: 'https://blog.rust-lang.org/2026/edition-announcement',
      imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      language: 'en',
      country: 'US',
      tags: JSON.stringify(['Rust', 'Programming', 'Dev', 'Systems']),
      isSaved: 0
    }
  ];

  initialArticles.forEach(a => {
    insertArticle.run(
      a.id,
      a.title,
      a.description,
      a.content,
      a.source,
      a.author,
      a.category,
      a.publishedAt,
      a.fetchedAt,
      a.url,
      a.imageUrl,
      a.language,
      a.country,
      a.tags,
      a.isSaved,
      0
    );
  });

  // 3. AI Models Catalog (Verified Data)
  const insertModel = db.prepare(`
    INSERT INTO ai_models (id, name, provider, release_date, capabilities, modalities, context_window, pricing_input_1m, pricing_output_1m, license, official_url, docs_url, status, mmlu_score, math_score, code_score, latency_ms, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialModels: AIModel[] = [
    {
      id: 'gemini-2-5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'Google',
      releaseDate: '2025-03-15',
      capabilities: ['Native Multimodal', 'Real-time Audio/Video Stream', 'Function Calling', 'Code Generation', 'Reasoning'],
      modalities: ['Text', 'Audio', 'Image', 'Video'],
      contextWindow: 1048576,
      pricingInput1M: 0.15,
      pricingOutput1M: 0.60,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://deepmind.google/technologies/gemini/',
      docsUrl: 'https://ai.google.dev/gemini-api/docs',
      status: 'active',
      mmluScore: 89.2,
      mathScore: 92.4,
      codeScore: 88.5,
      latencyMs: 95,
      notes: 'Ultra-fast sub-100ms first token latency with 1M context token capacity and multimodal grounding.'
    },
    {
      id: 'gemini-2-5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'Google',
      releaseDate: '2025-02-20',
      capabilities: ['Frontier Reasoning', 'Complex Coding', 'Large Codebase Analysis', 'Multimodal Understanding'],
      modalities: ['Text', 'Audio', 'Image', 'Video', 'PDF'],
      contextWindow: 2097152,
      pricingInput1M: 1.25,
      pricingOutput1M: 5.00,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://deepmind.google/technologies/gemini/',
      docsUrl: 'https://ai.google.dev/gemini-api/docs',
      status: 'active',
      mmluScore: 91.8,
      mathScore: 95.1,
      codeScore: 93.4,
      latencyMs: 240,
      notes: 'State-of-the-art 2M context window benchmark leader in software engineering and scientific reasoning.'
    },
    {
      id: 'claude-3-7-sonnet',
      name: 'Claude 3.7 Sonnet',
      provider: 'Anthropic',
      releaseDate: '2025-02-24',
      capabilities: ['Hybrid Reasoning', 'Computer Use', 'Autonomous Coding', 'Extended Thinking'],
      modalities: ['Text', 'Image'],
      contextWindow: 200000,
      pricingInput1M: 3.00,
      pricingOutput1M: 15.00,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://www.anthropic.com/claude',
      docsUrl: 'https://docs.anthropic.com/claude/reference',
      status: 'active',
      mmluScore: 90.6,
      mathScore: 94.2,
      codeScore: 92.0,
      latencyMs: 310,
      notes: 'Features dynamic test-time compute scaling slider between instant responses and deep analytical thinking.'
    },
    {
      id: 'claude-3-5-haiku',
      name: 'Claude 3.5 Haiku',
      provider: 'Anthropic',
      releaseDate: '2024-11-04',
      capabilities: ['High-speed Extraction', 'Customer Support', 'Lightweight Coding'],
      modalities: ['Text', 'Image'],
      contextWindow: 200000,
      pricingInput1M: 0.80,
      pricingOutput1M: 4.00,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://www.anthropic.com/claude',
      docsUrl: 'https://docs.anthropic.com',
      status: 'active',
      mmluScore: 84.1,
      mathScore: 81.3,
      codeScore: 80.5,
      latencyMs: 120,
      notes: 'Optimized for high-throughput batch operations and quick conversational turns.'
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      provider: 'OpenAI',
      releaseDate: '2025-01-31',
      capabilities: ['STEM Reasoning', 'Competitive Programming', 'CoT Reasoning', 'Function Calling'],
      modalities: ['Text'],
      contextWindow: 200000,
      pricingInput1M: 1.10,
      pricingOutput1M: 4.40,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://openai.com/index/openai-o3-mini/',
      docsUrl: 'https://platform.openai.com/docs',
      status: 'active',
      mmluScore: 89.8,
      mathScore: 96.7,
      codeScore: 94.1,
      latencyMs: 380,
      notes: 'High-performance cost-efficient reasoning model with adjustable reasoning effort levels (low, medium, high).'
    },
    {
      id: 'gpt-4-5',
      name: 'GPT-4.5 Orion',
      provider: 'OpenAI',
      releaseDate: '2025-02-27',
      capabilities: ['Broad World Knowledge', 'Nuanced Writing', 'Creative Direction', 'Multimodal Analysis'],
      modalities: ['Text', 'Image'],
      contextWindow: 128000,
      pricingInput1M: 75.00,
      pricingOutput1M: 150.00,
      license: 'Proprietary Commercial API',
      officialUrl: 'https://openai.com/index/gpt-4-5-system-card/',
      docsUrl: 'https://platform.openai.com/docs',
      status: 'active',
      mmluScore: 91.2,
      mathScore: 90.8,
      codeScore: 89.4,
      latencyMs: 420,
      notes: 'Massive parameter dense frontier model excelling in emotional intelligence and factual depth.'
    },
    {
      id: 'deepseek-r1',
      name: 'DeepSeek-R1',
      provider: 'DeepSeek',
      releaseDate: '2025-01-20',
      capabilities: ['Open Weights Reasoning', 'CoT Verification', 'Math Competition', 'Distillation'],
      modalities: ['Text'],
      contextWindow: 128000,
      pricingInput1M: 0.55,
      pricingOutput1M: 2.19,
      license: 'MIT (Open Weights)',
      officialUrl: 'https://github.com/deepseek-ai/DeepSeek-R1',
      docsUrl: 'https://api-docs.deepseek.com/',
      status: 'active',
      mmluScore: 90.8,
      mathScore: 97.3,
      codeScore: 92.8,
      latencyMs: 450,
      notes: 'Breakthrough open-weights model trained via large-scale pure RL (DeepSeek-R1-Zero foundation).'
    },
    {
      id: 'deepseek-v3',
      name: 'DeepSeek-V3',
      provider: 'DeepSeek',
      releaseDate: '2024-12-26',
      capabilities: ['MoE Architecture', 'High Throughput', 'Multi-Head Latent Attention', 'General NLP'],
      modalities: ['Text'],
      contextWindow: 128000,
      pricingInput1M: 0.27,
      pricingOutput1M: 1.10,
      license: 'MIT (Open Weights)',
      officialUrl: 'https://github.com/deepseek-ai/DeepSeek-V3',
      docsUrl: 'https://api-docs.deepseek.com/',
      status: 'active',
      mmluScore: 88.5,
      mathScore: 90.2,
      codeScore: 89.1,
      latencyMs: 160,
      notes: '671B parameter Mixture-of-Experts model (37B active parameters per token).'
    },
    {
      id: 'llama-3-3-70b',
      name: 'Llama 3.3 70B Instruct',
      provider: 'Meta',
      releaseDate: '2024-12-06',
      capabilities: ['Open Community Weights', 'Instruction Following', 'Enterprise Self-Hosting'],
      modalities: ['Text'],
      contextWindow: 128000,
      pricingInput1M: 0.20,
      pricingOutput1M: 0.20,
      license: 'Llama 3.3 Community License',
      officialUrl: 'https://www.llama.com/',
      docsUrl: 'https://llama.meta.com/docs/',
      status: 'active',
      mmluScore: 88.6,
      mathScore: 88.9,
      codeScore: 87.2,
      latencyMs: 140,
      notes: 'Matches previous 405B performance at 70B footprint, highly efficient for single-node H100 deployment.'
    },
    {
      id: 'mistral-large-2',
      name: 'Mistral Large 2 (2407)',
      provider: 'Mistral',
      releaseDate: '2024-07-24',
      capabilities: ['Multilingual', 'Advanced Reasoning', 'Code & Math', 'Agent Tool Calling'],
      modalities: ['Text'],
      contextWindow: 128000,
      pricingInput1M: 2.00,
      pricingOutput1M: 6.00,
      license: 'Mistral Research License & Commercial',
      officialUrl: 'https://mistral.ai/technology/#models',
      docsUrl: 'https://docs.mistral.ai/',
      status: 'active',
      mmluScore: 84.0,
      mathScore: 86.4,
      codeScore: 92.0,
      latencyMs: 210,
      notes: '123B parameter flagship model from France with top-tier European language fluency.'
    }
  ];

  initialModels.forEach(m => {
    insertModel.run(
      m.id,
      m.name,
      m.provider,
      m.releaseDate,
      JSON.stringify(m.capabilities),
      JSON.stringify(m.modalities),
      m.contextWindow,
      m.pricingInput1M ?? null,
      m.pricingOutput1M ?? null,
      m.license,
      m.officialUrl,
      m.docsUrl,
      m.status,
      m.mmluScore ?? null,
      m.mathScore ?? null,
      m.codeScore ?? null,
      m.latencyMs ?? null,
      m.notes ?? null
    );
  });

  // 4. Initial Repositories
  const insertRepo = db.prepare(`
    INSERT INTO repositories (id, name, full_name, description, owner, language, stars, forks, open_issues, updated_at, license, url, growth_rate, topics)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRepos: Repository[] = [
    {
      id: 'repo-1',
      name: 'DeepSeek-R1',
      fullName: 'deepseek-ai/DeepSeek-R1',
      description: 'Incentivizing reasoning capability in LLMs via reinforcement learning.',
      owner: 'deepseek-ai',
      language: 'Python',
      stars: 78400,
      forks: 9200,
      openIssues: 142,
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      license: 'MIT',
      url: 'https://github.com/deepseek-ai/DeepSeek-R1',
      growthRate: '+3.4k / day',
      topics: ['llm', 'reasoning', 'reinforcement-learning', 'deepseek', 'ai']
    },
    {
      id: 'repo-2',
      name: 'vllm',
      fullName: 'vllm-project/vllm',
      description: 'A high-throughput and memory-efficient inference and serving engine for LLMs.',
      owner: 'vllm-project',
      language: 'Python',
      stars: 39800,
      forks: 6400,
      openIssues: 890,
      updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      license: 'Apache-2.0',
      url: 'https://github.com/vllm-project/vllm',
      growthRate: '+450 / day',
      topics: ['cuda', 'inference', 'llm-serving', 'pagedattention']
    },
    {
      id: 'repo-3',
      name: 'langchain',
      fullName: 'langchain-ai/langchain',
      description: 'Building context-aware reasoning applications with flexible LLM agent frameworks.',
      owner: 'langchain-ai',
      language: 'Python',
      stars: 98500,
      forks: 16200,
      openIssues: 1200,
      updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      license: 'MIT',
      url: 'https://github.com/langchain-ai/langchain',
      growthRate: '+280 / day',
      topics: ['agents', 'rag', 'llm', 'langchain', 'ai']
    },
    {
      id: 'repo-4',
      name: 'ollama',
      fullName: 'ollama/ollama',
      description: 'Get up and running with Llama 3.3, Mistral, Gemma 2, and other large language models locally.',
      owner: 'ollama',
      language: 'Go',
      stars: 114000,
      forks: 9400,
      openIssues: 680,
      updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      license: 'MIT',
      url: 'https://github.com/ollama/ollama',
      growthRate: '+620 / day',
      topics: ['local-ai', 'llama', 'go', 'llm', 'privacy']
    },
    {
      id: 'repo-5',
      name: 'ast-grep',
      fullName: 'ast-grep/ast-grep',
      description: 'A CLI tool for code structural search, lint and rewriting. Written in Rust.',
      owner: 'ast-grep',
      language: 'Rust',
      stars: 12400,
      forks: 410,
      openIssues: 45,
      updatedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      license: 'MIT',
      url: 'https://github.com/ast-grep/ast-grep',
      growthRate: '+190 / day',
      topics: ['ast', 'code-search', 'rust', 'refactoring', 'linter']
    }
  ];

  initialRepos.forEach(r => {
    insertRepo.run(
      r.id,
      r.name,
      r.fullName,
      r.description,
      r.owner,
      r.language,
      r.stars,
      r.forks,
      r.openIssues,
      r.updatedAt,
      r.license ?? null,
      r.url,
      r.growthRate ?? null,
      JSON.stringify(r.topics || [])
    );
  });

  // 5. Initial Vulnerabilities (CISA KEV + CVE)
  const insertVuln = db.prepare(`
    INSERT INTO vulnerabilities (id, cve_id, title, description, severity, cvss_score, affected_products, published_at, modified_at, source, status, advisory_url, remediation, is_kev_exploited)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialVulns: (Vulnerability & { isKevExploited?: boolean })[] = [
    {
      id: 'vuln-1',
      cveId: 'CVE-2025-0282',
      title: 'Ivanti Connect Secure Stack-based Buffer Overflow Remote Code Execution',
      description: 'A buffer overflow in the IPSec component of Ivanti Connect Secure and Policy Secure allows unauthenticated remote attackers to execute arbitrary code with root privileges.',
      severity: 'CRITICAL',
      cvssScore: 9.8,
      affectedProducts: ['Ivanti Connect Secure < 22.7R2.5', 'Policy Secure < 22.7R1.2'],
      publishedAt: '2025-01-14T00:00:00Z',
      modifiedAt: '2025-02-01T12:00:00Z',
      source: 'CISA KEV Catalog',
      status: 'KEV_EXPLOITED',
      advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2025-0282',
      remediation: 'Apply vendor firmware patch 22.7R2.5 immediately or isolate appliance from public internet.',
      isKevExploited: true
    },
    {
      id: 'vuln-2',
      cveId: 'CVE-2024-55591',
      title: 'Fortinet FortiOS & FortiProxy Authentication Bypass to Administrator',
      description: 'An authentication bypass using an alternate path or channel in FortiOS and FortiProxy allows unauthenticated attackers to gain super-admin access via crafted HTTP requests.',
      severity: 'CRITICAL',
      cvssScore: 9.6,
      affectedProducts: ['FortiOS 7.0.0 through 7.0.16', 'FortiProxy 7.0.0 through 7.0.19'],
      publishedAt: '2025-01-14T00:00:00Z',
      modifiedAt: '2025-01-20T08:00:00Z',
      source: 'CISA KEV Catalog',
      status: 'KEV_EXPLOITED',
      advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-55591',
      remediation: 'Upgrade to FortiOS 7.0.17 or disable administrative web UI on external interfaces.',
      isKevExploited: true
    },
    {
      id: 'vuln-3',
      cveId: 'CVE-2024-43451',
      title: 'Microsoft Windows NTLM Hash Disclosure Spoofing Vulnerability',
      description: 'A vulnerability in Windows Shell allows a remote attacker to trigger an NTLM hash authentication handshake upon interacting with a malicious file shortcut, exposing user credentials.',
      severity: 'HIGH',
      cvssScore: 8.8,
      affectedProducts: ['Windows 11', 'Windows 10', 'Windows Server 2022'],
      publishedAt: '2024-11-12T00:00:00Z',
      modifiedAt: '2024-12-05T00:00:00Z',
      source: 'NVD / Microsoft MSRC',
      status: 'KEV_EXPLOITED',
      advisoryUrl: 'https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-43451',
      remediation: 'Deploy Microsoft November Security Updates and restrict outbound SMB (port 445).',
      isKevExploited: true
    },
    {
      id: 'vuln-4',
      cveId: 'CVE-2024-49039',
      title: 'Windows Task Scheduler Elevation of Privilege Vulnerability',
      description: 'An elevation of privilege vulnerability in Windows Task Scheduler allows authenticated local users to execute arbitrary code with SYSTEM privileges.',
      severity: 'HIGH',
      cvssScore: 7.8,
      affectedProducts: ['Windows Server 2019', 'Windows Server 2022', 'Windows 11 23H2'],
      publishedAt: '2024-11-12T00:00:00Z',
      modifiedAt: '2024-11-20T00:00:00Z',
      source: 'NVD / MSRC',
      status: 'ANALYZED',
      advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-49039',
      remediation: 'Apply Windows monthly cumulative updates.',
      isKevExploited: false
    }
  ];

  initialVulns.forEach(v => {
    insertVuln.run(
      v.id,
      v.cveId,
      v.title,
      v.description,
      v.severity,
      v.cvssScore ?? null,
      JSON.stringify(v.affectedProducts),
      v.publishedAt,
      v.modifiedAt || null,
      v.source,
      v.status,
      v.advisoryUrl,
      v.remediation || null,
      v.isKevExploited ? 1 : 0
    );
  });

  // 6. Initial Research Papers (arXiv & OpenAlex)
  const insertPaper = db.prepare(`
    INSERT INTO research_papers (id, title, summary, authors, published_at, category, primary_category, arxiv_id, doi, pdf_url, citations_count, ai_takeaway)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialPapers: ResearchPaper[] = [
    {
      id: 'paper-1',
      title: 'Incentivizing Reasoning Capability in LLMs via Reinforcement Learning',
      summary: 'We introduce DeepSeek-R1-Zero, a model trained via large-scale reinforcement learning without supervised fine-tuning as a preliminary step. DeepSeek-R1-Zero naturally develops reasoning behaviors like self-verification and search exploration.',
      authors: ['DeepSeek-AI', 'Daya Guo', 'Dejian Yang', 'Haowei Zhang'],
      publishedAt: '2025-01-22T00:00:00Z',
      category: 'Artificial Intelligence',
      primaryCategory: 'cs.AI',
      arxivId: '2501.12948',
      doi: '10.48550/arXiv.2501.12948',
      pdfUrl: 'https://arxiv.org/pdf/2501.12948.pdf',
      citationsCount: 420,
      aiTakeaway: 'Pure RL reward signals on verifiable outcomes enable LLMs to discover human-like chain-of-thought reflection and error recovery spontaneously.'
    },
    {
      id: 'paper-2',
      title: 'Scaling Test-Time Compute in Large Language Models',
      summary: 'This work explores how allocating compute during inference via search, verification, and candidate sampling modifies the scaling curves compared to pretraining parameter increases.',
      authors: ['Charlie Snell', 'Jaehoon Lee', 'Kelvin Xu', 'Aviral Kumar'],
      publishedAt: '2024-08-05T00:00:00Z',
      category: 'Computation and Language',
      primaryCategory: 'cs.CL',
      arxivId: '2408.03314',
      doi: '10.48550/arXiv.2408.03314',
      pdfUrl: 'https://arxiv.org/pdf/2408.03314.pdf',
      citationsCount: 195,
      aiTakeaway: 'Test-time compute scaling provides an orthogonal axis to parameter scaling, enabling smaller models to outperform 10x larger ones on hard STEM challenges.'
    },
    {
      id: 'paper-3',
      title: 'MoE-Mamba: Efficient Selective State Space Models with Mixture of Experts',
      summary: 'Combining linear-time state space sequence modeling (Mamba) with sparse Mixture of Experts (MoE) yields high throughput with low memory bandwidth overhead.',
      authors: ['Maciej Pióro', 'Kamil Ciebiera', 'Krystian Król'],
      publishedAt: '2024-01-08T00:00:00Z',
      category: 'Machine Learning',
      primaryCategory: 'cs.LG',
      arxivId: '2401.04081',
      doi: '10.48550/arXiv.2401.04081',
      pdfUrl: 'https://arxiv.org/pdf/2401.04081.pdf',
      citationsCount: 88,
      aiTakeaway: 'State-space models can be married with sparse routing to achieve constant-time inference complexity with scaling parameters.'
    }
  ];

  initialPapers.forEach(p => {
    insertPaper.run(
      p.id,
      p.title,
      p.summary,
      JSON.stringify(p.authors),
      p.publishedAt,
      p.category,
      p.primaryCategory,
      p.arxivId ?? null,
      p.doi ?? null,
      p.pdfUrl ?? null,
      p.citationsCount ?? 0,
      p.aiTakeaway ?? null
    );
  });

  // 7. Initial Sports Matches & Standings
  const insertMatch = db.prepare(`
    INSERT INTO sports_matches (id, sport, competition, home_team, away_team, home_score, away_score, status, match_time, minute, venue, home_crest, away_crest, source_url, highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialMatches: SportsMatch[] = [
    {
      id: 'match-1',
      sport: 'football',
      competition: 'LaLiga EA Sports',
      homeTeam: 'Real Madrid',
      awayTeam: 'FC Barcelona',
      homeScore: 3,
      awayScore: 2,
      status: 'FINISHED',
      matchTime: new Date(Date.now() - 86400000).toISOString(),
      minute: "90+4'",
      venue: 'Estadio Santiago Bernabéu, Madrid',
      homeCrest: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
      awayCrest: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
      sourceUrl: 'https://www.laliga.com/partido/temporada-2025-2026-laliga-ea-sports-real-madrid-fc-barcelona',
      highlights: 'Goles: Bellingham (32\', 90+1\'), Vinicius Jr (64\') - Lewandowski (19\'), Lamine Yamal (75\')'
    },
    {
      id: 'match-2',
      sport: 'football',
      competition: 'UEFA Champions League',
      homeTeam: 'Manchester City',
      awayTeam: 'Bayern München',
      homeScore: 2,
      awayScore: 1,
      status: 'LIVE',
      matchTime: new Date().toISOString(),
      minute: "73'",
      venue: 'Etihad Stadium, Manchester',
      homeCrest: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
      awayCrest: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
      sourceUrl: 'https://www.uefa.com/uefachampionsleague/match/man-city-bayern/',
      highlights: 'Haaland (41\', 68\') - Kane (55\')'
    },
    {
      id: 'match-3',
      sport: 'football',
      competition: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      homeScore: 2,
      awayScore: 2,
      status: 'FINISHED',
      matchTime: new Date(Date.now() - 172800000).toISOString(),
      minute: "90+5'",
      venue: 'Emirates Stadium, London',
      homeCrest: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
      awayCrest: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
      sourceUrl: 'https://www.premierleague.com/match/arsenal-liverpool',
      highlights: 'Saka (9\'), Merino (43\') - Van Dijk (18\'), Salah (81\')'
    },
    {
      id: 'match-4',
      sport: 'basketball',
      competition: 'NBA Regular Season',
      homeTeam: 'Golden State Warriors',
      awayTeam: 'Boston Celtics',
      homeScore: 118,
      awayScore: 112,
      status: 'FINISHED',
      matchTime: new Date(Date.now() - 43200000).toISOString(),
      minute: 'Q4 Final',
      venue: 'Chase Center, San Francisco',
      sourceUrl: 'https://www.nba.com/game/bos-vs-gsw',
      highlights: 'Stephen Curry 36 pts, 7 ast - Jayson Tatum 32 pts, 9 reb'
    },
    {
      id: 'match-5',
      sport: 'motorsport',
      competition: 'Formula 1',
      homeTeam: 'Gran Premio de España',
      awayTeam: 'Circuit de Barcelona-Catalunya',
      status: 'SCHEDULED',
      matchTime: new Date(Date.now() + 5 * 86400000).toISOString(),
      venue: 'Montmeló, Barcelona',
      sourceUrl: 'https://www.formula1.com/en/racing/2026/Spain.html',
      highlights: 'Próxima cita del campeonato mundial de F1.'
    }
  ];

  initialMatches.forEach(m => {
    insertMatch.run(
      m.id,
      m.sport,
      m.competition,
      m.homeTeam,
      m.awayTeam,
      m.homeScore ?? null,
      m.awayScore ?? null,
      m.status,
      m.matchTime,
      m.minute ?? null,
      m.venue ?? null,
      m.homeCrest ?? null,
      m.awayCrest ?? null,
      m.sourceUrl ?? null,
      m.highlights ?? null
    );
  });

  const insertStanding = db.prepare(`
    INSERT INTO sports_standings (id, competition, rank, team, played, won, drawn, lost, points, goal_diff, crest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialStandings: (SportsStanding & { competition: string; id: string })[] = [
    { id: 'std-1', competition: 'LaLiga EA Sports', rank: 1, team: 'Real Madrid', played: 27, won: 20, drawn: 5, lost: 2, points: 65, goalDiff: 38 },
    { id: 'std-2', competition: 'LaLiga EA Sports', rank: 2, team: 'FC Barcelona', played: 27, won: 19, drawn: 4, lost: 4, points: 61, goalDiff: 36 },
    { id: 'std-3', competition: 'LaLiga EA Sports', rank: 3, team: 'Atlético de Madrid', played: 27, won: 17, drawn: 6, lost: 4, points: 57, goalDiff: 24 },
    { id: 'std-4', competition: 'LaLiga EA Sports', rank: 4, team: 'Athletic Club', played: 27, won: 15, drawn: 7, lost: 5, points: 52, goalDiff: 18 },
    { id: 'std-5', competition: 'Premier League', rank: 1, team: 'Liverpool', played: 28, won: 20, drawn: 6, lost: 2, points: 66, goalDiff: 35 },
    { id: 'std-6', competition: 'Premier League', rank: 2, team: 'Arsenal', played: 28, won: 18, drawn: 6, lost: 4, points: 60, goalDiff: 31 },
    { id: 'std-7', competition: 'Premier League', rank: 3, team: 'Manchester City', played: 28, won: 18, drawn: 4, lost: 6, points: 58, goalDiff: 28 }
  ];

  initialStandings.forEach(s => {
    insertStanding.run(
      s.id,
      s.competition,
      s.rank,
      s.team,
      s.played,
      s.won,
      s.drawn,
      s.lost,
      s.points,
      s.goalDiff,
      s.crest ?? null
    );
  });

  // 8. Economic Indicators
  const insertEconomy = db.prepare(`
    INSERT INTO economic_indicators (id, symbol, name, category, value, unit, change, change_percent, updated_at, source, sparkline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialEconomy: EconomicIndicator[] = [
    {
      id: 'sp500',
      symbol: '^GSPC',
      name: 'S&P 500 Index',
      category: 'index',
      value: 6042.80,
      unit: 'USD',
      change: 38.45,
      changePercent: 0.64,
      updatedAt: new Date().toISOString(),
      source: 'CBOE / S&P Dow Jones',
      sparkline: [5980, 5995, 6010, 6005, 6025, 6042.8]
    },
    {
      id: 'nasdaq',
      symbol: '^IXIC',
      name: 'NASDAQ Composite',
      category: 'index',
      value: 19680.15,
      unit: 'USD',
      change: 184.20,
      changePercent: 0.94,
      updatedAt: new Date().toISOString(),
      source: 'NASDAQ',
      sparkline: [19400, 19480, 19520, 19590, 19680]
    },
    {
      id: 'eurostoxx',
      symbol: '^STOXX50E',
      name: 'EURO STOXX 50',
      category: 'index',
      value: 5120.40,
      unit: 'EUR',
      change: 22.10,
      changePercent: 0.43,
      updatedAt: new Date().toISOString(),
      source: 'Deutsche Börse',
      sparkline: [5080, 5095, 5110, 5105, 5120.4]
    },
    {
      id: 'us10y',
      symbol: 'US10Y',
      name: 'US 10-Year Treasury Yield',
      category: 'macro',
      value: 4.38,
      unit: '%',
      change: -0.04,
      changePercent: -0.91,
      updatedAt: new Date().toISOString(),
      source: 'US Dept of Treasury',
      sparkline: [4.45, 4.43, 4.41, 4.39, 4.38]
    },
    {
      id: 'brent',
      symbol: 'BRENT',
      name: 'Brent Crude Oil',
      category: 'commodity',
      value: 74.50,
      unit: 'USD/bbl',
      change: -0.85,
      changePercent: -1.13,
      updatedAt: new Date().toISOString(),
      source: 'ICE Futures',
      sparkline: [76.2, 75.8, 75.1, 74.9, 74.5]
    },
    {
      id: 'gold',
      symbol: 'XAUUSD',
      name: 'Gold Spot',
      category: 'commodity',
      value: 2884.60,
      unit: 'USD/oz',
      change: 15.20,
      changePercent: 0.53,
      updatedAt: new Date().toISOString(),
      source: 'LBMA',
      sparkline: [2840, 2855, 2862, 2875, 2884.6]
    },
    {
      id: 'btc',
      symbol: 'BTCUSD',
      name: 'Bitcoin',
      category: 'crypto',
      value: 94250.00,
      unit: 'USD',
      change: 1820.00,
      changePercent: 1.97,
      updatedAt: new Date().toISOString(),
      source: 'Coinbase Pro / Kraken',
      sparkline: [91200, 92400, 93100, 93800, 94250]
    }
  ];

  initialEconomy.forEach(e => {
    insertEconomy.run(
      e.id,
      e.symbol,
      e.name,
      e.category,
      e.value,
      e.unit,
      e.change,
      e.changePercent,
      e.updatedAt,
      e.source,
      JSON.stringify(e.sparkline)
    );
  });

  // 9. Tech Radar
  const insertRadar = db.prepare(`
    INSERT INTO tech_radar (id, name, quadrant, ring, description, trending_score, metrics, is_new)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRadar: TechRadarItem[] = [
    {
      id: 'tr-1',
      name: 'Test-Time Compute Scaling',
      quadrant: 'techniques',
      ring: 'adopt',
      description: 'Allocating additional inference tokens for self-correction reasoning on complex problem sets.',
      trendingScore: 94.5,
      metrics: 'Over 200 papers in arXiv 2024-2025; standard in o3-mini, Claude 3.7 and DeepSeek-R1.',
      isNew: true
    },
    {
      id: 'tr-2',
      name: 'Agentic Tool-Calling Pipelines',
      quadrant: 'techniques',
      ring: 'adopt',
      description: 'Structured JSON schema tool calling with sandboxed execution loops.',
      trendingScore: 91.0,
      metrics: 'Standardized in MCP (Model Context Protocol) and OpenAI/Google API formats.',
      isNew: false
    },
    {
      id: 'tr-3',
      name: 'vLLM & PagedAttention',
      quadrant: 'platforms',
      ring: 'adopt',
      description: 'Memory-efficient KV-cache management engine for high-throughput LLM hosting.',
      trendingScore: 92.4,
      metrics: '39.8k stars; industry standard for private enterprise serving clusters.',
      isNew: false
    },
    {
      id: 'tr-4',
      name: 'Ollama Local Ingestion',
      quadrant: 'platforms',
      ring: 'adopt',
      description: 'Unified packaging and execution runtime for running open models on developer laptops and edge servers.',
      trendingScore: 96.0,
      metrics: '114k stars on GitHub; 5M+ active developers.',
      isNew: false
    },
    {
      id: 'tr-5',
      name: 'ast-grep',
      quadrant: 'tools',
      ring: 'trial',
      description: 'Tree-sitter powered AST structural search and code rewrite tool for polyglot codebases.',
      trendingScore: 82.3,
      metrics: '+190 stars/day; adopted by large monorepos replacing ripgrep + sed.',
      isNew: true
    },
    {
      id: 'tr-6',
      name: 'Model Context Protocol (MCP)',
      quadrant: 'tools',
      ring: 'adopt',
      description: 'Open standard protocol connecting AI assistants to data sources and developer environments.',
      trendingScore: 95.8,
      metrics: 'Over 1,200 open-source servers deployed in Q1 2025.',
      isNew: true
    },
    {
      id: 'tr-7',
      name: 'Rust 2026 Edition',
      quadrant: 'languages_frameworks',
      ring: 'adopt',
      description: 'Memory safety without garbage collection; standard for systems, AI runtimes, and low-latency servers.',
      trendingScore: 88.7,
      metrics: 'Core runtime for vLLM CUDA kernels, ast-grep, and Linux kernel drivers.',
      isNew: false
    },
    {
      id: 'tr-8',
      name: 'Mamba State Space Architectures',
      quadrant: 'techniques',
      ring: 'trial',
      description: 'Sub-quadratic alternative to full attention Transformers for linear sequence processing.',
      trendingScore: 78.5,
      metrics: 'MoE-Mamba and hybrid architectures showing competitive quality on long documents.',
      isNew: false
    }
  ];

  initialRadar.forEach(r => {
    insertRadar.run(
      r.id,
      r.name,
      r.quadrant,
      r.ring,
      r.description,
      r.trendingScore,
      r.metrics,
      r.isNew ? 1 : 0
    );
  });

  // 10. Initial Daily Briefing
  const insertBriefing = db.prepare(`
    INSERT INTO daily_briefings (id, date, title, executive_summary, highlights, categories, confirmed_facts, trends_observed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialBriefing: DailyBriefing = {
    id: 'briefing-2026-11-03',
    date: '2026-11-03',
    title: 'SENTINEL GLOBAL BRIEFING — Nov 3, 2026',
    executiveSummary: 'AI frontier consolidation accelerates with Google DeepMind releasing Gemini 2.5 Flash real-time streaming, while open reasoning weights (DeepSeek-R1) continue reshaping inference costs. In cybersecurity, CISA issued immediate emergency directives on exploited perimeter appliances (CVE-2025-0282). In European sports, Real Madrid cemented its Champions League progression.',
    highlights: [
      'Gemini 2.5 Flash demonstrates sub-100ms multi-modal live streaming with 1M context tokens.',
      'CISA emergency catalog addition for Ivanti Connect Secure stack overflow (CVE-2025-0282, CVSS 9.8).',
      'Global semiconductor trade increases 18.4% YoY propelled by data center cluster deployment.',
      'Real Madrid secures 3-1 victory in UEFA Champions League group clash.',
      'arXiv research highlights test-time compute scaling as prime driver of post-training gains.'
    ],
    categories: [
      {
        category: 'Inteligencia Artificial',
        headline: 'Gemini 2.5 Flash y DeepSeek-R1 definen la agenda de inferencia y razonamiento',
        summary: 'La carrera entre modelos propietarios de latencia ultrabaja y modelos abiertos de razonamiento escala la adopción empresarial.',
        sourceCount: 8
      },
      {
        category: 'Ciberseguridad',
        headline: 'Alertas críticas sobre appliances perimetrales en explotación activa',
        summary: 'CISA y NVD registran campañas dirigidas a firewalls y VPNs empresariales con ejecución de código remota.',
        sourceCount: 4
      },
      {
        category: 'Deportes',
        headline: 'Jornada europea de Champions y recta clave en LaLiga',
        summary: 'Dominio de los favoritos continentales con actuaciones destacadas en Madrid, Mánchester y Múnich.',
        sourceCount: 5
      },
      {
        category: 'Economía & Mercados',
        headline: 'Resistencia en índices tecnológicos y repunte de demanda de chips',
        summary: 'S&P 500 y NASDAQ sostienen niveles récord con fuerte soporte en empresas de infraestructura.',
        sourceCount: 6
      }
    ],
    confirmedFacts: [
      'CVE-2025-0282 tiene confirmación de explotación en el catálogo oficial de CISA.',
      'Gemini 2.5 Flash soporta entrada y salida streaming nativa de audio y vídeo.',
      'LaLiga EA Sports mantiene al Real Madrid en primera posición con 65 puntos.'
    ],
    trendsObserved: [
      'Convergencia hacia el protocolo MCP para interoperabilidad de agentes de IA.',
      'Adopción de Rust en el tooling de compilación y servidores de inferencia.',
      'Aceleración de desinversión en perímetros legados no autenticados.'
    ],
    createdAt: new Date().toISOString()
  };

  insertBriefing.run(
    initialBriefing.id,
    initialBriefing.date,
    initialBriefing.title,
    initialBriefing.executiveSummary,
    JSON.stringify(initialBriefing.highlights),
    JSON.stringify(initialBriefing.categories),
    JSON.stringify(initialBriefing.confirmedFacts),
    JSON.stringify(initialBriefing.trendsObserved),
    initialBriefing.createdAt
  );

  // 11. Initial Watchlists
  const insertWatchlist = db.prepare(`
    INSERT INTO watchlists (id, item_type, title, keyword, created_at, match_count, last_matched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const initialWatchlists: WatchlistItem[] = [
    {
      id: 'wl-1',
      itemType: 'company',
      title: 'Google & DeepMind',
      keyword: 'Gemini, DeepMind, Google AI',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      matchCount: 142,
      lastMatchedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'wl-2',
      itemType: 'model',
      title: 'Reasoning Models',
      keyword: 'DeepSeek-R1, o3-mini, Claude 3.7, reasoning',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      matchCount: 89,
      lastMatchedAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'wl-3',
      itemType: 'team',
      title: 'Real Madrid CF',
      keyword: 'Real Madrid, Bernabéu, LaLiga',
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      matchCount: 56,
      lastMatchedAt: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: 'wl-4',
      itemType: 'cve',
      title: 'Critical RCE Exploits',
      keyword: 'KEV_EXPLOITED, CRITICAL, Remote Code Execution',
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      matchCount: 28,
      lastMatchedAt: new Date(Date.now() - 18000000).toISOString()
    }
  ];

  initialWatchlists.forEach(w => {
    insertWatchlist.run(
      w.id,
      w.itemType,
      w.title,
      w.keyword,
      w.createdAt,
      w.matchCount,
      w.lastMatchedAt ?? null
    );
  });

  // Log initial sync event
  db.prepare(`
    INSERT INTO sync_logs (id, source_id, source_name, status, timestamp, duration_ms, records_fetched, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'log-init-1',
    'system-bootstrap',
    'Sentinel Bootstrap Core',
    'SUCCESS',
    new Date().toISOString(),
    42,
    18,
    'Database initialized with full enterprise seed across 12 domain categories.'
  );

  console.log('[SENTINEL] Database seeding complete.');
}

export function ensureAllSourcesRegistered() {
  const upsert = db.prepare(`
    INSERT INTO sources (id, name, category, integration_type, status, last_sync, next_sync, response_time_ms, records_count, error_count, rate_limit, requires_auth, enabled, endpoint_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      integration_type = excluded.integration_type,
      rate_limit = excluded.rate_limit,
      requires_auth = excluded.requires_auth,
      endpoint_url = excluded.endpoint_url
  `);

  const allSources: SourceInfo[] = [
    // Tech & News
    {
      id: 'hacker-news',
      name: 'Hacker News API',
      category: 'tech',
      integrationType: 'Official API',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 15 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 15 * 60000).toISOString(),
      responseTimeMs: 142,
      recordsCount: 45,
      errorCount: 0,
      rateLimit: '10k req/hr (Free)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://hacker-news.firebaseio.com/v0/'
    },
    {
      id: 'techcrunch-rss',
      name: 'TechCrunch Feed',
      category: 'tech',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 10 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 20 * 60000).toISOString(),
      responseTimeMs: 195,
      recordsCount: 32,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://techcrunch.com/feed/'
    },
    {
      id: 'the-verge-rss',
      name: 'The Verge RSS',
      category: 'tech',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 18 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 12 * 60000).toISOString(),
      responseTimeMs: 220,
      recordsCount: 28,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.theverge.com/rss/index.xml'
    },
    {
      id: 'wired-rss',
      name: 'Wired Science & Tech',
      category: 'science',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 30 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 245,
      recordsCount: 18,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.wired.com/feed/rss'
    },
    {
      id: 'ars-technica-rss',
      name: 'Ars Technica Feed',
      category: 'tech',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 210,
      recordsCount: 25,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://feeds.arstechnica.com/arstechnica/index'
    },
    {
      id: 'bbc-world-rss',
      name: 'BBC World News',
      category: 'world',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 180,
      recordsCount: 30,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml'
    },
    {
      id: 'gdelt-doc',
      name: 'MIT Technology Review · IA',
      category: 'ai',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 120 * 60000).toISOString(),
      responseTimeMs: 340,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: 'RSS público',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.technologyreview.com/topic/artificial-intelligence/feed'
    },
    // Cybersecurity
    {
      id: 'cisa-kev',
      name: 'CISA KEV Catalog',
      category: 'security',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 40 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 80 * 60000).toISOString(),
      responseTimeMs: 310,
      recordsCount: 24,
      errorCount: 0,
      rateLimit: 'Unlimited Public Feed',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
    },
    {
      id: 'nvd-nist',
      name: 'NVD / NIST CVE API',
      category: 'security',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 60 * 60000).toISOString(),
      responseTimeMs: 490,
      recordsCount: 15,
      errorCount: 0,
      rateLimit: '5 req / 30s (Public) / 50 (Key)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://services.nvd.nist.gov/rest/json/cves/2.0'
    },
    {
      id: 'first-epss',
      name: 'FIRST EPSS API',
      category: 'security',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 360 * 60000).toISOString(),
      responseTimeMs: 310,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: 'Standard FIRST API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.first.org/data/v1/epss'
    },
    {
      id: 'osv-dev',
      name: 'OSV Open Source Vulnerabilities',
      category: 'security',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 360 * 60000).toISOString(),
      responseTimeMs: 270,
      recordsCount: 12,
      errorCount: 0,
      rateLimit: 'Unlimited Open Source API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.osv.dev/v1/query'
    },
    {
      id: 'bleeping-security-rss',
      name: 'BleepingComputer Security Feed',
      category: 'security',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 230,
      recordsCount: 18,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.bleepingcomputer.com/feed/'
    },
    {
      id: 'krebs-security-rss',
      name: 'Krebs on Security Feed',
      category: 'security',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 250,
      recordsCount: 14,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://krebsonsecurity.com/feed/'
    },
    // AI Models & Dev
    {
      id: 'openrouter-models',
      name: 'OpenRouter Models Catalog',
      category: 'ai',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 720 * 60000).toISOString(),
      responseTimeMs: 380,
      recordsCount: 25,
      errorCount: 0,
      rateLimit: 'Public API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://openrouter.ai/api/v1/models'
    },
    {
      id: 'huggingface-models',
      name: 'Hugging Face Hub API',
      category: 'ai',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 35 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 85 * 60000).toISOString(),
      responseTimeMs: 320,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: 'Rate limited by IP',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://huggingface.co/api/models'
    },
    {
      id: 'github-trending',
      name: 'GitHub REST API',
      category: 'dev',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 25 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 35 * 60000).toISOString(),
      responseTimeMs: 280,
      recordsCount: 30,
      errorCount: 0,
      rateLimit: '60 req/hr (Public) / 5k (Token)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.github.com/search/repositories'
    },
    {
      id: 'devto-articles',
      name: 'DEV Community API',
      category: 'dev',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
      responseTimeMs: 210,
      recordsCount: 15,
      errorCount: 0,
      rateLimit: 'Public API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://dev.to/api/articles'
    },
    {
      id: 'npm-downloads',
      name: 'npm Registry Downloads API',
      category: 'dev',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 720 * 60000).toISOString(),
      responseTimeMs: 190,
      recordsCount: 10,
      errorCount: 0,
      rateLimit: 'Unlimited Point API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.npmjs.org/downloads/point/last-week/'
    },
    {
      id: 'pypi-releases',
      name: 'PyPI JSON API',
      category: 'dev',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 720 * 60000).toISOString(),
      responseTimeMs: 215,
      recordsCount: 8,
      errorCount: 0,
      rateLimit: 'Standard PyPI JSON',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://pypi.org/pypi/'
    },
    // Research
    {
      id: 'arxiv-ai',
      name: 'arXiv Open Research API',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 60 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 180 * 60000).toISOString(),
      responseTimeMs: 420,
      recordsCount: 20,
      errorCount: 0,
      rateLimit: '1 req / 3 sec',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://export.arxiv.org/api/query'
    },
    {
      id: 'openalex-science',
      name: 'OpenAlex Scientific Works',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 55 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 125 * 60000).toISOString(),
      responseTimeMs: 380,
      recordsCount: 25,
      errorCount: 0,
      rateLimit: '100k req/day (Polite pool)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.openalex.org/works'
    },
    // Economy
    {
      id: 'frankfurter-fx',
      name: 'Frankfurter ECB FX Rates',
      category: 'economy',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 5 * 60000).toISOString(),
      responseTimeMs: 160,
      recordsCount: 6,
      errorCount: 0,
      rateLimit: 'Open ECB API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.frankfurter.dev/v1/latest'
    },
    {
      id: 'coingecko-crypto',
      name: 'CoinGecko Crypto API',
      category: 'economy',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 5 * 60000).toISOString(),
      responseTimeMs: 240,
      recordsCount: 4,
      errorCount: 0,
      rateLimit: '30 req/min (Free)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.coingecko.com/api/v3/simple/price'
    },
    {
      id: 'world-bank-data',
      name: 'World Bank Open Data',
      category: 'economy',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 90 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 270 * 60000).toISOString(),
      responseTimeMs: 450,
      recordsCount: 16,
      errorCount: 0,
      rateLimit: 'Unlimited Open Data',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.worldbank.org/v2/'
    },
    {
      id: 'stooq-indices',
      name: 'Índices bursátiles · FRED y Yahoo Finance',
      category: 'economy',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 15 * 60000).toISOString(),
      responseTimeMs: 310,
      recordsCount: 3,
      errorCount: 0,
      rateLimit: 'CSV de FRED y serie diaria de Yahoo Finance',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500,NASDAQCOM'
    },
    // Sports
    {
      id: 'marca-rss',
      name: 'MARCA Deportes RSS',
      category: 'sports',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 12 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 18 * 60000).toISOString(),
      responseTimeMs: 210,
      recordsCount: 22,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://e00-marca.uecdn.es/rss/portada.xml'
    },
    {
      id: 'thesportsdb',
      name: 'TheSportsDB Livescore & League',
      category: 'sports',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date(Date.now() - 8 * 60000).toISOString(),
      nextSync: new Date(Date.now() + 7 * 60000).toISOString(),
      responseTimeMs: 290,
      recordsCount: 15,
      errorCount: 0,
      rateLimit: 'Free Tier (Key 3)',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.thesportsdb.com/api/v1/json/123/'
    },
    {
      id: 'espn-scoreboard',
      name: 'ESPN Live Scoreboard',
      category: 'sports',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 5 * 60000).toISOString(),
      responseTimeMs: 180,
      recordsCount: 10,
      errorCount: 0,
      rateLimit: 'Public Scoreboard API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard'
    },
    {
      id: 'openf1-motorsport',
      name: 'OpenF1 Motorsport API',
      category: 'sports',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 360 * 60000).toISOString(),
      responseTimeMs: 260,
      recordsCount: 5,
      errorCount: 0,
      rateLimit: 'Open F1 Telemetry API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://api.openf1.org/v1/sessions'
    },
    // Science & Disasters
    {
      id: 'usgs-earthquakes',
      name: 'USGS Earthquakes Feed',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 15 * 60000).toISOString(),
      responseTimeMs: 190,
      recordsCount: 8,
      errorCount: 0,
      rateLimit: 'Public GeoJSON Feed',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
    },
    {
      id: 'nasa-eonet',
      name: 'NASA EONET Events',
      category: 'science',
      integrationType: 'REST',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 60 * 60000).toISOString(),
      responseTimeMs: 280,
      recordsCount: 12,
      errorCount: 0,
      rateLimit: 'Open Science API',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events'
    },
    {
      id: 'nasa-apod',
      name: 'NASA · Imagen astronómica del día',
      category: 'science',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 720 * 60000).toISOString(),
      responseTimeMs: 310,
      recordsCount: 1,
      errorCount: 0,
      rateLimit: 'DEMO_KEY / NASA_API_KEY',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://science.nasa.gov/feed/apod-basic/'
    },
    {
      id: 'nasa-rss',
      name: 'NASA Official Feed',
      category: 'science',
      integrationType: 'RSS',
      status: 'STANDBY',
      lastSync: '',
      nextSync: '',
      responseTimeMs: 0,
      recordsCount: 0,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.nasa.gov/feed/'
    },
    {
      id: 'nature-rss',
      name: 'Nature Science Feed',
      category: 'science',
      integrationType: 'RSS',
      status: 'HEALTHY',
      lastSync: new Date().toISOString(),
      nextSync: new Date(Date.now() + 720 * 60000).toISOString(),
      responseTimeMs: 230,
      recordsCount: 15,
      errorCount: 0,
      rateLimit: 'Standard RSS',
      requiresAuth: false,
      enabled: true,
      endpointUrl: 'https://www.nature.com/nature.rss'
    }
  ];

  const editorialSources: SourceInfo[] = editorialFeeds.map(feed => ({
    id: feed.id, name: feed.name, category: feed.category, integrationType: 'RSS',
    status: 'STANDBY', lastSync: '', nextSync: '', responseTimeMs: 0, recordsCount: 0, errorCount: 0,
    rateLimit: 'RSS público', requiresAuth: false, enabled: true, endpointUrl: feed.url,
  }));
  for (const s of [...allSources, ...editorialSources]) {
    upsert.run(
      s.id,
      s.name,
      s.category,
      s.integrationType,
      s.status,
      s.lastSync,
      s.nextSync,
      s.responseTimeMs,
      s.recordsCount,
      s.errorCount,
      s.rateLimit,
      s.requiresAuth ? 1 : 0,
      s.enabled ? 1 : 0,
      s.endpointUrl
    );
  }
}


