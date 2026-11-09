import { getFederationRound, getFederationStandings, getFederationTeams, getFederationTeamProfile } from './server/federationFootball';
import { getWatchlistMatches } from './server/watchlistMatches';
import express from 'express';
import { getSportsClubDetails } from './server/clubDetails';
import { createServer as createViteServer } from 'vite';
import { initDatabase, db } from './server/db';
import { startBackgroundScheduler, triggerSourceSync, syncAllActiveSources, isSynchronizationActive } from './server/scheduler';
import { askAiAnalyst, generateDailyBriefing, generateArticleTakeaway } from './server/aiService';
import { clusterArticles } from './src/utils/deduplication';
import { Article } from './src/lib/types';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getLiveSports, getSportsMatchDetails, getSportsScoreboard, getSportsStandings, getSportsTeamProfile, getSportsTeams } from './server/sportsScoreboard';
import { findScoreboardLeagues, getSportsCatalog, resolveTeamLeague } from './server/sportsCatalog';
import { footballPortraits } from './server/playerPortraits';
import { sportsDay } from './src/utils/sportsDates';
import type { GitHubHighlights } from './src/lib/types';
import { formatArticle, liveArticles, liveMarkets, liveModels, liveRepositories, liveResearch } from './server/dataRecords';
import { scoreboardSports, sportsLeagues, spanishFederationDivisions, standingsLeagues } from './src/lib/sportsLeagues';

const PORT = Number(process.env.PORT ?? 3000);
const bindHost = process.env.SENTINEL_HOST?.trim() || '127.0.0.1';
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', (req, res, next) => {
    const host = req.get('host') ?? '';
    if (bindHost === '127.0.0.1' && !/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(host)) {
      return res.status(403).json({ error: 'Invalid local host' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if ((origin && ![`http://${host}`, `https://${host}`].includes(origin)) || req.get('sec-fetch-site') === 'cross-site') {
        return res.status(403).json({ error: 'Cross-origin changes are blocked' });
      }
    }
    next();
  });

  // Security headers & anti-sniffing
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // 1. Initialize SQLite Database
  initDatabase();

  // 2. Start Background Autonomous Scheduler
  startBackgroundScheduler();

  // 3. API Endpoints
  // Global Dashboard Summary
  app.get('/api/dashboard', (req, res) => {
    try {
      const articles = db.prepare(`SELECT * FROM articles WHERE ${liveArticles} ORDER BY julianday(published_at) DESC LIMIT 8`).all() as any[];
      const vulns = db.prepare("SELECT * FROM vulnerabilities WHERE id NOT LIKE 'vuln-%' ORDER BY cvss_score DESC LIMIT 5").all() as any[];
      const models = db.prepare(`SELECT * FROM ai_models WHERE ${liveModels} ORDER BY release_date DESC LIMIT 6`).all() as any[];
      const repos = db.prepare(`SELECT * FROM repositories WHERE ${liveRepositories} ORDER BY stars DESC LIMIT 5`).all() as any[];
      const matches = db.prepare("SELECT * FROM sports_matches WHERE id NOT LIKE 'match-%' AND julianday(match_time) BETWEEN julianday('now', '-2 days') AND julianday('now', '+7 days') ORDER BY match_time DESC LIMIT 4").all() as any[];
      const economy = db.prepare(`SELECT * FROM economic_indicators WHERE ${liveMarkets} ORDER BY updated_at DESC LIMIT 6`).all() as any[];
      const sources = db.prepare("SELECT count(*) as total, sum(CASE WHEN status='HEALTHY' THEN 1 ELSE 0 END) as healthy FROM sources").get() as any;



      const formattedArticles = articles.map(formatArticle);
      const editionRows = db.prepare(`SELECT * FROM articles WHERE ${liveArticles} AND category = ? AND (category <> 'football' OR language = 'es')
        ORDER BY julianday(published_at) DESC LIMIT 4`);
      const clusters = clusterArticles(formattedArticles);

      res.json({
        articles: formattedArticles,
        editions: { spain: editionRows.all('spain').map(formatArticle), football: editionRows.all('football').map(formatArticle) },
        clusters,
        vulnerabilities: vulns.map(v => ({
          ...v,
          cveId: v.cve_id,
          cvssScore: v.cvss_score !== null && v.cvss_score !== undefined ? Number(v.cvss_score) : null,
          severity: v.severity || 'N/D',
          affectedProducts: v.affected_products ? JSON.parse(v.affected_products) : [],
          publishedAt: v.published_at,
          modifiedAt: v.modified_at,
          advisoryUrl: v.advisory_url,
          isKevExploited: Boolean(v.is_kev_exploited)
        })),
        models: models.map(m => ({
          ...m,
          releaseDate: m.release_date,
          capabilities: m.id.startsWith('hf-') && m.capabilities ? JSON.parse(m.capabilities) : [],
          modalities: m.modalities ? JSON.parse(m.modalities) : [],
          contextWindow: m.id.startsWith('hf-') ? null : m.context_window,
        fetchedAt: db.prepare("SELECT MAX(timestamp) AS timestamp FROM sync_logs WHERE source_id = ? AND status = 'SUCCESS'")
          .get(m.id.startsWith('hf-') ? 'huggingface-models' : 'openrouter-models')?.timestamp ?? null,
          pricingInput1M: m.id.startsWith('hf-') ? null : m.pricing_input_1m,
          pricingOutput1M: m.id.startsWith('hf-') ? null : m.pricing_output_1m,
          officialUrl: m.official_url,
          docsUrl: m.docs_url,
          mmluScore: m.mmlu_score,
          mathScore: m.math_score,
          codeScore: m.code_score,
          latencyMs: m.latency_ms
        })),
        repositories: repos.map(r => ({
          ...r,
          fullName: r.full_name,
          openIssues: r.open_issues,
          updatedAt: r.updated_at,
          growthRate: r.growth_rate,
          topics: r.topics ? JSON.parse(r.topics) : []
        })),
        matches: matches.map(m => ({
          ...m,
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          homeScore: m.home_score,
          awayScore: m.away_score,
          matchTime: m.match_time,
          homeCrest: m.home_crest,
          awayCrest: m.away_crest,
          sourceUrl: m.source_url
        })),
        economy: economy.map(e => ({
          ...e,
          changePercent: e.change_percent,
        changeKnown: Boolean(e.change_known),
          updatedAt: e.updated_at,
          sparkline: JSON.parse(e.sparkline)
        })),
        sourcesSummary: {
          total: sources.total || 0,
          healthy: sources.healthy || 0
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Articles Feed & Event Clustering
  app.get('/api/articles', (req, res) => {
    try {
      const { category, search, saved, language, source } = req.query;
      let query = saved === 'true' ? 'SELECT * FROM articles WHERE is_saved = 1' : 'SELECT * FROM articles WHERE ' + liveArticles;
      const params: any[] = [];

      if (typeof category === 'string' && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
      }

      if (language === 'es' || language === 'en') {
        query += ' AND language = ?';
        params.push(language);
      }
      if (typeof source === 'string' && source.trim()) {
        query += ' AND source = ?';
        params.push(source.trim());
      }

      if (search && typeof search === 'string' && search.trim()) {
        query += ' AND (instr(fold_text(title), fold_text(?)) OR instr(fold_text(description), fold_text(?)) OR instr(fold_text(source), fold_text(?)))';
        const term = search.trim().slice(0, 200);
        params.push(term, term, term);
      }

      query += saved === 'true' ? ' ORDER BY julianday(published_at) DESC' : ' ORDER BY julianday(published_at) DESC LIMIT 80';

      const rows = db.prepare(query).all(...params) as any[];
      const articles = rows.map(formatArticle);

      const clusters = clusterArticles(articles);

      res.json({ articles, clusters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle Save Article
  app.post('/api/articles/:id/toggle-save', (req, res) => {
    try {
      const { id } = req.params;
      const article = db.prepare('SELECT is_saved FROM articles WHERE id = ?').get(id) as any;
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const newState = article.is_saved ? 0 : 1;
      db.prepare('UPDATE articles SET is_saved = ? WHERE id = ?').run(newState, id);
      res.json({ id, isSaved: Boolean(newState) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Models
  app.get('/api/ai-models', (req, res) => {
    try {
      const models = db.prepare(`SELECT * FROM ai_models WHERE ${liveModels} ORDER BY release_date DESC, name`).all() as any[];
      res.json(models.map(m => ({
        ...m,
        releaseDate: m.release_date,
        capabilities: m.id.startsWith('hf-') && m.capabilities ? JSON.parse(m.capabilities) : [],
        modalities: m.modalities ? JSON.parse(m.modalities) : [],
        contextWindow: m.id.startsWith('hf-') ? null : m.context_window,
        fetchedAt: db.prepare("SELECT MAX(timestamp) AS timestamp FROM sync_logs WHERE source_id = ? AND status = 'SUCCESS'")
          .get(m.id.startsWith('hf-') ? 'huggingface-models' : 'openrouter-models')?.timestamp ?? null,
        pricingInput1M: m.id.startsWith('hf-') ? null : m.pricing_input_1m,
        pricingOutput1M: m.id.startsWith('hf-') ? null : m.pricing_output_1m,
        officialUrl: m.official_url,
        docsUrl: m.docs_url,
        mmluScore: m.mmlu_score,
        mathScore: m.math_score,
        codeScore: m.code_score,
        latencyMs: m.latency_ms
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Repositories
  app.get('/api/repositories/highlights', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT r.*, g.ranking, g.position, g.collected_at, g.pushed_at, g.created_at
        FROM github_rankings g JOIN repositories r ON r.id = g.repo_id ORDER BY g.position`).all() as any[];
      const highlights: GitHubHighlights = { updatedAt: rows[0]?.collected_at ?? null, popular: [], emerging: [] };
      for (const row of rows) {
        const collection = row.ranking === 'popular' ? highlights.popular : highlights.emerging;
        collection.push({
          id: row.id, name: row.name, fullName: row.full_name, description: row.description ?? '',
          owner: row.owner, language: row.language, stars: row.stars, forks: row.forks, openIssues: row.open_issues,
          updatedAt: row.updated_at, license: row.license, url: row.url, growthRate: row.growth_rate,
          topics: row.topics ? JSON.parse(row.topics) : [],
          rank: row.position, pushedAt: row.pushed_at, createdAt: row.created_at
        });
      }
      res.json(highlights);
    } catch {
      res.status(500).json({ error: 'GitHub rankings unavailable' });
    }
  });

  app.get('/api/repositories', (req, res) => {
    try {
      const { language, search } = req.query;
      let query = `SELECT * FROM repositories WHERE ${liveRepositories}`;
      const params: any[] = [];

      if (language && language !== 'all') {
        query += ' AND language = ?';
        params.push(language);
      }
      if (search && typeof search === 'string') {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY stars DESC LIMIT 40';
      const repos = db.prepare(query).all(...params) as any[];

      res.json(repos.map(r => ({
        ...r,
        fullName: r.full_name,
        openIssues: r.open_issues,
        updatedAt: r.updated_at,
        growthRate: r.growth_rate,
        topics: r.topics ? JSON.parse(r.topics) : []
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vulnerabilities
  app.get('/api/vulnerabilities', (req, res) => {
    try {
      const { severity, search } = req.query;
      let query = "SELECT * FROM vulnerabilities WHERE id NOT LIKE 'vuln-%'";
      const params: any[] = [];

      if (severity && severity !== 'all') {
        query += ' AND severity = ?';
        params.push(severity);
      }
      if (search && typeof search === 'string') {
        query += ' AND (cve_id LIKE ? OR title LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY CASE WHEN cvss_score IS NULL THEN 1 ELSE 0 END, cvss_score DESC LIMIT 40';
      const vulns = db.prepare(query).all(...params) as any[];

      res.json(vulns.map(v => ({
        ...v,
        cveId: v.cve_id,
        cvssScore: v.cvss_score !== null && v.cvss_score !== undefined ? Number(v.cvss_score) : null,
        severity: v.severity || 'N/D',
        affectedProducts: v.affected_products ? JSON.parse(v.affected_products) : [],
        publishedAt: v.published_at,
        modifiedAt: v.modified_at,
        advisoryUrl: v.advisory_url,
        isKevExploited: Boolean(v.is_kev_exploited)
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Research Papers
  app.get('/api/research', (req, res) => {
    try {
      const papers = db.prepare(`SELECT * FROM research_papers WHERE ${liveResearch} ORDER BY julianday(published_at) DESC LIMIT 40`).all() as any[];
      res.json(papers.map(p => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        publishedAt: p.published_at,
        primaryCategory: p.primary_category,
        arxivId: p.arxiv_id,
        pdfUrl: p.pdf_url,
        citationsCount: p.citations_count,
        aiTakeaway: p.ai_takeaway
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sports Center
  app.get('/api/sports/competitions', async (_req, res) => {
    res.json(await getSportsCatalog());
  });

  app.get('/api/sports/live', async (_req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getLiveSports());
    } catch {
      res.status(502).json({ error: 'Live scores unavailable' });
    }
  });

  app.get('/api/sports/portraits', async (req, res) => {
    const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(','))] : [];
    if (!ids.length || ids.length > 60 || ids.some(id => !/^\d{1,12}$/.test(id))) {
      return res.status(400).json({ error: 'Invalid player identifiers' });
    }
    res.json(await footballPortraits(ids));
  });

  app.get('/api/sports/scoreboard', async (req, res) => {
    const day = req.query.date ?? sportsDay();
    const sport = scoreboardSports.find(item => item.id === (req.query.sport ?? 'football'))?.id;
    const selection = req.query.leagues;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)
        || Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day
        || day < '2000-01-01' || day > '2099-12-31'
        || !sport) {
      return res.status(400).json({ error: 'Invalid scoreboard date or sport' });
    }
    const ids = typeof selection === 'string' && selection.length <= 800 ? selection.split(',') : undefined;
    if (selection !== undefined && (!ids || (await findScoreboardLeagues(sport, ids)).length !== new Set(ids).size)) {
      return res.status(400).json({ error: 'Unknown competition' });
    }
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getSportsScoreboard(day, sport, ids));
    } catch {
      res.status(502).json({ error: 'Scoreboard provider unavailable' });
    }
  });

  app.get('/api/sports/teams', async (req, res) => {
    const { league } = req.query;
    const division = spanishFederationDivisions.find(item => item.id === league);
    if (typeof league !== 'string' || (!division && !await resolveTeamLeague(league))) return res.status(400).json({ error: 'Invalid league' });
    try {
      res.json(division ? await getFederationTeams(division) : await getSportsTeams(league));
    } catch {
      res.status(502).json({ error: 'Team directory unavailable' });
    }
  });

  app.get('/api/sports/team', async (req, res) => {
    const { league, team } = req.query;
    const division = spanishFederationDivisions.find(item => item.id === league);
    if (typeof league !== 'string' || typeof team !== 'string'
        || (division ? !/^as-[a-f0-9]{16}$/.test(team) : !/^\d{1,12}$/.test(team) || !await resolveTeamLeague(league))) {
      return res.status(400).json({ error: 'Invalid team' });
    }
    try {
      res.set('Cache-Control', 'no-store');
      const profile = division ? await getFederationTeamProfile(division, team) : await getSportsTeamProfile(league, team);
      res.json(profile);
    } catch {
      res.status(502).json({ error: 'Team profile unavailable' });
    }
  });

  app.get('/api/sports/club', async (req, res) => {
    const { league, team } = req.query;
    const division = spanishFederationDivisions.find(item => item.id === league);
    if (typeof league !== 'string' || typeof team !== 'string'
        || (division ? !/^as-[a-f0-9]{16}$/.test(team) : !/^\d{1,12}$/.test(team) || !await resolveTeamLeague(league))) {
      return res.status(400).json({ error: 'Invalid team' });
    }
    try {
      const identity = division ? (await getFederationTeams(division)).find(item => item.id === team) : (await getSportsTeamProfile(league, team)).team;
      if (!identity) return res.status(404).json({ error: 'Unknown club' });
      res.json(await getSportsClubDetails(identity));
    } catch {
      res.status(502).json({ error: 'Club details unavailable' });
    }
  });

  app.get('/api/sports/match', async (req, res) => {
    const { league, event } = req.query;
    if (typeof league !== 'string' || typeof event !== 'string' || !/^\d{1,16}$/.test(event)
        || !await resolveTeamLeague(league)) {
      return res.status(400).json({ error: 'Invalid match' });
    }
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getSportsMatchDetails(league, event));
    } catch {
      res.status(502).json({ error: 'Match details unavailable' });
    }
  });

  app.get('/api/sports/federation', async (req, res) => {
    const division = spanishFederationDivisions.find(item => item.id === req.query.league);
    const value = req.query.round;
    const round = typeof value === 'string' && /^\d{1,2}$/.test(value) ? Number(value) : undefined;
    if (!division || (value !== undefined && (!round || round > 50))) return res.status(400).json({ error: 'Invalid federation round' });
    try {
      const { matches, totalRounds, round: selectedRound, updatedAt, unavailable } = await getFederationRound(division, round);
      res.json({ matches, totalRounds, round: selectedRound, updatedAt, unavailable });
    } catch {
      res.status(502).json({ error: 'Federation results unavailable' });
    }
  });

  app.get('/api/sports/standings', async (req, res) => {
    const { league } = req.query;
    if (typeof league !== 'string' || !standingsLeagues.some(item => item.id === league)) {
      return res.status(400).json({ error: 'Unsupported league' });
    }
    try {
      const division = spanishFederationDivisions.find(item => item.id === league);
      if (division) return res.json(await getFederationStandings(division));
      const { season, rows, groups } = await getSportsStandings(league);
      res.json({ season, rows, groups });
    } catch {
      res.status(502).json({ error: 'Standings provider unavailable' });
    }
  });

  app.get('/api/sports', (req, res) => {
    try {
      const matches = db.prepare("SELECT * FROM sports_matches WHERE id NOT LIKE 'match-%' ORDER BY match_time DESC").all() as any[];
      const standings = db.prepare('SELECT * FROM sports_standings ORDER BY competition, rank ASC').all() as any[];
      const news = db.prepare("SELECT * FROM articles WHERE category IN ('sports', 'football') AND id NOT LIKE 'art-%' ORDER BY julianday(published_at) DESC LIMIT 6").all() as any[];

      res.json({
        matches: matches.map(m => ({
          ...m,
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          homeScore: m.home_score,
          awayScore: m.away_score,
          matchTime: m.match_time,
          homeCrest: m.home_crest,
          awayCrest: m.away_crest,
          sourceUrl: m.source_url
        })),
        standings: standings.map(s => ({
          ...s,
          goalDiff: s.goal_diff
        })),
        news: news.map(formatArticle)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Economic & Market Indicators
  app.get('/api/economy', (req, res) => {
    try {
      const indicators = db.prepare(`SELECT * FROM economic_indicators WHERE ${liveMarkets} ORDER BY category, symbol`).all() as any[];
      res.json(indicators.map(e => ({
        ...e,
        changePercent: e.change_percent,
        changeKnown: Boolean(e.change_known),
        updatedAt: e.updated_at,
        sparkline: JSON.parse(e.sparkline)
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tech Radar
  app.get('/api/radar', (req, res) => {
    try {
      const items = db.prepare("SELECT * FROM tech_radar ORDER BY (id LIKE 'tr-%'), name COLLATE NOCASE").all() as any[];
      res.json(items.map(t => ({
        id: t.id, name: t.id === 'tr-7' ? 'Rust' : t.name, description: t.description,
        quadrant: t.quadrant, ring: t.ring, metrics: t.id.startsWith('tr-') ? '' : t.metrics,
        trendingScore: t.trending_score,
        isNew: !t.id.startsWith('tr-') && Boolean(t.is_new)
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sources Center
  app.get('/api/sources', (req, res) => {
    try {
      const sources = db.prepare(`
        SELECT s.*,
          (SELECT MAX(timestamp) FROM sync_logs WHERE source_id = s.id AND status = 'SUCCESS') AS last_success_at,
          (SELECT message FROM sync_logs WHERE source_id = s.id ORDER BY timestamp DESC, id DESC LIMIT 1) AS last_message,
          (SELECT timestamp FROM sync_logs WHERE source_id = s.id ORDER BY timestamp DESC, id DESC LIMIT 1) AS last_attempt_at
        FROM sources s ORDER BY category, name ASC
      `).all() as any[];
      const logs = db.prepare('SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 20').all() as any[];

      res.json({
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          integrationType: s.integration_type,
          status: !s.last_attempt_at ? 'STANDBY' : s.status === 'ERROR' && /\b429\b/.test(s.last_message ?? '') ? 'RATE_LIMITED' : s.status,
          lastSync: s.last_attempt_at ?? '',
          lastSuccessAt: s.last_success_at,
          lastMessage: s.last_message,
          nextSync: s.next_sync,
          responseTimeMs: s.response_time_ms,
          recordsCount: s.records_count,
          errorCount: s.error_count,
          rateLimit: s.rate_limit,
          requiresAuth: Boolean(s.requires_auth),
          enabled: Boolean(s.enabled),
          endpointUrl: s.endpoint_url
        })),
        logs: logs.map(l => ({
          id: l.id,
          sourceId: l.source_id,
          sourceName: l.source_name,
          status: l.status,
          timestamp: l.timestamp,
          durationMs: l.duration_ms,
          recordsFetched: l.records_fetched,
          message: l.message
        }))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sync specific source manually
  app.post('/api/sources/:id/sync', async (req, res) => {
    try {
      const { id } = req.params;
      const source = db.prepare('SELECT enabled FROM sources WHERE id = ?').get(id);
      if (!source) return res.status(404).json({ error: 'Source not found' });
      if (!source.enabled) return res.status(409).json({ error: 'Source is paused' });
      const result = await triggerSourceSync(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sync all sources
  app.post('/api/sources/sync-all', async (req, res) => {
    try {
      if (isSynchronizationActive()) {
        return res.status(409).json({
          success: false,
          error: 'SYNC_IN_PROGRESS',
          message: 'A synchronization cycle is already running. Please allow it to complete.'
        });
      }
      const results = await syncAllActiveSources();
      res.json({ success: results.every(result => result.success), results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sync status
  app.get('/api/sync/status', (req, res) => {
    res.json({ isRunning: isSynchronizationActive() });
  });

  // Toggle Source active status
  app.post('/api/sources/:id/toggle', (req, res) => {
    try {
      const { id } = req.params;
      const source = db.prepare('SELECT enabled FROM sources WHERE id = ?').get(id) as any;
      if (!source) return res.status(404).json({ error: 'Source not found' });

      const newState = source.enabled ? 0 : 1;
      db.prepare('UPDATE sources SET enabled = ? WHERE id = ?').run(newState, id);
      res.json({ id, enabled: Boolean(newState) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Daily Briefings
  app.get('/api/briefings', (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY date ORDER BY created_at DESC) AS position FROM daily_briefings WHERE id <> 'briefing-2026-11-03') WHERE position = 1 ORDER BY created_at DESC LIMIT 10").all() as any[];
      res.json(rows.map(b => ({
        id: b.id,
        date: b.date,
        title: b.title,
        executiveSummary: b.executive_summary,
        highlights: JSON.parse(b.highlights),
        categories: JSON.parse(b.categories),
        confirmedFacts: JSON.parse(b.confirmed_facts),
        trendsObserved: JSON.parse(b.trends_observed),
        createdAt: b.created_at,
        sources: JSON.parse(b.sources_json)
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generate Daily Briefing
  app.post('/api/briefings/generate', async (req, res) => {
    try {
      const briefing = await generateDailyBriefing();
      res.json(briefing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Watchlists
  app.get('/api/alerts', (req, res) => {
    const watchlist = typeof req.query.watchlist === 'string' ? req.query.watchlist : undefined;
    res.json(getWatchlistMatches(watchlist).slice(0, 100));
  });

  app.get('/api/watchlists', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM watchlists ORDER BY created_at DESC').all() as any[];
      const alerts = getWatchlistMatches();
      res.json(rows.map(w => ({
        id: w.id,
        itemType: w.item_type,
        title: w.title,
        keyword: w.keyword,
        createdAt: w.created_at,
        matchCount: alerts.filter(alert => alert.watchlistId === w.id).length,
        lastMatchedAt: alerts.find(alert => alert.watchlistId === w.id)?.timestamp
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/watchlists', (req, res) => {
    try {
      const { itemType, title, keyword } = req.body;
      const validItemTypes = ['company', 'model', 'technology', 'repo', 'team', 'topic', 'cve'];
      const sanitizedType = validItemTypes.includes(itemType) ? itemType : 'topic';

      if (!title || typeof title !== 'string' || !title.trim() || !keyword || typeof keyword !== 'string' || !keyword.trim()) {
        return res.status(400).json({ error: 'Title and keyword must be non-empty strings' });
      }

      const cleanTitle = title.trim().slice(0, 100);
      const cleanKeyword = keyword.trim().slice(0, 100);

      const id = `wl-${randomUUID()}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO watchlists (id, item_type, title, keyword, created_at, match_count, last_matched_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(id, sanitizedType, cleanTitle, cleanKeyword, now, now);

      res.status(201).json({ id, itemType: sanitizedType, title: cleanTitle, keyword: cleanKeyword, createdAt: now, matchCount: 0 });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create watchlist record' });
    }
  });

  app.delete('/api/watchlists/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM watchlists WHERE id = ?').run(id);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Analyst Assistant
  app.get('/api/ai/status', (_req, res) => {
    res.json({ configured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
  });

  app.post('/api/ai/analyst', async (req, res) => {
    try {
      const { question, history } = req.body ?? {};
      if (typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const answer = await askAiAnalyst(question, history || []);
      res.json({ answer, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Article Takeaway
  app.post('/api/ai/takeaway', async (req, res) => {
    try {
      const { title, description } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || (description !== undefined && typeof description !== 'string')) {
        return res.status(400).json({ error: 'Invalid article' });
      }
      const takeaway = await generateArticleTakeaway(title.slice(0, 500), (description ?? '').slice(0, 3000));
      res.json({ takeaway });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // System Stats
  app.get('/api/system/metrics', (req, res) => {
    try {
      const artCount = db.prepare('SELECT count(*) as c FROM articles').get() as any;
      const modCount = db.prepare('SELECT count(*) as c FROM ai_models').get() as any;
      const repCount = db.prepare('SELECT count(*) as c FROM repositories').get() as any;
      const vulCount = db.prepare('SELECT count(*) as c FROM vulnerabilities').get() as any;
      const papCount = db.prepare('SELECT count(*) as c FROM research_papers').get() as any;
      const sourceCounts = db.prepare(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE enabled = 1) AS active,
        COUNT(*) FILTER (WHERE enabled = 1 AND status = 'HEALTHY' AND EXISTS (
          SELECT 1 FROM sync_logs WHERE source_id = sources.id AND status = 'SUCCESS'
        )) AS healthy FROM sources`).get()!;

      let dbSize = 0;
      const dbFile = path.resolve(process.cwd(), 'data/sentinel.sqlite');
      for (const file of [dbFile, dbFile + '-wal']) {
        dbSize += fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0;
      }

      res.json({
        totalArticles: artCount.c,
        totalModels: modCount.c,
        totalRepos: repCount.c,
        totalVulnerabilities: vulCount.c,
        totalPapers: papCount.c,
        activeSources: sourceCounts.active,
        healthySources: sourceCounts.healthy,
        totalSources: sourceCounts.total,
        syncRunning: isSynchronizationActive(),
        lastGlobalSync: db.prepare("SELECT MAX(timestamp) AS timestamp FROM sync_logs WHERE source_id <> 'system-bootstrap' AND status = 'SUCCESS'").get()?.timestamp ?? null,
        databaseSizeBytes: dbSize
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // 4. Vite middleware integration for full-stack dev server
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, bindHost, () => {
    console.log(`[SENTINEL CORE] Server running at http://${bindHost}:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[SENTINEL FATAL] Startup failed:', err);
  process.exit(1);
});




