import { Bot, Globe2, Menu, RotateCw, Search } from 'lucide-react';
import { navigationLabels, type ActiveTab } from './Navigation';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenSearch: () => void;
  onRefreshAll: () => Promise<void>;
  isRefreshing: boolean;
  onOpenAnalyst: () => void;
  onOpenMenu: () => void;
  menuOpen: boolean;
}

export function Header({ activeTab, onOpenSearch, onRefreshAll, isRefreshing, onOpenAnalyst, onOpenMenu, menuOpen }: HeaderProps) {
  return (
    <header className="sentinel-topbar z-20 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className="editorial-icon shrink-0 md:hidden" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="sentinel-navigation" onClick={onOpenMenu}><Menu size={19} /></button>
        <Globe2 size={17} className="hidden shrink-0 text-emerald-300 sm:block" />
        <span className="truncate text-sm font-bold text-slate-100">{activeTab === 'dashboard' ? 'Portada' : navigationLabels[activeTab]}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={onOpenSearch} className="sentinel-action" aria-label="Buscar en Sentinel"><Search size={16} /> <span className="hidden md:inline">Buscar</span><kbd className="hidden text-[10px] text-slate-400 xl:inline">Ctrl K</kbd></button>
        <button type="button" onClick={onOpenAnalyst} className="sentinel-action" aria-label="Abrir analista de IA"><Bot size={16} /> <span className="hidden md:inline">Analista</span></button>
        <button type="button" onClick={onRefreshAll} disabled={isRefreshing} className="sentinel-action" aria-label={isRefreshing ? 'Sincronizando fuentes' : 'Sincronizar fuentes'}><RotateCw size={16} className={isRefreshing ? 'animate-spin' : ''} /><span className="hidden sm:inline">{isRefreshing ? 'Sincronizando…' : 'Actualizar'}</span></button>
      </div>
    </header>
  );
}
