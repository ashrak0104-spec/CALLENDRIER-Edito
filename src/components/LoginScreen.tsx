import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  KeyRound,
  Loader2,
  Mail,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { api, type AuthStatus } from '../lib/api';
import { useToast } from './Toast';

interface LoginScreenProps {
  status: AuthStatus;
  onSignedIn: (email: string) => void;
}

type Step = 'email' | 'code';

export default function LoginScreen({ status, onSignedIn }: LoginScreenProps) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [configured, setConfigured] = useState(status.configured);
  const [showSetup, setShowSetup] = useState(!status.configured);
  const [apiKey, setApiKey] = useState('');
  const [senderEmail, setSenderEmail] = useState(status.senderEmail);
  const [senderName, setSenderName] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);

  useEffect(() => {
    if (retryAt === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000));

  const requestCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.authRequestCode(email);
      if (!result.ok) {
        setError(result.error ?? "L'envoi du code a échoué.");
        if (result.retryAfterSeconds) {
          setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
          setNow(Date.now());
        }
        return;
      }
      setDevCode(result.devCode ?? null);
      setCode('');
      setStep('code');
      setRetryAt(Date.now() + 60 * 1000);
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'envoi du code a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.authVerify(email, code);
      if (!result.ok) {
        setError(result.error ?? 'Code invalide.');
        return;
      }
      onSignedIn(result.email ?? email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La vérification a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const saveSetup = async () => {
    setError(null);
    setSavingSetup(true);
    try {
      const result = await api.authConfigure({ apiKey, senderEmail, senderName });
      if (!result.configured) {
        setError(result.error ?? "Configuration refusée.");
        return;
      }
      setConfigured(true);
      setShowSetup(false);
      setApiKey('');
      toast('Envoi des emails configuré.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Configuration impossible.');
    } finally {
      setSavingSetup(false);
    }
  };

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && email.trim()) void requestCode();
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && code.length === 6) void verify();
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-bg px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <CalendarDays size={22} />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">Editorial Studio</p>
            <p className="text-[11px] text-muted">Calendrier & production de contenu</p>
          </div>
        </div>

        <div className="card p-6">
          {step === 'email' ? (
            <form onSubmit={submitEmail} className="space-y-4">
              <div>
                <h1 className="text-lg font-bold tracking-tight">Connexion</h1>
                <p className="mt-1 text-xs text-muted">
                  Recevez un code à 6 chiffres par email pour ouvrir votre calendrier.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="login-email">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    className="field !pl-9"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !email.trim()}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Recevoir un code
              </button>

              {!configured && (
                <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                  L'envoi d'emails n'est pas encore configuré sur cet ordinateur.
                  <button
                    type="button"
                    className="ml-1 font-semibold underline"
                    onClick={() => setShowSetup(true)}
                  >
                    Configurer maintenant
                  </button>
                </div>
              )}

              {status.dev && !configured && (
                <p className="text-[10px] leading-relaxed text-muted">
                  Mode développement : sans clé d'envoi, le code est affiché après la demande.
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <button
                  type="button"
                  className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted transition hover:text-ink"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                    setDevCode(null);
                  }}
                >
                  <ArrowLeft size={12} /> Changer d'adresse
                </button>
                <h1 className="text-lg font-bold tracking-tight">Entrez votre code</h1>
                <p className="mt-1 text-xs text-muted">
                  Un code à 6 chiffres a été envoyé à <span className="font-medium text-ink">{email}</span>.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="login-code">
                  Code de connexion
                </label>
                <div className="relative">
                  <KeyRound
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="login-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    className="field !pl-9 text-center text-lg font-semibold tracking-[0.5em] tabular-nums"
                    placeholder="000000"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
              </div>

              {devCode && (
                <p className="rounded-lg border border-line bg-raised px-3 py-2 text-center text-[11px] text-muted">
                  Mode développement — code :{' '}
                  <span className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                    {devCode}
                  </span>
                </p>
              )}

              {error && (
                <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Se connecter
              </button>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  className="font-medium text-muted transition hover:text-ink disabled:opacity-50"
                  disabled={cooldown > 0 || busy}
                  onClick={() => void requestCode()}
                >
                  {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
                </button>
                <span className="text-muted">Valable 10 minutes</span>
              </div>
            </form>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 px-1 text-[10px] leading-relaxed text-muted">
          <ShieldCheck size={12} className="mt-0.5 shrink-0" />
          <p>
            Vos contenus restent stockés sur cet ordinateur. Aucun contenu n'est envoyé par email ;
            seul le code de connexion transite.
          </p>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted transition hover:text-ink"
          onClick={() => setShowSetup((value) => !value)}
        >
          <Settings2 size={12} /> Configuration de l'envoi des emails
        </button>

        {showSetup && (
          <div className="card mt-2 space-y-3 p-4">
            <div>
              <h2 className="text-xs font-semibold">Envoi des codes par Brevo</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                Créez une clé API transactionnelle dans Brevo, puis vérifiez l'adresse expéditrice.
                La clé est enregistrée uniquement dans le dossier de données de l'application, jamais
                dans le projet.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="setup-key">
                Clé API Brevo
              </label>
              <input
                id="setup-key"
                type="password"
                autoComplete="off"
                className="field font-mono text-xs"
                placeholder="xkeysib-…"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="setup-sender">
                  Email expéditeur
                </label>
                <input
                  id="setup-sender"
                  type="email"
                  className="field"
                  placeholder="vous@exemple.com"
                  value={senderEmail}
                  onChange={(event) => setSenderEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="setup-name">
                  Nom expéditeur
                </label>
                <input
                  id="setup-name"
                  className="field"
                  placeholder="Editorial Studio"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-[10px] font-medium text-accent hover:underline"
                onClick={() => void api.openTarget('https://app.brevo.com/senders')}
              >
                Ouvrir Brevo (expéditeurs vérifiés)
              </button>
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1 text-[11px]"
                disabled={savingSetup || !apiKey.trim() || !senderEmail.trim()}
                onClick={() => void saveSetup()}
              >
                {savingSetup ? <Loader2 size={12} className="animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
