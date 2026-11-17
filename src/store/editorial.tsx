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
import { api, type ClientMeta } from '../lib/api';
import { parsePayload } from '../lib/normalize';
import { uid } from '../lib/utils';
import type { Platform, PostItem } from '../types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EditorialContextValue {
  items: PostItem[];
  ready: boolean;
  saveState: SaveState;
  dataPath: string;
  clients: ClientMeta[];
  clientsLoading: boolean;
  activeClient: ClientMeta | null;
  selectClient: (id: string) => Promise<void>;
  createClient: (name: string) => Promise<void>;
  openClientPicker: () => Promise<void>;
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
    })();
  }, []);

  const flush = useCallback(async () => {
    if (!ready || !activeClient) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      await api.saveData({ version: 1, updatedAt: new Date().toISOString(), items });
    } catch (error) {
      console.error('[editorial] sauvegarde avant changement de client impossible', error);
    }
  }, [ready, activeClient, items]);

  const enterClient = useCallback(async (meta: ClientMeta) => {
    const [payload, path] = await Promise.all([api.loadData(), api.getDataPath()]);
    const loaded = parsePayload(payload);
    setItems(loaded ?? []);
    setDataPath(path);
    setActiveClient(meta);
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

  const openClientPicker = useCallback(async () => {
    await flush();
    setActiveClient(null);
    setReady(false);
    setItems([]);
    setSaveState('idle');
    try {
      setClients(await api.clientsList());
    } catch {
      /* ignore */
    }
  }, [flush]);

  // Autosave débouncé dans le fichier du client actif.
  useEffect(() => {
    if (!ready || !activeClient) return;
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
  }, [items, ready, activeClient]);

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
      selectClient,
      createClient,
      openClientPicker,
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
      selectClient,
      createClient,
      openClientPicker,
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
