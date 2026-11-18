import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_ASSIGNEE } from '../constants';
import { api, type CalendarSyncResult, type ClientDataFailure, type ClientMeta, type ClientSheetResult, type ClientsSyncResult } from '../lib/api';
import { parsePayload } from '../lib/normalize';
import { uid } from '../lib/utils';
import type { Platform, PostItem } from '../types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ClientLoadError {
  reason: ClientDataFailure;
  file: string;
  error?: string;
}

interface EditorialContextValue {
  items: PostItem[];
  ready: boolean;
  saveState: SaveState;
  dataPath: string;
  clients: ClientMeta[];
  clientsLoading: boolean;
  activeClient: ClientMeta | null;
  loadError: ClientLoadError | null;
  selectClient: (id: string) => Promise<void>;
  createClient: (name: string) => Promise<void>;
  renameClient: (id: string, name: string) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  syncClientsFromSheet: () => Promise<ClientsSyncResult>;
  linkClientSheet: (id: string, url: string) => Promise<ClientSheetResult>;
  syncClientCalendar: (id: string) => Promise<CalendarSyncResult>;
  openClientPicker: () => Promise<void>;
  retryClientLoad: () => Promise<boolean>;
  restoreClientFromBackup: () => Promise<{ canceled: boolean; error?: string; count?: number }>;
  startEmptyClient: () => Promise<void>;
  createItem: (partial?: Partial<PostItem>) => PostItem;
  updateItem: (id: string, patch: Partial<PostItem>) => void;
  deleteItem: (id: string) => void;
  duplicateItem: (id: string, platform?: Platform) => PostItem | null;
  replaceAll: (items: PostItem[]) => void;
}

const EditorialContext = createContext<EditorialContextValue | null>(null);

const SAVE_DELAY = 400;

const DRAFT_DEFAULTS: Omit<PostItem, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  content: '',
  platform: 'LinkedIn',
  format: 'Post Texte',
  status: 'Idée / Backlog',
  pillar: 'Éducation',
  scheduledDate: null,
  assignee: DEFAULT_ASSIGNEE,
  tags: [],
  checklist: [],
  assets: [],
};

export function EditorialProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PostItem[]>([]);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dataPath, setDataPath] = useState('');
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [activeClient, setActiveClient] = useState<ClientMeta | null>(null);
  const [loadError, setLoadError] = useState<ClientLoadError | null>(null);
  const timerRef = useRef<number | null>(null);
  const bootstrapped = useRef(false);

  // La liste des clients est chargée au démarrage ; le contenu n'est chargé
  // qu'après le choix explicite d'un client.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        setClients(await api.clientsList());
      } catch (error) {
        console.error('[editorial] liste des clients indisponible', error);
      } finally {
        setClientsLoading(false);
      }

      // Import feuille → application au démarrage. Silencieux : une feuille
      // injoignable ne doit ni bloquer ni retarder l'ouverture du picker.
      try {
        const synced = await api.clientsSyncFromSheet();
        if (synced.ok) setClients(synced.clients);
        else console.warn('[editorial] import Google Sheets ignoré :', synced.error);
      } catch (error) {
        console.error('[editorial] import Google Sheets impossible', error);
      }
    })();
  }, []);

  const flush = useCallback(async () => {
    if (!ready || !activeClient || loadError) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      await api.saveData({ version: 1, updatedAt: new Date().toISOString(), items });
    } catch (error) {
      console.error('[editorial] sauvegarde avant changement de client impossible', error);
    }
  }, [ready, activeClient, loadError, items]);

  const enterClient = useCallback(async (meta: ClientMeta) => {
    const result = await api.loadClientData();
    setActiveClient(meta);
    setDataPath(result.file ?? '');
    if (!result.ok) {
      // Aucune donnée chargée : on bloque la sauvegarde tant qu'une action n'a
      // pas été choisie (restauration, réessai, calendrier vide explicite).
      setItems([]);
      setLoadError({
        reason: result.reason ?? 'unreadable',
        file: result.file ?? '',
        error: result.error,
      });
      setReady(false);
      setSaveState('idle');
      return;
    }
    const loaded = parsePayload(result.data);
    setItems(loaded ?? []);
    setLoadError(null);
    setSaveState('idle');
    setReady(true);
  }, []);

  const selectClient = useCallback(
    async (id: string) => {
      await flush();
      const meta = await api.clientsSelect(id);
      await enterClient(meta);
      try {
        setClients(await api.clientsList());
      } catch {
        /* la liste se rafraîchira au prochain passage */
      }
    },
    [flush, enterClient],
  );

  const createClient = useCallback(
    async (name: string) => {
      await flush();
      const meta = await api.clientsCreate(name);
      await enterClient(meta);
      try {
        setClients(await api.clientsList());
      } catch {
        /* ignore */
      }
    },
    [flush, enterClient],
  );

  const renameClient = useCallback(
    async (id: string, name: string) => {
      const result = await api.clientsRename(id, name);
      if (!result.ok) throw new Error(result.error ?? 'Renommage impossible.');
      if (activeClient?.id === id && result.client) setActiveClient(result.client);
      try {
        setClients(await api.clientsList());
      } catch {
        /* ignore */
      }
    },
    [activeClient],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      const result = await api.clientsDelete(id);
      if (!result.ok) throw new Error(result.error ?? 'Suppression impossible.');
      if (activeClient?.id === id) {
        setActiveClient(null);
        setReady(false);
        setLoadError(null);
        setItems([]);
        setSaveState('idle');
      }
      try {
        setClients(await api.clientsList());
      } catch {
        /* ignore */
      }
    },
    [activeClient],
  );

  const syncClientsFromSheet = useCallback(async (): Promise<ClientsSyncResult> => {
    const result = await api.clientsSyncFromSheet();
    if (result.ok) {
      const list = result.clients;
      setClients(list);
      // Le client ouvert peut avoir été renommé par l'import.
      setActiveClient((previous) =>
        previous ? list.find((client) => client.id === previous.id) ?? previous : previous,
      );
    }
    return result;
  }, []);

  const linkClientSheet = useCallback(async (id: string, url: string): Promise<ClientSheetResult> => {
    const result = await api.clientsSetSheet(id, url);
    if (result.ok) {
      setActiveClient((previous) =>
        previous && previous.id === id ? { ...previous, ...result.client } : previous,
      );
      try {
        setClients(await api.clientsList());
      } catch {
        /* ignore : la liste se rafraîchira au prochain passage */
      }
    }
    return result;
  }, []);

  const syncClientCalendar = useCallback(
    async (id: string): Promise<CalendarSyncResult> => {
      const result = await api.clientsSyncCalendar(id);
      if (!result.ok) return result;
      setClients(result.clients);
      // Le calendrier du client ouvert vient d'être remplacé : on le recharge.
      if (activeClient?.id === id) {
        const meta = result.clients.find((client) => client.id === id);
        if (meta) await enterClient(meta);
      }
      return result;
    },
    [activeClient, enterClient],
  );

  const openClientPicker = useCallback(async () => {
    await flush();
    setActiveClient(null);
    setReady(false);
    setLoadError(null);
    setItems([]);
    setSaveState('idle');
    try {
      setClients(await api.clientsList());
    } catch {
      /* ignore */
    }
  }, [flush]);

  const retryClientLoad = useCallback(async (): Promise<boolean> => {
    const result = await api.loadClientData();
    setDataPath(result.file ?? dataPath);
    if (!result.ok) {
      setLoadError({
        reason: result.reason ?? 'unreadable',
        file: result.file ?? '',
        error: result.error,
      });
      return false;
    }
    setItems(parsePayload(result.data) ?? []);
    setLoadError(null);
    setSaveState('idle');
    setReady(true);
    return true;
  }, [dataPath]);

  const startEmptyClient = useCallback(async () => {
    const result = await api.resolveClient({ mode: 'empty' });
    if (!result.ok) {
      throw new Error(result.error ?? 'Impossible de créer un calendrier vide.');
    }
    setItems([]);
    setLoadError(null);
    setDataPath(result.file ?? dataPath);
    setSaveState('saved');
    setReady(true);
    try {
      setClients(await api.clientsList());
    } catch {
      /* ignore */
    }
  }, [dataPath]);

  const restoreClientFromBackup = useCallback(async () => {
    const imported = await api.importBackup();
    if (imported.canceled) return { canceled: true };
    if (imported.error) return { canceled: false, error: imported.error };

    const parsed = parsePayload(imported.data);
    if (!parsed || parsed.length === 0) {
      return { canceled: false, error: 'Ce fichier ne contient aucun contenu exploitable.' };
    }

    const result = await api.resolveClient({ mode: 'restore', items: parsed });
    if (!result.ok) {
      return { canceled: false, error: result.error ?? 'Restauration impossible.' };
    }

    setItems(parsed);
    setLoadError(null);
    setDataPath(result.file ?? dataPath);
    setSaveState('saved');
    setReady(true);
    try {
      setClients(await api.clientsList());
    } catch {
      /* ignore */
    }
    return { canceled: false, count: parsed.length };
  }, [dataPath]);

  // Autosave débouncé dans le fichier du client actif, uniquement avec des
  // données chargées avec succès.
  useEffect(() => {
    if (!ready || !activeClient || loadError) return;
    setSaveState('saving');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      try {
        await api.saveData({ version: 1, updatedAt: new Date().toISOString(), items });
        setSaveState('saved');
      } catch (error) {
        console.error('[editorial] sauvegarde impossible', error);
        setSaveState('error');
      }
    }, SAVE_DELAY);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [items, ready, activeClient, loadError]);

  const createItem = useCallback((partial: Partial<PostItem> = {}): PostItem => {
    const now = new Date().toISOString();
    const item: PostItem = {
      ...DRAFT_DEFAULTS,
      ...partial,
      id: uid(),
      createdAt: now,
      updatedAt: now,
    };
    setItems((previous) => [item, ...previous]);
    return item;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<PostItem>) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, ...patch, id: item.id, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const duplicateItem = useCallback(
    (id: string, platform?: Platform): PostItem | null => {
      const source = items.find((item) => item.id === id);
      if (!source) return null;
      const now = new Date().toISOString();
      let scheduledDate = source.scheduledDate;
      if (scheduledDate) {
        const next = new Date(scheduledDate);
        if (!Number.isNaN(next.getTime())) {
          next.setDate(next.getDate() + 7);
          scheduledDate = next.toISOString();
        }
      }
      const clone: PostItem = {
        ...source,
        id: uid(),
        platform: platform ?? source.platform,
        status: 'Idée / Backlog',
        scheduledDate,
        checklist: source.checklist.map((task) => ({ ...task, id: uid(), done: false })),
        assets: source.assets.map((asset) => ({ ...asset, id: uid() })),
        createdAt: now,
        updatedAt: now,
      };
      setItems((previous) => [clone, ...previous]);
      return clone;
    },
    [items],
  );

  const replaceAll = useCallback((next: PostItem[]) => {
    setItems(next);
  }, []);

  const value = useMemo<EditorialContextValue>(
    () => ({
      items,
      ready,
      saveState,
      dataPath,
      clients,
      clientsLoading,
      activeClient,
      loadError,
      selectClient,
      createClient,
      renameClient,
      deleteClient,
      syncClientsFromSheet,
      linkClientSheet,
      syncClientCalendar,
      openClientPicker,
      retryClientLoad,
      restoreClientFromBackup,
      startEmptyClient,
      createItem,
      updateItem,
      deleteItem,
      duplicateItem,
      replaceAll,
    }),
    [
      items,
      ready,
      saveState,
      dataPath,
      clients,
      clientsLoading,
      activeClient,
      loadError,
      selectClient,
      createClient,
      renameClient,
      deleteClient,
      syncClientsFromSheet,
      linkClientSheet,
      syncClientCalendar,
      openClientPicker,
      retryClientLoad,
      restoreClientFromBackup,
      startEmptyClient,
      createItem,
      updateItem,
      deleteItem,
      duplicateItem,
      replaceAll,
    ],
  );

  return <EditorialContext.Provider value={value}>{children}</EditorialContext.Provider>;
}

export function useEditorial(): EditorialContextValue {
  const context = useContext(EditorialContext);
  if (!context) throw new Error('useEditorial doit être utilisé dans EditorialProvider');
  return context;
}
