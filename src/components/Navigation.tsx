import type { LucideIcon } from 'lucide-react';
import {
  Bell, Bookmark, Bot, Bug, ChevronLeft, ChevronRight, Code2, Cpu, FileText, Globe2,
  GraduationCap, House, MapPin, Newspaper, Radio, Radar, Shield, ShieldAlert, Sliders, TrendingUp, Trophy
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard' | 'news' | 'spain' | 'football-news' | 'ai' | 'dev' | 'research'
  | 'cybersecurity' | 'threats' | 'vulns' | 'economy' | 'sports' | 'radar'
  | 'analyst' | 'briefing' | 'watchlists' | 'alerts' | 'sources' | 'admin';

interface NavigationItem {
  id: ActiveTab;
  label: string;
  icon: LucideIcon;
}

const navigation: { title: string; items: NavigationItem[] }[] = [
  { title: 'Actualidad', items: [
    { id: 'news', label: 'Noticias', icon: Newspaper },
    { id: 'spain', label: 'España', icon: MapPin },
    { id: 'football-news', label: 'Noticias de fútbol', icon: Trophy },
    { id: 'sports', label: 'Marcadores', icon: Radio },
  ] },
  { title: 'Inteligencia', items: [
    { id: 'ai', label: 'Modelos de IA', icon: Cpu },
    { id: 'dev', label: 'Repositorios de GitHub', icon: Code2 },
    { id: 'research', label: 'Investigación', icon: GraduationCap },
    { id: 'economy', label: 'Mercados', icon: TrendingUp },
    { id: 'radar', label: 'Radar tecnológico', icon: Radar },
  ] },
  { title: 'Seguridad', items: [
    { id: 'cybersecurity', label: 'Ciberseguridad', icon: Shield },
    { id: 'threats', label: 'Amenazas (KEV)', icon: ShieldAlert },
    { id: 'vulns', label: 'Vulnerabilidades', icon: Bug },
  ] },
  { title: 'Mi Sentinel', items: [
    { id: 'analyst', label: 'Analista de IA', icon: Bot },
    { id: 'briefing', label: 'Informe diario', icon: FileText },
    { id: 'watchlists', label: 'Listas de seguimiento', icon: Bookmark },
    { id: 'alerts', label: 'Alertas', icon: Bell },
    { id: 'sources', label: 'Centro de fuentes', icon: Radio },
    { id: 'admin', label: 'Administración', icon: Sliders },
  ] },
] as const;

const home = { id: 'dashboard', label: 'Inicio', icon: House } as const;
export const navigationLabels = Object.fromEntries([home, ...navigation.flatMap(group => group.items)].map(item => [item.id, item.label])) as Record<ActiveTab, string>;

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Navigation({ activeTab, setActiveTab, collapsed, setCollapsed }: Props) {
  const itemButton = ({ id, label, icon: Icon }: NavigationItem) => {
    const active = id === activeTab;
    return <button type="button" key={id} onClick={() => setActiveTab(id)} aria-current={active ? 'page' : undefined}
      aria-label={label} title={collapsed ? label : undefined}
      className={'sentinel-nav-item flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ' + (collapsed ? 'justify-center ' : '') + (active ? 'bg-emerald-300/15 font-semibold text-emerald-200' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
      <Icon size={16} className={active ? 'shrink-0 text-emerald-200' : 'shrink-0 text-slate-400'} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>;
  };
  return (
    <aside id="sentinel-navigation" className={'sentinel-sidebar absolute inset-y-0 left-0 z-30 flex shrink-0 flex-col border-r md:relative ' + (collapsed ? 'hidden w-16 md:flex' : 'w-[min(17rem,85vw)] shadow-2xl md:shadow-none')}>
      <div className={'flex min-h-16 items-center border-b border-white/10 ' + (collapsed ? 'justify-center' : 'justify-between px-3')}>
        {!collapsed && <button type="button" onClick={() => setActiveTab('dashboard')} aria-label="Portada de Sentinel" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-emerald-950"><Globe2 size={20} /></span><span className="text-sm font-extrabold tracking-[.16em] text-white">SENTINEL</span>
        </button>}
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="editorial-icon" aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
      </div>
      <nav aria-label="Navegación principal" className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-2.5">
        {itemButton(home)}
        {navigation.map(group => <section key={group.title} aria-label={group.title}>
          {!collapsed && <h2 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{group.title}</h2>}
          <div className="space-y-0.5">{group.items.map(itemButton)}</div>
        </section>)}
      </nav>
    </aside>
  );
}

export function MobileNavigation({ activeTab, onNavigate }: { activeTab: ActiveTab; onNavigate: (tab: ActiveTab) => void }) {
  const primary = [home, ...navigation[0].items.filter(item => item.id !== 'spain')];
  return <nav aria-label="Accesos principales" className="sentinel-bottom-nav grid shrink-0 grid-cols-4 border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
    {primary.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onNavigate(id)} aria-current={activeTab === id ? 'page' : undefined}
      className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold ' + (activeTab === id ? 'text-emerald-300' : 'text-slate-300 hover:text-emerald-200')}><Icon size={17} />{id === 'football-news' ? 'Fútbol' : label}</button>)}
  </nav>;
}
