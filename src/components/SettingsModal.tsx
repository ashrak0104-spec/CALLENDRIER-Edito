import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FolderOpen,
  HardDrive,
  LogOut,
  ShieldCheck,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { useToast } from './Toast';
import { api, isDesktop } from '../lib/api';
import { buildCsv, csvFileName } from '../lib/csv';
import { parsePayload } from '../lib/normalize';
import { useEditorial } from '../store/editorial';
import type { PostItem } from '../types';

interface SettingsModalProps {
  email?: string | null;
  onSignOut?: () => void;
  onClose: () => void;
}

export default function SettingsModal({ email, onSignOut, onClose }: SettingsModalProps) {
  const { items, replaceAll, dataPath, saveState } = useEditorial();
  const toast = useToast();
  const [version, setVersion] = useState('…');
  const [busy, setBusy] = useState<'backup' | 'restore' | 'csv' | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PostItem[] | null>(null);

  useEffect(() => {
    api
      .appVersion()
      .then(setVersion)
      .catch(() => setVersion('—'));
  }, []);

  const exportBackup = async () => {
    setBusy('backup');
    try {
      const result = await api.exportBackup({
        version: 1,
        updatedAt: new Date().toISOString(),
        items,
      });
      if (!result.canceled) {
        toast(result.filePath ? `Sauvegarde créée : ${result.filePath}` : 'Sauvegarde exportée.');
      }
    } catch (error) {
      console.error(error);
      toast("L'export de la sauvegarde a échoué.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const startRestore = async () => {
    setBusy('restore');
    try {
      const result = await api.importBackup();
      if (result.canceled) return;
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      const parsed = parsePayload(result.data);
      if (!parsed || parsed.length === 0) {
        toast('Ce fichier ne contient aucun contenu exploitable.', 'error');
        return;
      }
      setPendingRestore(parsed);
    } catch (error) {
      console.error(error);
      toast('La lecture de la sauvegarde a échoué.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    replaceAll(pendingRestore);
    toast(`${pendingRestore.length} contenus restaurés.`);
    setPendingRestore(null);
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const result = await api.exportCsv(buildCsv(items), csvFileName());
      if (!result.canceled) {
        toast(result.filePath ? `Planning exporté : ${result.filePath}` : 'Planning exporté en CSV.');
      }
    } catch (error) {
      console.error(error);
      toast("L'export CSV a échoué.", 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Fermer les paramètres"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="animate-fade-in card relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-bold">Paramètres</h2>
            <p className="text-xs text-muted">Stockage local, sauvegardes et portabilité</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <HardDrive size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Stockage local</h3>
                <p className="text-[11px] text-muted">
                  Toutes les données sont écrites dans un fichier JSON du dossier système{' '}
                  <code className="rounded bg-raised px-1 py-0.5 text-[10px]">userData</code>.
                </p>
              </div>
            </div>
            <div className="mt-2.5 rounded-xl border border-line bg-raised/50 px-3 py-2">
              <p className="break-all font-mono text-[10.5px] leading-relaxed text-muted">
                {dataPath || 'Chemin indisponible hors Electron'}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                  <ShieldCheck size={12} />
                  {saveState === 'error' ? 'Écriture en échec' : 'Écriture automatique active'}
                </span>
                {isDesktop && (
                  <button
                    type="button"
                    className="btn-ghost !px-2 !py-1 text-[11px]"
                    onClick={() => void api.revealDataFile()}
                  >
                    <FolderOpen size={12} />
                    Ouvrir le dossier
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Sauvegarde & portabilité</h3>
            <p className="text-[11px] text-muted">
              Transférez votre calendrier d’un ordinateur à un autre via un fichier de sauvegarde.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="btn-ghost justify-start !py-2.5"
                onClick={() => void exportBackup()}
                disabled={busy !== null}
              >
                <Download size={15} />
                <span className="flex-1 text-left">
                  <span className="block text-xs font-semibold">Exporter une sauvegarde</span>
                  <span className="block text-[10px] text-muted">Fichier .json complet</span>
                </span>
              </button>
              <button
                type="button"
                className="btn-ghost justify-start !py-2.5"
                onClick={() => void startRestore()}
                disabled={busy !== null}
              >
                <Upload size={15} />
                <span className="flex-1 text-left">
                  <span className="block text-xs font-semibold">Restaurer une sauvegarde</span>
                  <span className="block text-[10px] text-muted">Remplace les données locales</span>
                </span>
              </button>
              <button
                type="button"
                className="btn-ghost justify-start !py-2.5 sm:col-span-2"
                onClick={() => void exportCsv()}
                disabled={busy !== null}
              >
                <Table2 size={15} />
                <span className="flex-1 text-left">
                  <span className="block text-xs font-semibold">Exporter le planning en CSV</span>
                  <span className="block text-[10px] text-muted">
                    Compatible Excel (séparateur « ; », accents UTF-8)
                  </span>
                </span>
              </button>
            </div>

            {pendingRestore && (
              <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">
                      Remplacer les {items.length} contenus actuels par les{' '}
                      {pendingRestore.length} contenus de cette sauvegarde ?
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      Cette action est immédiate ; exportez une sauvegarde si vous voulez revenir en
                      arrière.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-primary !px-2.5 !py-1 text-[11px]"
                        onClick={confirmRestore}
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1 text-[11px]"
                        onClick={() => setPendingRestore(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {email && (
            <section className="border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Compte</h3>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{email}</p>
                  <p className="text-[10px] text-muted">Connexion par code email</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-[11px]"
                  onClick={onSignOut}
                >
                  <LogOut size={12} />
                  Se déconnecter
                </button>
              </div>
            </section>
          )}

          <section className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Application</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-line bg-raised/40 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">Version</dt>
                <dd className="font-semibold text-ink">{version}</dd>
              </div>
              <div className="rounded-lg border border-line bg-raised/40 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">Mode</dt>
                <dd className="font-semibold text-ink">
                  {isDesktop ? 'Application desktop' : 'Navigateur (développement)'}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-raised/40 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">Contenus</dt>
                <dd className="font-semibold text-ink">{items.length}</dd>
              </div>
              <div className="rounded-lg border border-line bg-raised/40 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">Fichier</dt>
                <dd className="truncate font-semibold text-ink">
                  {dataPath.split(/[\\/]/).pop() || '—'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className="flex items-center justify-end border-t border-line px-6 py-3">
          <button type="button" className="btn-primary" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
