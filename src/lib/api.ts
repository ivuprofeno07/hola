import {
  Article,
  ArticleCluster,
  AIModel,
  Repository,
  GitHubHighlights,
  Vulnerability,
  ResearchPaper,
  SportsMatch,
  SportsStanding,
  EconomicIndicator,
  TechRadarItem,
  SourceInfo,
  SyncLog,
  DailyBriefing,
  WatchlistItem,
  WatchlistAlert,
  SystemMetrics
} from './types';

export interface DashboardData {
  articles: Article[];
  editions: { spain: Article[]; football: Article[] };
  clusters: ArticleCluster[];
  vulnerabilities: Vulnerability[];
  models: AIModel[];
  repositories: Repository[];
  matches: SportsMatch[];
  economy: EconomicIndicator[];
  sourcesSummary: {
    total: number;
    healthy: number;
  };
}

export interface ArticlesResponse {
  articles: Article[];
  clusters: ArticleCluster[];
}

export interface SportsData {
  matches: SportsMatch[];
  standings: SportsStanding[];
  news: Article[];
}

export interface SourcesData {
  sources: SourceInfo[];
  logs: SyncLog[];
}

function request(input: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(20000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  return fetch(input, { ...options, signal });
}

export async function fetchAlerts(watchlist?: string, signal?: AbortSignal): Promise<WatchlistAlert[]> {
  const response = await request('/api/alerts' + (watchlist ? '?' + new URLSearchParams({ watchlist }) : ''), { signal });
  if (!response.ok) throw new Error('No se pudieron consultar las alertas');
  return response.json();
}

interface SourceSyncResult {
  success: boolean;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await request('/api/dashboard');
  if (!res.ok) throw new Error(`Dashboard error: ${res.statusText}`);
  return res.json();
}

export async function fetchArticles(category?: string, search?: string, saved?: boolean, filters?: { language?: string; source?: string; signal?: AbortSignal }): Promise<ArticlesResponse> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  if (search) params.set('search', search);
  if (saved) params.set('saved', 'true');

  if (filters?.language) params.set('language', filters.language);
  if (filters?.source) params.set('source', filters.source);
  const res = await request(`/api/articles?${params.toString()}`, { signal: filters?.signal });
  if (!res.ok) throw new Error(`Articles error: ${res.statusText}`);
  return res.json();
}

export async function toggleSaveArticle(id: string): Promise<{ id: string; isSaved: boolean }> {
  const res = await request(`/api/articles/${id}/toggle-save`, { method: 'POST' });
  if (!res.ok) throw new Error(`Save toggle error: ${res.statusText}`);
  return res.json();
}

export async function fetchAIModels(): Promise<AIModel[]> {
  const res = await request('/api/ai-models');
  if (!res.ok) throw new Error(`AI Models error: ${res.statusText}`);
  return res.json();
}

export async function fetchGitHubHighlights(signal?: AbortSignal): Promise<GitHubHighlights> {
  const response = await request('/api/repositories/highlights', { signal });
  if (!response.ok) throw new Error('No se pudieron consultar los destacados de GitHub');
  return response.json();
}

export async function fetchRepositories(language?: string, search?: string): Promise<Repository[]> {
  const params = new URLSearchParams();
  if (language && language !== 'all') params.set('language', language);
  if (search) params.set('search', search);

  const res = await request(`/api/repositories?${params.toString()}`);
  if (!res.ok) throw new Error(`Repositories error: ${res.statusText}`);
  return res.json();
}

export async function fetchVulnerabilities(severity?: string, search?: string): Promise<Vulnerability[]> {
  const params = new URLSearchParams();
  if (severity && severity !== 'all') params.set('severity', severity);
  if (search) params.set('search', search);

  const res = await request(`/api/vulnerabilities?${params.toString()}`);
  if (!res.ok) throw new Error(`Vulnerabilities error: ${res.statusText}`);
  return res.json();
}

export async function fetchResearch(): Promise<ResearchPaper[]> {
  const res = await request('/api/research');
  if (!res.ok) throw new Error(`Research error: ${res.statusText}`);
  return res.json();
}

export async function fetchSports(): Promise<SportsData> {
  const res = await request('/api/sports');
  if (!res.ok) throw new Error(`Sports error: ${res.statusText}`);
  return res.json();
}

export async function fetchEconomy(): Promise<EconomicIndicator[]> {
  const res = await request('/api/economy');
  if (!res.ok) throw new Error(`Economy error: ${res.statusText}`);
  return res.json();
}

export async function fetchRadar(): Promise<TechRadarItem[]> {
  const res = await request('/api/radar');
  if (!res.ok) throw new Error(`Radar error: ${res.statusText}`);
  return res.json();
}

export async function fetchSources(): Promise<SourcesData> {
  const res = await request('/api/sources');
  if (!res.ok) throw new Error(`Sources error: ${res.statusText}`);
  return res.json();
}

export async function syncSource(id: string): Promise<SourceSyncResult> {
  const res = await fetch(`/api/sources/${id}/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`Sync error: ${res.statusText}`);
  return res.json();
}

export async function syncAllSources(): Promise<{ results: SourceSyncResult[] }> {
  const res = await fetch('/api/sources/sync-all', { method: 'POST' });
  if (!res.ok) throw new Error(`Sync all error: ${res.statusText}`);
  return res.json();
}

export async function toggleSource(id: string): Promise<{ id: string; enabled: boolean }> {
  const res = await request(`/api/sources/${id}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error(`Toggle source error: ${res.statusText}`);
  return res.json();
}

export async function fetchBriefings(): Promise<DailyBriefing[]> {
  const res = await request('/api/briefings');
  if (!res.ok) throw new Error(`Briefings error: ${res.statusText}`);
  return res.json();
}

export async function generateBriefing(): Promise<DailyBriefing> {
  const res = await request('/api/briefings/generate', { method: 'POST' });
  if (!res.ok) throw new Error(`Briefing generation error: ${res.statusText}`);
  return res.json();
}

export async function fetchWatchlists(): Promise<WatchlistItem[]> {
  const res = await request('/api/watchlists');
  if (!res.ok) throw new Error(`Watchlists error: ${res.statusText}`);
  return res.json();
}

export async function addWatchlist(itemType: string, title: string, keyword: string): Promise<WatchlistItem> {
  const res = await request('/api/watchlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemType, title, keyword })
  });
  if (!res.ok) throw new Error(`Add watchlist error: ${res.statusText}`);
  return res.json();
}

export async function deleteWatchlist(id: string): Promise<void> {
  const res = await request(`/api/watchlists/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete watchlist error: ${res.statusText}`);
}

export async function askAiAnalyst(question: string, history: Array<{ role: string; content: string }> = []): Promise<string> {
  const res = await request('/api/ai/analyst', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history })
  });
  if (!res.ok) throw new Error(`AI Analyst error: ${res.statusText}`);
  const data = await res.json();
  return data.answer;
}

export async function fetchArticleTakeaway(title: string, description: string): Promise<string[]> {
  const res = await request('/api/ai/takeaway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description })
  });
  if (!res.ok) throw new Error(`Takeaway error: ${res.statusText}`);
  const data = await res.json();
  return data.takeaway;
}

export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  const res = await request('/api/system/metrics');
  if (!res.ok) throw new Error(`Metrics error: ${res.statusText}`);
  return res.json();
}
