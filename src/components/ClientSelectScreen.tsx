import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Building2,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CalendarSyncReport,
  CalendarSyncResult,
  ClientMeta,
  ClientSheetResult,
  ClientsSyncResult,
  SheetImportReport,
} from '../lib/api';
import { isDesktop } from '../lib/api';

interface ClientSelectScreenProps {
  clients: ClientMeta[];
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSync: () => Promise<ClientsSyncResult>;
  onLinkSheet: (id: string, url: string) => Promise<ClientSheetResult>;
  onSyncCalendar: (id: string) => Promise<CalendarSyncResult>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function lastUpdate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count > 1 ? many : one}`;

function shortList(values: string[], max = 6): string {
  const shown = values.slice(0, max).join(', ');
  return values.length > max ? `${shown}, +${values.length - max}` : shown;
}

/** Rapport du dernier import feuille → application. */
function SyncReport({ report }: { report: SheetImportReport }) {
  const counts: string[] = [];
  if (report.created.length) counts.push(`${report.created.length} créé${report.created.length > 1 ? 's' : ''}`);
  if (report.updated.length) counts.push(`${report.updated.length} mis à jour`);
  if (report.unchanged) counts.push(`${report.unchanged} inchangé${report.unchanged > 1 ? 's' : ''}`);
  if (report.missing.length) counts.push(`${report.missing.length} absent${report.missing.length > 1 ? 's' : ''}`);

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="font-semibold text-ink">{counts.length ? counts.join(' · ') : 'Aucun changement'}</p>
      <p className="text-muted">
        {plural(report.rowsRead, 'ligne lue', 'lignes lues')} dans la feuille.
      </p>
      {report.created.length > 0 && (
        <p className="text-muted">Créés : {shortList(report.created)}</p>
      )}
      {report.missing.length > 0 && (
        <p className="text-muted">Absents de la feuille (conservés) : {shortList(report.missing)}</p>
      )}
      {report.ambiguous.length > 0 && (
        <p className="text-amber-600 dark:text-amber-400">
          Ambigu{report.ambiguous.length > 1 ? 's' : ''} (aucune fusion) :{' '}
          {shortList(report.ambiguous.map((entry) => entry.name))} — plusieurs clients locaux portent
          ce nom.
        </p>
      )}
      {report.duplicates.length > 0 && (
        <p className="text-amber-600 dark:text-amber-400">
          Doublons dans la feuille : {shortList(report.duplicates.map((entry) => entry.name))}
        </p>
      )}
      {report.ignored.length > 0 && (
        <p className="text-muted">
          {plural(report.ignored.length, 'ligne ignorée', 'lignes ignorées')} (clients supprimés dans
          l'application).
        </p>
      )}
      {report.created.length + report.updated.length + report.unchanged === 0 && (
        <p className="text-muted">
          Aucune ligne client reconnue : la feuille doit avoir une colonne « Nom » (et de préférence
          « ID »).
        </p>
      )}
    </div>
  );
}

export default function ClientSelectScreen({
  clients,
  loading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSync,
  onLinkSheet,
  onSyncCalendar,
}: ClientSelectScreenProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renaming, setRenaming] = useState<ClientMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<ClientMeta | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<ClientsSyncResult | null>(null);

  const [linking, setLinking] = useState<ClientMeta | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState<CalendarSyncReport | null>(null);
  const [confirmSheetImport, setConfirmSheetImport] = useState(false);

  const runSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      setSyncResult(await onSync());
    } catch (cause) {
      setSyncResult({
        ok: false,
        error: cause instanceof Error ? cause.message : 'Synchronisation impossible.',
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || modalBusy) return;
      setRenaming(null);
      setDeleting(null);
      setModalError(null);
      if (!linkBusy) setLinking(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalBusy, linkBusy]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const openRename = (client: ClientMeta) => {
    setRenaming(client);
    setRenameValue(client.name);
    setModalError(null);
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!renaming || modalBusy) return;
    const cleaned = renameValue.trim();
    if (!cleaned) return;
    setModalBusy(true);
    setModalError(null);
    try {
      await onRename(renaming.id, cleaned);
      setRenaming(null);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : 'Renommage impossible.');
    } finally {
      setModalBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || modalBusy) return;
    setModalBusy(true);
    setModalError(null);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setModalBusy(false);
    }
  };

  const openLink = (client: ClientMeta) => {
    setLinking(client);
    setLinkValue(client.sheetUrl ?? '');
    setLinkError(null);
    setLinkReport(null);
    setConfirmSheetImport(false);
  };

  const saveLink = async () => {
    if (!linking || linkBusy || !linkValue.trim()) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkReport(null);
    try {
      const saved = await onLinkSheet(linking.id, linkValue.trim());
      if (!saved.ok) {
        setLinkError(saved.error);
        return;
      }
      setLinking((previous) => (previous ? { ...previous, ...saved.client } : previous));
      setConfirmSheetImport(false);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'Synchronisation impossible.');
    } finally {
      setLinkBusy(false);
    }
  };

  const importCalendar = async () => {
    if (!linking || linkBusy || !linking.sheetId) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkReport(null);
    try {
      const result = await onSyncCalendar(linking.id);
      if (!result.ok) {
        setLinkError(result.error);
        return;
      }
      setLinkReport(result.report);
      setConfirmSheetImport(false);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">Choisir un client</p>
              <p className="text-[11px] text-muted">Chaque client a son propre calendrier éditorial.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost shrink-0 !gap-1.5 !px-2.5 !py-1.5 text-[11px]"
            onClick={() => void runSync()}
            disabled={syncing}
            title="Importer les clients depuis la feuille (lecture seule, rien n'est écrit dans la feuille)"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} />
            Synchroniser
          </button>
        </div>

        {syncResult && (
          <div
            className={
              syncResult.ok
                ? 'mt-5 flex items-start gap-3 rounded-xl border border-line bg-raised/60 px-3 py-2.5 text-[11px]'
                : 'mt-5 flex items-start gap-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500'
            }
          >
            {syncResult.ok ? (
              <SyncReport report={syncResult.report} />
            ) : (
              <p className="min-w-0 flex-1">{syncResult.error}</p>
            )}
            <button
              type="button"
              aria-label="Fermer le rapport de synchronisation"
              className="shrink-0 rounded p-0.5 text-muted transition hover:text-ink"
              onClick={() => setSyncResult(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Chargement des clients…
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="card group flex items-stretch gap-1 p-2 transition hover:border-accent/50 hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => onSelect(client.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-sm font-bold text-accent">
                    {initials(client.name) || '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {client.name}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {client.itemCount} contenu{client.itemCount > 1 ? 's' : ''} · maj{' '}
                      {lastUpdate(client.updatedAt)}
                    </span>
                    {client.sheetMissing && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        title="Ce client n'est plus dans la feuille ; il est conservé tel quel."
                      >
                        <AlertTriangle size={10} /> Absent de la feuille
                      </span>
                    )}
                    {client.sheetUrl && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
                        title={client.sheetUrl}
                      >
                        <Link2 size={10} /> Feuille liée
                      </span>
                    )}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-line pl-1">
                  <button
                    type="button"
                    className="icon-btn !h-7 !w-7"
                    title="Lien Google Sheets"
                    aria-label={`Lier une feuille Google Sheets à ${client.name}`}
                    onClick={() => openLink(client)}
                  >
                    <Link2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn !h-7 !w-7"
                    title="Renommer"
                    aria-label={`Renommer ${client.name}`}
                    onClick={() => openRename(client)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn !h-7 !w-7 hover:!bg-rose-500/10 hover:!text-rose-500"
                    title="Supprimer"
                    aria-label={`Supprimer ${client.name}`}
                    onClick={() => {
                      setDeleting(client);
                      setModalError(null);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {creating ? (
              <form
                onSubmit={submit}
                className="card flex flex-col gap-2 border-accent/40 p-4 sm:col-span-2"
              >
                <label className="label" htmlFor="client-name">
                  Nom du nouveau client
                </label>
                <div className="flex gap-2">
                  <input
                    id="client-name"
                    autoFocus
                    maxLength={60}
                    className="field flex-1"
                    placeholder="Ex. Studio Lumen"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Créer
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-2"
                    aria-label="Annuler la création"
                    onClick={() => {
                      setCreating(false);
                      setName('');
                      setError(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <p className="text-[10px] text-muted">
                  Le nouveau client démarre avec un calendrier vide.
                </p>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex min-h-[76px] items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-4 text-sm font-medium text-muted transition hover:border-accent/50 hover:text-accent"
              >
                <Plus size={16} /> Nouveau client
              </button>
            )}
          </div>
        )}

        {!loading && clients.length === 0 && !creating && (
          <p className="mt-6 text-center text-xs text-muted">
            Aucun client pour l'instant. Créez le premier pour ouvrir un calendrier éditorial.
          </p>
        )}

        <div className="mt-8 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
          <ShieldCheck size={12} className="mt-0.5 shrink-0" />
          <p>
            Les calendriers sont stockés localement, un fichier par client. Vous pourrez changer de
            client à tout moment depuis la barre latérale.
          </p>
        </div>
      </div>

      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]"
            onClick={() => !linkBusy && setLinking(null)}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveLink();
            }}
            className="animate-fade-in card relative w-full max-w-md p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Link2 size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">Lien Google Sheets</h2>
                <p className="truncate text-[11px] text-muted">{linking.name}</p>
              </div>
            </div>

            <label className="label mt-4" htmlFor="client-sheet-url">
              Lien de la feuille du client
            </label>
            <input
              id="client-sheet-url"
              autoFocus
              className="field"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              disabled={linkBusy}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Onglets lus : Facebook et Instagram (colonnes Date, Heure, Sujet, Contenu, Format,
              Objectif, Statut). Pour l’instant, la synchronisation importe la feuille vers
              l’application uniquement ; elle n’écrit pas dans Google Sheets.
              {!isDesktop && ' Sur Android, la feuille doit être accessible par lien public.'}
            </p>

            {linking.sheetId && linkValue.trim() === linking.sheetUrl && (
              <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  L’import remplacera le calendrier local.
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  Une copie de sécurité du calendrier actuel sera conservée avant l’import.
                </p>
                {!confirmSheetImport ? (
                  <button
                    type="button"
                    className="btn-ghost mt-2 !px-2.5 !py-1 text-[11px]"
                    onClick={() => setConfirmSheetImport(true)}
                    disabled={linkBusy}
                  >
                    Importer depuis Google Sheets…
                  </button>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      Confirmer le remplacement ?
                    </span>
                    <button
                      type="button"
                      className="btn-primary !px-2.5 !py-1 text-[11px]"
                      onClick={() => void importCalendar()}
                      disabled={linkBusy}
                    >
                      {linkBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Confirmer l’import
                    </button>
                  </div>
                )}
              </div>
            )}

            {linkError && (
              <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                {linkError}
              </p>
            )}

            {linkReport && (
              <div className="mt-3 rounded-xl border border-line bg-raised/60 px-3 py-2 text-[11px]">
                <p className="font-semibold text-ink">
                  {linkReport.items} contenu{linkReport.items > 1 ? 's' : ''} synchronisé
                  {linkReport.items > 1 ? 's' : ''} · {linkReport.days} jour
                  {linkReport.days > 1 ? 's' : ''} occupé{linkReport.days > 1 ? 's' : ''}
                </p>
                <p className="mt-0.5 text-muted">
                  {Object.entries(linkReport.platforms)
                    .map(([platform, count]) => `${platform} ${count}`)
                    .join(' · ')}
                </p>
                {linkReport.warnings.length > 0 && (
                  <p className="mt-1 text-amber-600 dark:text-amber-400">
                    {linkReport.warnings.slice(0, 3).join(' · ')}
                    {linkReport.warnings.length > 3
                      ? ` (+${linkReport.warnings.length - 3})`
                      : ''}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1 text-[11px]"
                onClick={() => setLinking(null)}
                disabled={linkBusy}
              >
                Fermer
              </button>
              <button
                type="submit"
                className="btn-primary !px-2.5 !py-1 text-[11px]"
                disabled={linkBusy || !linkValue.trim()}
              >
                {linkBusy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Enregistrer le lien
              </button>
            </div>
          </form>
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]"
            onClick={() => !modalBusy && setRenaming(null)}
          />
          <form
            onSubmit={submitRename}
            className="animate-fade-in card relative w-full max-w-sm p-5"
          >
            <h2 className="text-sm font-bold">Renommer le client</h2>
            <p className="mt-1 text-[11px] text-muted">
              Seul le nom change ; les contenus et les autres clients restent intacts.
            </p>
            <label className="label mt-4" htmlFor="rename-client">
              Nouveau nom
            </label>
            <input
              id="rename-client"
              autoFocus
              maxLength={60}
              className="field"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            {modalError && (
              <p className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                {modalError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1 text-[11px]"
                onClick={() => setRenaming(null)}
                disabled={modalBusy}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary !px-2.5 !py-1 text-[11px]"
                disabled={
                  modalBusy || !renameValue.trim() || renameValue.trim() === renaming.name
                }
              >
                {modalBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]"
            onClick={() => !modalBusy && setDeleting(null)}
          />
          <div className="animate-fade-in card relative w-full max-w-sm p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <Trash2 size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">Supprimer ce client ?</h2>
                <p className="truncate text-[11px] text-muted">{deleting.name}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink">
              « {deleting.name} » et ses {deleting.itemCount} contenu
              {deleting.itemCount > 1 ? 's' : ''} seront définitivement supprimés.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Cette action ne touche pas les autres clients et ne peut pas être annulée.
            </p>
            {modalError && (
              <p className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                {modalError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1 text-[11px]"
                onClick={() => setDeleting(null)}
                disabled={modalBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => void confirmDelete()}
                disabled={modalBusy}
              >
                {modalBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                Supprimer le client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
