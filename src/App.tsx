import { useEffect, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ItemDrawer from './components/ItemDrawer';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import { api, type AuthStatus } from './lib/api';
import CalendarView from './views/CalendarView';
import KanbanView from './views/KanbanView';
import TableView from './views/TableView';
import DashboardView from './views/DashboardView';
import { useEditorial } from './store/editorial';
import type { DrawerTab, ViewId } from './types';

type Theme = 'light' | 'dark';

const THEME_KEY = 'editorial-studio:theme';

const VIEW_META: Record<ViewId, { title: string; subtitle: string }> = {
  calendar: {
    title: 'Calendrier éditorial',
    subtitle: 'Planifiez, replanifiez et repérez les jours sans contenu.',
  },
  kanban: {
    title: 'Pipeline de production',
    subtitle: "Faites avancer chaque contenu de l'idée à la publication.",
  },
  table: {
    title: 'Base de données',
    subtitle: 'Filtrez, triez et mettez à jour vos contenus en un clic.',
  },
  dashboard: {
    title: 'Dashboard & Analytics',
    subtitle: "Équilibre éditorial, volume par plateforme et complétion du mois.",
  },
};

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface DrawerState {
  itemId: string;
  tab: DrawerTab;
}

export default function App() {
  const { items, ready, createItem } = useEditorial();
  const [view, setView] = useState<ViewId>('calendar');
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auth, setAuth] = useState<AuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .authStatus()
      .then((status) => {
        if (!cancelled) setAuth(status);
      })
      .catch(() => {
        if (!cancelled) {
          setAuth({
            authenticated: false,
            email: null,
            configured: false,
            senderEmail: '',
            dev: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const openItem = (itemId: string) => setDrawer({ itemId, tab: 'edit' });

  const startNewItem = (scheduled?: Date) => {
    const created = createItem({
      scheduledDate: scheduled ? scheduled.toISOString() : null,
    });
    setDrawer({ itemId: created.id, tab: 'edit' });
  };

  if (auth === null) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <CalendarDays size={24} />
          </div>
          <p className="text-sm font-medium text-muted">Ouverture de la session…</p>
        </div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <LoginScreen
        status={auth}
        onSignedIn={(email) => setAuth({ ...auth, authenticated: true, email })}
      />
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <CalendarDays size={24} />
          </div>
          <p className="text-sm font-medium text-muted">Chargement du calendrier éditorial…</p>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[view];

  return (
    <div className="flex h-full bg-bg text-ink">
      <Sidebar
        view={view}
        onViewChange={setView}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-bg/85 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{meta.title}</h1>
            <p className="mt-0.5 truncate text-xs text-muted">{meta.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs tabular-nums text-muted lg:inline">
              {items.length} contenu{items.length > 1 ? 's' : ''}
            </span>
            <button type="button" className="btn-primary" onClick={() => startNewItem()}>
              <Plus size={16} />
              Nouveau contenu
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {view === 'calendar' && <CalendarView onOpen={openItem} onCreate={startNewItem} />}
          {view === 'kanban' && <KanbanView onOpen={openItem} onCreate={() => startNewItem()} />}
          {view === 'table' && <TableView onOpen={openItem} onCreate={() => startNewItem()} />}
          {view === 'dashboard' && (
            <DashboardView onOpen={openItem} onGoToCalendar={() => setView('calendar')} />
          )}
        </main>
      </div>

      {drawer && (
        <ItemDrawer
          key={drawer.itemId}
          itemId={drawer.itemId}
          initialTab={drawer.tab}
          onClose={() => setDrawer(null)}
          onOpenItem={openItem}
        />
      )}

      {settingsOpen &&             <SettingsModal
              email={auth.email}
              onSignOut={() => {
                void api.authLogout().finally(() => {
                  setSettingsOpen(false);
                  setDrawer(null);
                  setAuth((current) =>
                    current ? { ...current, authenticated: false, email: null } : current,
                  );
                });
              }}
              onClose={() => setSettingsOpen(false)}
            />}
    </div>
  );
}
