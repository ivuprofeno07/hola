import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  fetchDashboard,
  fetchArticles,
  fetchAIModels,
  fetchRepositories,
  fetchVulnerabilities,
  fetchResearch,
  fetchSports,
  fetchEconomy,
  fetchRadar,
  fetchSources,
  fetchBriefings,
  fetchWatchlists,
  fetchAlerts,
  fetchSystemMetrics,
  toggleSaveArticle,
  syncSource,
  syncAllSources,
  toggleSource,
  addWatchlist,
  deleteWatchlist,
  generateBriefing,
  DashboardData,
  ArticlesResponse,
  SportsData,
  SourcesData
} from './lib/api';
import {
  Article,
  AIModel,
  Repository,
  Vulnerability,
  ResearchPaper,
  EconomicIndicator,
  TechRadarItem,
  DailyBriefing,
  WatchlistItem,
  WatchlistAlert,
  SystemMetrics
} from './lib/types';
import { MobileNavigation, Navigation, type ActiveTab } from './components/Navigation';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { NewsView } from './components/NewsView';
import { ArticleDrawer } from './components/ArticleDrawer';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { Bell, X } from 'lucide-react';

const AIIntelligenceView = lazy(() => import('./components/AIIntelligenceView').then(module => ({ default: module.AIIntelligenceView })));
const DeveloperIntelligenceView = lazy(() => import('./components/DeveloperIntelligenceView').then(module => ({ default: module.DeveloperIntelligenceView })));
const CybersecurityView = lazy(() => import('./components/CybersecurityView').then(module => ({ default: module.CybersecurityView })));
const ResearchView = lazy(() => import('./components/ResearchView').then(module => ({ default: module.ResearchView })));
const SportsView = lazy(() => import('./components/SportsView').then(module => ({ default: module.SportsView })));
const BusinessEconomyView = lazy(() => import('./components/BusinessEconomyView').then(module => ({ default: module.BusinessEconomyView })));
const TechRadarView = lazy(() => import('./components/TechRadarView').then(module => ({ default: module.TechRadarView })));
const SourceCenterView = lazy(() => import('./components/SourceCenterView').then(module => ({ default: module.SourceCenterView })));
const AIAnalystView = lazy(() => import('./components/AIAnalystView').then(module => ({ default: module.AIAnalystView })));
const DailyBriefingView = lazy(() => import('./components/DailyBriefingView').then(module => ({ default: module.DailyBriefingView })));
const WatchlistsAlertsView = lazy(() => import('./components/WatchlistsAlertsView').then(module => ({ default: module.WatchlistsAlertsView })));
const AdminView = lazy(() => import('./components/AdminView').then(module => ({ default: module.AdminView })));

const sectionHashes: Record<ActiveTab, string> = {
  dashboard: '', news: '#noticias', spain: '#espana', 'football-news': '#futbol', sports: '#sports',
  ai: '#modelos', dev: '#github', research: '#investigacion', economy: '#mercados', radar: '#radar',
  cybersecurity: '#ciberseguridad', threats: '#amenazas', vulns: '#vulnerabilidades',
  analyst: '#analista', briefing: '#informe', watchlists: '#seguimiento', alerts: '#alertas',
  sources: '#fuentes', admin: '#administracion'
};
function tabFromHash(hash: string): ActiveTab {
  if (hash === '#directos') return 'sports';
  if (hash === '#desarrollo') return 'dev';
  return (Object.keys(sectionHashes) as ActiveTab[]).find(tab => sectionHashes[tab] === hash) ?? 'dashboard';
}

export default function App() {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => tabFromHash(window.location.hash));
  const [sportsLive, setSportsLive] = useState(() => window.location.hash === '#directos');
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const main = useRef<HTMLElement>(null);
  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab);
    setSportsLive(false);
    if (window.matchMedia('(max-width: 767px)').matches) setCollapsed(true);
    const hash = sectionHashes[tab] ?? '';
    if (hash !== window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search + hash);
  }, []);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data States
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [articlesData, setArticlesData] = useState<ArticlesResponse>({ articles: [], clusters: [] });
  const [models, setModels] = useState<AIModel[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [researchPapers, setResearchPapers] = useState<ResearchPaper[]>([]);
  const [sportsData, setSportsData] = useState<SportsData>({ matches: [], standings: [], news: [] });
  const [economy, setEconomy] = useState<EconomicIndicator[]>([]);
  const [radarItems, setRadarItems] = useState<TechRadarItem[]>([]);
  const [sourcesData, setSourcesData] = useState<SourcesData>({ sources: [], logs: [] });
  const [briefings, setBriefings] = useState<DailyBriefing[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  // Modals and Drawers
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeAlertToast, setActiveAlertToast] = useState<{ id: string; title: string; message: string } | null>(null);

  const [failedSections, setFailedSections] = useState<ActiveTab[]>([]);
  const [retrying, setRetrying] = useState(false);
  const loadVersion = useRef(0);
  const loadAllData = useCallback(async () => {
    const version = ++loadVersion.current;
    const failures: ActiveTab[] = [];
    async function load<T>(request: Promise<T>, update: (value: T) => void, ...sections: ActiveTab[]) {
      try {
        const value = await request;
        if (version === loadVersion.current) update(value);
      } catch {
        failures.push(...sections);
      }
    }
    await Promise.all([
      load(fetchDashboard(), setDashboardData, 'dashboard'),
      load(fetchArticles(), setArticlesData, 'news'),
      load(fetchAIModels(), setModels, 'ai'),
      load(fetchRepositories(), setRepositories, 'dev'),
      load(fetchVulnerabilities(), setVulnerabilities, 'cybersecurity', 'threats', 'vulns'),
      load(fetchResearch(), setResearchPapers, 'research'),
      load(fetchSports(), setSportsData, 'sports'),
      load(fetchEconomy(), setEconomy, 'economy'),
      load(fetchRadar(), setRadarItems, 'radar'),
      load(fetchSources(), setSourcesData, 'sources'),
      load(fetchBriefings(), setBriefings, 'briefing'),
      load(fetchWatchlists(), setWatchlists, 'watchlists'),
      load(fetchAlerts(), setAlerts, 'watchlists', 'alerts'),
      load(fetchSystemMetrics(), setSystemMetrics, 'admin'),
    ]);
    if (version === loadVersion.current) {
      setFailedSections(failures);
      setLoading(false);
    }
  }, []);

  async function retryData() {
    setRetrying(true);
    try { await loadAllData(); }
    finally { setRetrying(false); }
  }

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const openSection = () => {
      setActiveTabState(tabFromHash(window.location.hash));
      setSportsLive(window.location.hash === '#directos');
      if (window.matchMedia('(max-width: 767px)').matches) setCollapsed(true);
    };
    window.addEventListener('hashchange', openSection);
    return () => window.removeEventListener('hashchange', openSection);
  }, []);

  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [activeTab, sportsLive]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      void fetchDashboard().then(setDashboardData).catch(() => {});
      void fetchArticles().then(setArticlesData).catch(() => {});
      void fetchSources().then(setSourcesData).catch(() => {});
      void fetchAlerts().then(setAlerts).catch(() => {});
      void fetchWatchlists().then(setWatchlists).catch(() => {});
    };
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.matchMedia('(max-width: 767px)').matches) setCollapsed(true);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(open => !open);
      }
    };
    const media = window.matchMedia('(max-width: 767px)');
    const resize = () => setCollapsed(media.matches);
    window.addEventListener('keydown', openSearch);
    media.addEventListener('change', resize);
    return () => {
      window.removeEventListener('keydown', openSearch);
      media.removeEventListener('change', resize);
    };
  }, []);

  useEffect(() => {
    if (!activeAlertToast) return;
    const timer = window.setTimeout(() => setActiveAlertToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [activeAlertToast]);

  // Global Refresh Action
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      const { results } = await syncAllSources();
      await loadAllData();
      const succeeded = results.filter(result => result.success).length;
      setActiveAlertToast({
        id: `toast-${Date.now()}`,
        title: 'Sincronización global finalizada',
        message: results.length
          ? `${succeeded} de ${results.length} fuentes completadas. ${results.length - succeeded} con incidencias.`
          : 'No hay fuentes activas.'
      });
    } catch (err) {
      console.error('Sync failed:', err);
      setActiveAlertToast({
        id: `toast-${Date.now()}`,
        title: 'Sincronización global interrumpida',
        message: 'No se pudo completar la solicitud. Revisa el centro de fuentes.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle Save Article
  const handleToggleSaveArticle = async (id: string) => {
    try {
      const res = await toggleSaveArticle(id);
      setArticlesData(prev => ({
        ...prev,
        articles: prev.articles.map(a => (a.id === id ? { ...a, isSaved: res.isSaved } : a)),
        clusters: prev.clusters.map(cluster => ({ ...cluster, articles: cluster.articles.map(a => a.id === id ? { ...a, isSaved: res.isSaved } : a) }))
      }));
      if (dashboardData) {
        setDashboardData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            articles: prev.articles.map(a => (a.id === id ? { ...a, isSaved: res.isSaved } : a)),
            editions: {
              spain: prev.editions.spain.map(a => a.id === id ? { ...a, isSaved: res.isSaved } : a),
              football: prev.editions.football.map(a => a.id === id ? { ...a, isSaved: res.isSaved } : a)
            }
          };
        });
      }
      setSelectedArticle(prev => prev?.id === id ? { ...prev, isSaved: res.isSaved } : prev);
    } catch (e) {
      setActiveAlertToast({ id: `save-${id}`, title: 'No se pudo guardar la noticia', message: 'Inténtalo de nuevo.' });
    }
  };

  // Sync specific source
  const handleSyncSource = async (id: string) => {
    const result = await syncSource(id);
    await loadAllData();
    if (!result.success) throw new Error('Source synchronization failed');
  };

  // Toggle source enabled
  const handleToggleSource = async (id: string) => {
    const result = await toggleSource(id);
    setSourcesData(previous => ({ ...previous, sources: previous.sources.map(source => source.id === id ? { ...source, enabled: result.enabled } : source) }));
  };

  // Add Watchlist
  const handleAddWatchlist = async (itemType: string, title: string, keyword: string) => {
    const created = await addWatchlist(itemType, title, keyword);
    setWatchlists(previous => [created, ...previous.filter(item => item.id !== created.id)]);
    await Promise.allSettled([fetchWatchlists().then(setWatchlists), fetchAlerts().then(setAlerts)]);
  };

  // Delete Watchlist
  const handleDeleteWatchlist = async (id: string) => {
    await deleteWatchlist(id);
    setWatchlists(prev => prev.filter(w => w.id !== id));
    setAlerts(prev => prev.filter(alert => alert.watchlistId !== id));
  };

  // Refresh Briefing
  const handleRefreshBriefing = async () => {
    const updated = await generateBriefing();
    setBriefings(prev => [updated, ...prev.filter(b => b.id !== updated.id)]);
  };

  // Refresh Metrics
  const handleRefreshMetrics = async () => {
    const metrics = await fetchSystemMetrics();
    setSystemMetrics(metrics);
  };

  return (
    <div className="sentinel-shell relative flex h-dvh w-full overflow-hidden bg-[#080e10] font-sans text-slate-100 selection:bg-emerald-600/30 selection:text-white">
      <a href="#sentinel-content" onClick={event => { event.preventDefault(); main.current?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-emerald-200 focus:px-4 focus:py-3 focus:text-emerald-950">Saltar al contenido</a>
      {/* Toast Notification Alert */}
      {activeAlertToast && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-50 ml-auto max-w-sm md:inset-x-auto md:bottom-6 md:right-6 md:w-full bg-[#080D14] border border-emerald-500/40 rounded-xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.2)] flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Bell size={18} className="text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-100">{activeAlertToast.title}</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">{activeAlertToast.message}</p>
          </div>
          <button
            onClick={() => setActiveAlertToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {!collapsed && <button type="button" aria-label="Cerrar navegación" onClick={() => setCollapsed(true)} className="absolute inset-0 z-[25] bg-black/60 md:hidden" />}
      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header Bar */}
        <Header
          activeTab={activeTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onRefreshAll={handleRefreshAll}
          isRefreshing={isRefreshing}
          onOpenAnalyst={() => setActiveTab('analyst')}
          onOpenMenu={() => setCollapsed(open => !open)}
          menuOpen={!collapsed}
        />

        {/* View Router */}
        <main id="sentinel-content" tabIndex={-1} ref={main} className="sentinel-main custom-scrollbar min-w-0 flex-1 overflow-y-auto">
          {failedSections.includes(activeTab) && <div role="alert" className="sentinel-card mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm text-amber-200">
            <p>No se pudieron actualizar todos los datos de esta sección.</p>
            <button type="button" className="sentinel-action" onClick={retryData} disabled={retrying}>{retrying ? 'Consultando…' : 'Reintentar'}</button>
          </div>}
          {activeTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              sources={sourcesData}
              alerts={alerts}
              loading={loading}
              onSelectArticle={setSelectedArticle}
              onNavigate={setActiveTab}
              onToggleSaveArticle={handleToggleSaveArticle}
            />
          )}

          {(activeTab === 'news' || activeTab === 'spain' || activeTab === 'football-news') && (
            <NewsView
              key={activeTab}
              edition={activeTab === 'spain' ? 'spain' : activeTab === 'football-news' ? 'football' : undefined}
              sources={sourcesData.sources}
              articles={articlesData.articles}
              clusters={articlesData.clusters}
              onSelectArticle={setSelectedArticle}
              onToggleSave={handleToggleSaveArticle}
              loading={loading}
            />
          )}

          <Suspense fallback={<p className="editorial-page text-sm text-slate-300" role="status">Cargando sección…</p>}>
          {activeTab === 'ai' && (
            <AIIntelligenceView models={models} loading={loading} />
          )}

          {activeTab === 'dev' && (
            <DeveloperIntelligenceView onRefresh={() => handleSyncSource('github-trending')} />
          )}

          {(activeTab === 'cybersecurity' || activeTab === 'threats' || activeTab === 'vulns') && (
            <CybersecurityView key={activeTab} kevOnly={activeTab === 'threats'} vulnerabilityCatalog={activeTab === 'vulns'} vulnerabilities={vulnerabilities} loading={loading} />
          )}

          {activeTab === 'research' && (
            <ResearchView papers={researchPapers} loading={loading} />
          )}

          {activeTab === 'sports' && (
            <SportsView
              key={sportsLive ? 'live' : 'calendar'}
              initialLive={sportsLive}
              news={sportsData.news}
              loading={loading}
              onSelectArticle={setSelectedArticle}
            />
          )}

          {activeTab === 'economy' && (
            <BusinessEconomyView indicators={economy} loading={loading} />
          )}

          {activeTab === 'radar' && (
            <TechRadarView items={radarItems} loading={loading} />
          )}

          {activeTab === 'sources' && (
            <SourceCenterView
              sources={sourcesData.sources}
              logs={sourcesData.logs}
              onSyncSource={handleSyncSource}
              onToggleSource={handleToggleSource}
              onSyncAll={handleRefreshAll}
              isSyncing={isRefreshing}
            />
          )}

          {activeTab === 'analyst' && <AIAnalystView />}

          {activeTab === 'briefing' && (
            <DailyBriefingView
              briefing={briefings[0] || null}
              onRefreshBriefing={handleRefreshBriefing}
              loading={loading}
            />
          )}

          {(activeTab === 'watchlists' || activeTab === 'alerts') && (
            <WatchlistsAlertsView
              watchlists={watchlists}
              onAddWatchlist={handleAddWatchlist}
              onDeleteWatchlist={handleDeleteWatchlist}
              key={activeTab}
              alerts={alerts}
              alertsOnly={activeTab === 'alerts'}
              onSelectArticle={setSelectedArticle}
              loading={loading}
            />
          )}

          {activeTab === 'admin' && (
            <AdminView
              metrics={systemMetrics}
              onRefreshMetrics={handleRefreshMetrics}
              loading={loading}
            />
          )}
          </Suspense>
        </main>
        <MobileNavigation activeTab={activeTab} onNavigate={setActiveTab} />
      </div>

      {/* Article Detail Drawer */}
      <ArticleDrawer key={selectedArticle?.id ?? "closed"}
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onToggleSave={handleToggleSaveArticle}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        articles={articlesData.articles}
        models={models}
        vulnerabilities={vulnerabilities}
        repositories={repositories}
        matches={sportsData.matches}
        onSelectArticle={setSelectedArticle}

      />
    </div>
  );
}



