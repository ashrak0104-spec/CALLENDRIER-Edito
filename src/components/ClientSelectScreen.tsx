import { useState, type FormEvent } from 'react';
import {
  Building2,
  ChevronRight,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ClientMeta } from '../lib/api';

interface ClientSelectScreenProps {
  clients: ClientMeta[];
  loading: boolean;
  email: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onSignOut: () => void;
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

export default function ClientSelectScreen({
  clients,
  loading,
  email,
  onSelect,
  onCreate,
  onSignOut,
}: ClientSelectScreenProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <div className="flex shrink-0 flex-col items-end gap-1">
            {email && <p className="max-w-[220px] truncate text-[11px] text-muted">{email}</p>}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition hover:text-ink"
              onClick={onSignOut}
            >
              <LogOut size={12} /> Se déconnecter
            </button>
          </div>
        </div>

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
              <button
                key={client.id}
                type="button"
                onClick={() => onSelect(client.id)}
                className="card group flex items-center gap-3 p-4 text-left transition hover:border-accent/50 hover:shadow-lg"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-sm font-bold text-accent">
                  {initials(client.name) || '?'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{client.name}</span>
                  <span className="block text-[11px] text-muted">
                    {client.itemCount} contenu{client.itemCount > 1 ? 's' : ''} · maj{' '}
                    {lastUpdate(client.updatedAt)}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </button>
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
    </div>
  );
}
