import { useState } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  RotateCw,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { api, isDesktop } from '../lib/api';

interface ClientDataErrorScreenProps {
  clientName: string;
  file: string;
  reason: 'missing' | 'unreadable';
  detail?: string;
  onRetry: () => Promise<boolean>;
  onRestore: () => Promise<{ canceled: boolean; error?: string; count?: number }>;
  onStartEmpty: () => Promise<void>;
  onChangeClient: () => void;
}

type Busy = 'retry' | 'restore' | 'empty' | null;

export default function ClientDataErrorScreen({
  clientName,
  file,
  reason,
  detail,
  onRetry,
  onRestore,
  onStartEmpty,
  onChangeClient,
}: ClientDataErrorScreenProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const retry = async () => {
    setBusy('retry');
    setError(null);
    try {
      const ok = await onRetry();
      if (!ok) setError('Le fichier reste indisponible.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nouvel essai impossible.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    setError(null);
    try {
      const result = await onRestore();
      if (!result.canceled && result.error) setError(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restauration impossible.');
    } finally {
      setBusy(null);
    }
  };

  const startEmpty = async () => {
    setBusy('empty');
    setError(null);
    try {
      await onStartEmpty();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-bg px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight">Calendrier indisponible</h1>
              <p className="truncate text-xs text-muted">{clientName}</p>
            </div>
          </div>

          <p className="mt-4 text-sm font-medium">
            {reason === 'missing'
              ? 'Le fichier de données de ce client est introuvable.'
              : 'Le fichier de données de ce client est illisible.'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            La sauvegarde automatique est <span className="font-semibold text-ink">suspendue</span> :
            rien n'a été écrit et le fichier existant ne sera pas écrasé tant que vous n'aurez pas
            choisi une action.
          </p>

          {file && (
            <p className="mt-3 break-all rounded-lg border border-line bg-raised px-3 py-2 font-mono text-[10.5px] leading-relaxed text-muted">
              {file}
            </p>
          )}
          {detail && <p className="mt-2 text-[10px] text-muted">Détail : {detail}</p>}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void restore()}
              disabled={busy !== null}
            >
              {busy === 'restore' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              Restaurer une sauvegarde…
            </button>
            <p className="text-[10px] text-muted">
              Choisissez un fichier .json exporté depuis l'application. Le fichier actuel sera
              conservé sous un nom <code className="rounded bg-raised px-1">.preserved-…</code>.
            </p>

            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void retry()}
                disabled={busy !== null}
              >
                {busy === 'retry' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCw size={14} />
                )}
                Réessayer
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={onChangeClient}
                disabled={busy !== null}
              >
                Changer de client
              </button>
            </div>

            {isDesktop && (
              <button
                type="button"
                className="mt-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted transition hover:text-ink"
                onClick={() => void api.revealDataFile()}
              >
                <FolderOpen size={12} /> Ouvrir le dossier des données
              </button>
            )}
          </div>

          {confirming ? (
            <div className="mt-4 rounded-xl border border-rose-400/50 bg-rose-500/10 p-3">
              <p className="text-xs font-semibold">Créer un calendrier vide ?</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                {reason === 'missing'
                  ? "Aucun fichier n'existe : un nouveau calendrier vide sera créé."
                  : "Le fichier actuel sera conservé sous un nom .preserved-… avant d'être remplacé par un calendrier vide."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void startEmpty()}
                  disabled={busy !== null}
                >
                  {busy === 'empty' ? <Loader2 size={12} className="animate-spin" /> : null}
                  Créer un calendrier vide
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px]"
                  onClick={() => setConfirming(false)}
                  disabled={busy !== null}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-4 text-[11px] font-medium text-muted underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-50"
              onClick={() => setConfirming(true)}
              disabled={busy !== null}
            >
              Repartir d'un calendrier vide
            </button>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
              {error}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 px-1 text-[10px] leading-relaxed text-muted">
          <ShieldAlert size={12} className="mt-0.5 shrink-0" />
          <p>
            Ne créez un calendrier vide qu'en dernier recours : sans sauvegarde, les contenus
            manquants ne pourront pas être récupérés.
          </p>
        </div>
      </div>
    </div>
  );
}
