import type { ScoreboardSport } from './sportsLeagues';

export interface Article {
  id: string;
  title: string;
  description: string;
  content?: string;
  source: string;
  author?: string;
  category: 'tech' | 'ai' | 'science' | 'economy' | 'business' | 'security' | 'sports' | 'world' | 'dev' | 'spain' | 'football';
  publishedAt: string;
  fetchedAt: string;
  url: string;
  imageUrl?: string;
  language?: string;
  country?: string;
  tags?: string[];
  isSaved?: boolean;
  isRead?: boolean;
  isExample?: boolean;
  clusterId?: string;
}

export interface ArticleCluster {
  id: string;
  title: string;
  category: string;
  articleCount: number;
  sources: string[];
  articles: Article[];
  latestPublishedAt: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  releaseDate: string;
  capabilities: string[];
  modalities: string[];
  contextWindow: number | null;
  fetchedAt?: string | null;
  pricingInput1M?: number;
  pricingOutput1M?: number;
  license: string;
  officialUrl: string;
  docsUrl: string;
  status: 'active' | 'preview' | 'deprecated';
  mmluScore?: number;
  mathScore?: number;
  codeScore?: number;
  latencyMs?: number;
  notes?: string;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  owner: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string;
  license?: string;
  url: string;
  growthRate?: string;
  topics?: string[];
}

export interface RankedRepository extends Repository {
  rank: number;
  pushedAt: string;
  createdAt: string;
}

export interface GitHubHighlights {
  updatedAt: string | null;
  popular: RankedRepository[];
  emerging: RankedRepository[];
}

export interface Vulnerability {
  id: string;
  cveId: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'N/D';
  cvssScore: number | null;
  affectedProducts: string[];
  publishedAt: string;
  modifiedAt?: string;
  source: string;
  status: 'KEV_EXPLOITED' | 'ANALYZED' | 'AWAITING_ANALYSIS';
  advisoryUrl: string;
  remediation?: string;
  isKevExploited?: boolean;
}

export interface ResearchPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  publishedAt: string;
  category: string;
  primaryCategory: string;
  arxivId?: string;
  doi?: string;
  pdfUrl?: string;
  citationsCount?: number;
  aiTakeaway?: string;
}

export interface SportsMatch {
  id: string;
  leagueId?: string;
  eventId?: string;
  eventName?: string;
  sport: ScoreboardSport;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  matchTime: string;
  minute?: string;
  venue?: string;
  homeCrest?: string;
  awayCrest?: string;
  sourceUrl?: string;
  highlights?: string;
  tournament?: string;
  providerCompetitionId?: string;
  periods?: { label: string; home: string | null; away: string | null }[];
}

export interface SportsTeam {
  id: string;
  leagueId: string;
  name: string;
  crest?: string;
}

export interface SportsClubDetails {
  sourceUrl: string;
  season?: string;
  competition?: string;
  stadium?: string;
  city?: string;
  capacity?: number;
  coach?: string;
  trophies: { name: string; titles: number; seasons: string[] }[];
  transfers: {
    player: string;
    date: string;
    direction: 'in' | 'out';
    kind: 'loan' | 'free' | 'transfer' | 'unknown';
    club?: string;
    fee?: number;
    estimate?: number;
  }[];
  players: SportsPlayer[];
}

export interface SportsTeamProfile {
  team: SportsTeam;
  recent: SportsMatch[];
  upcoming: SportsMatch[];
  players: SportsPlayer[];
  unavailable: string[];
}

export interface SportsPlayer {
  name: string;
  shortName?: string;
  age?: number;
  nationality?: string;
  height?: number;
  number?: string;
  position?: string;
  photo?: string;
  espnId?: string;
  football?: boolean;
}

export interface SportsMatchDetails {
  stats: { name: string; home: string | null; away: string | null }[];
  events: { id: string; minute: string; title: string; description: string }[];
  lineups: { side: 'home' | 'away'; formation?: string; players: SportsPlayer[] }[];
  previous: { id: string; title: string; home: string; away: string; date: string; url?: string }[];
}

export interface SportsScoreboard {
  matches: SportsMatch[];
  unavailable: string[];
  updatedAt: string | null;
}

export interface SportsStandingsTable {
  sourceUrl?: string;
  season: string;
  rows: SportsStanding[];
  groups: { name: string; rows: SportsStanding[] }[];
}

export interface SportsStanding {
  teamId?: string;
  rank: number;
  team: string;
  competition?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  crest?: string;
}

export interface EconomicIndicator {
  id: string;
  symbol: string;
  name: string;
  category: 'index' | 'commodity' | 'currency' | 'macro' | 'crypto';
  value: number;
  unit: string;
  change: number;
  changePercent: number;
  changeKnown?: boolean;
  updatedAt: string;
  source: string;
  sparkline: number[];
}

export interface TechRadarItem {
  id: string;
  name: string;
  quadrant: 'techniques' | 'platforms' | 'tools' | 'languages_frameworks';
  ring: 'adopt' | 'trial' | 'assess' | 'hold';
  description: string;
  trendingScore: number;
  metrics: string;
  isNew?: boolean;
}

export interface SourceInfo {
  id: string;
  name: string;
  category: string;
  integrationType: 'REST' | 'RSS' | 'GraphQL' | 'Official API';
  status: 'HEALTHY' | 'SYNCING' | 'RATE_LIMITED' | 'ERROR' | 'STANDBY';
  lastSync: string;
  lastSuccessAt?: string | null;
  lastMessage?: string | null;
  nextSync: string;
  responseTimeMs: number;
  recordsCount: number;
  errorCount: number;
  rateLimit: string;
  requiresAuth: boolean;
  enabled: boolean;
  endpointUrl: string;
}

export interface SyncLog {
  id: string;
  sourceId: string;
  sourceName: string;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  timestamp: string;
  durationMs: number;
  recordsFetched: number;
  message: string;
}

export interface DailyBriefing {
  id: string;
  date: string;
  title: string;
  executiveSummary: string;
  highlights: string[];
  categories: {
    category: string;
    headline: string;
    summary: string;
    sourceCount: number;
  }[];
  confirmedFacts: string[];
  trendsObserved: string[];
  createdAt: string;
  sources?: BriefingSource[];
}

export interface BriefingSource {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface WatchlistItem {
  id: string;
  itemType: 'company' | 'model' | 'technology' | 'repo' | 'team' | 'topic' | 'cve';
  title: string;
  keyword: string;
  createdAt: string;
  matchCount: number;
  lastMatchedAt?: string;
}

export interface WatchlistAlert {
  id: string;
  watchlistId: string;
  watchlistTitle: string;
  title: string;
  source: string;
  timestamp: string;
  url: string;
  article?: Article;
}

export interface SystemMetrics {
  totalArticles: number;
  totalModels: number;
  totalRepos: number;
  totalVulnerabilities: number;
  totalPapers: number;
  activeSources: number;
  healthySources: number;
  totalSources: number;
  syncRunning: boolean;
  lastGlobalSync: string | null;
  databaseSizeBytes: number;
}
