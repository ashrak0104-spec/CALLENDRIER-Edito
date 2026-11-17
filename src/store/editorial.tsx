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
import { api } from '../lib/api';
import { parsePayload } from '../lib/normalize';
import { buildSeedData } from '../lib/seed';
import { uid } from '../lib/utils';
import type { Platform, PostItem } from '../types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EditorialContextValue {
  items: PostItem[];
  ready: boolean;
  saveState: SaveState;
  dataPath: string;
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
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const [payload, path] = await Promise.all([api.loadData(), api.getDataPath()]);
        setDataPath(path);
        const loaded = parsePayload(payload);
        // `[]` is a real (emptied) workspace; only a missing/unreadable file seeds demo data.
        if (loaded !== null) {
          setItems(loaded);
        } else {
          const seeded = buildSeedData();
          setItems(seeded);
          await api.saveData({
            version: 1,
            updatedAt: new Date().toISOString(),
            items: seeded,
          });
        }
      } catch (error) {
        console.error('[editorial] chargement impossible', error);
        setItems((previous) => (previous.length > 0 ? previous : buildSeedData()));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Debounced autosave to editorial-data.json via the preload bridge.
  useEffect(() => {
    if (!ready) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await api.saveData({
          version: 1,
          updatedAt: new Date().toISOString(),
          items,
        });
        setSaveState('saved');
      } catch (error) {
        console.error('[editorial] sauvegarde impossible', error);
        setSaveState('error');
      }
    }, SAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [items, ready]);

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
