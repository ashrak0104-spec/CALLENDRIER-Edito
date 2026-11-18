import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronsUpDown,
  ListChecks,
  Moon,
  Settings,
  Sun,
  Table2,
} from 'lucide-react';
import { isDesktop } from '../lib/api';
import { monthKeyOf } from '../lib/dates';
import { cx } from '../lib/utils';
import { useEditorial } from '../store/editorial';
import type { ViewId } from '../types';

interface SidebarProps {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  clientName: string;
  onSwitchClient: () => void;
}

const NAV: Array<{
  id: ViewId;
  label: string;
  icon: typeof CalendarDays;
  description: string;
}> = [
  { id: 'calendar', label: 'Calendrier', icon: CalendarDays, description: 'Planning mensuel & hebdo' },
  { id: 'kanban', label: 'Pipeline', icon: ListChecks, description: 'Workflow de production' },
  { id: 'table', label: 'Base de données', icon: Table2, description: 'Tableau filtrable' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'Analytics éditoriales' },
];

export default function Sidebar({
  view,
  onViewChange,
  theme,
  onToggleTheme,
  onOpenSettings,
  clientName,
  onSwitchClient,
}: SidebarProps) {
  const { items, saveState, dataPath } = useEditorial();
  const monthKey = monthKeyOf(new Date());
  const monthCount = items.filter(
    (item) => item.scheduledDate && monthKeyOf(item.scheduledDate) === monthKey,
  ).length;
  const inProduction = items.filter(
    (item) => item.status === 'Rédaction / Création' || item.status === 'En révision',
  ).length;

  const counts: Record<ViewId, number | null> = {
    calendar: monthCount,
    kanban: inProduction,
    table: items.length,
    dashboard: null,
  };

  const dataLabel = isDesktop
    ? dataPath
      ? `clients/${dataPath.split(/[\\/]/).pop()}`
      : 'userData'
    : 'Mode navigateur · localStorage';

  const saveLabel =
    saveState === 'saving'
      ? 'Enregistrement…'
      : saveState === 'error'
        ? "Échec de l'enregistrement"
        : saveState === 'saved'
          ? 'Sauvegardé localement'
          : 'Prêt';

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-line bg-surface md:w-[244px]">
      <div className="flex items-center justify-center gap-3 px-2 pb-5 pt-6 md:justify-start md:px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <CalendarDays size={20} />
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm font-bold tracking-tight">Editorial Studio</p>
          <p className="truncate text-[11px] text-muted">Calendrier & production</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSwitchClient}
        title="Changer de client"
        className="mx-1 mb-5 flex items-center justify-center gap-2 rounded-xl border border-line bg-raised/50 px-2 py-2 text-left transition hover:border-accent/40 hover:bg-raised md:mx-3 md:justify-start md:px-3"
      >
        <Building2 size={14} className="shrink-0 text-accent" />
        <span className="hidden min-w-0 flex-1 md:block">
          <span className="block text-[10px] uppercase tracking-wider text-muted">Client</span>
          <span className="block truncate text-xs font-semibold">{clientName}</span>
        </span>
        <ChevronsUpDown size={12} className="hidden shrink-0 text-muted md:block" />
      </button>

      <nav className="flex flex-col gap-1 px-1.5 md:px-3">
        <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted/70 md:block">
          Espace de travail
        </p>
        {NAV.map((entry) => {
          const Icon = entry.icon;
          const active = view === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              className={cx('nav-item justify-center px-2 md:justify-start md:px-3', active && 'nav-item-active')}
              onClick={() => onViewChange(entry.id)}
              title={entry.description}
            >
              <Icon size={17} className="shrink-0" />
              <span className="hidden flex-1 text-left md:block">{entry.label}</span>
              {counts[entry.id] !== null && (
                <span
                  className={cx(
                    'hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums md:inline',
                    active ? 'bg-accent/15 text-accent' : 'bg-raised text-muted',
                  )}
                >
                  {counts[entry.id]}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-2 mt-6 hidden rounded-xl border border-line bg-raised/60 p-3 md:block md:mx-3">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              'h-1.5 w-1.5 rounded-full',
              saveState === 'error'
                ? 'bg-rose-500'
                : saveState === 'saving'
                  ? 'animate-pulse bg-amber-500'
                  : 'bg-emerald-500',
            )}
          />
          <p className="text-[11px] font-medium text-ink">{saveLabel}</p>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-muted" title={dataPath}>
          {dataLabel}
        </p>
      </div>

      <div className="mt-auto p-1.5 md:p-3">
        <button type="button" className="nav-item justify-center md:justify-start" onClick={onOpenSettings}>
          <Settings size={17} />
          <span className="hidden flex-1 text-left md:block">Paramètres</span>
        </button>
        <button type="button" className="nav-item justify-center md:justify-start" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span className="hidden flex-1 text-left md:block">
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </span>
        </button>
        <div className="mt-2 hidden px-2 md:block">
          <p className="truncate text-[10px] text-muted" title={dataPath}>
            {monthKey} · {items.length} contenus
          </p>
        </div>
      </div>
    </aside>
  );
}
