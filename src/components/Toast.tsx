import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cx, uid } from '../lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastEntry {
  id: string;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = uid();
      setToasts((previous) => [...previous.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-toast-in pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-pop"
          >
            <span
              className={cx(
                'mt-0.5 shrink-0',
                toast.kind === 'success' && 'text-emerald-500',
                toast.kind === 'error' && 'text-rose-500',
                toast.kind === 'info' && 'text-sky-500',
              )}
            >
              {toast.kind === 'success' && <CheckCircle2 size={16} />}
              {toast.kind === 'error' && <AlertTriangle size={16} />}
              {toast.kind === 'info' && <Info size={16} />}
            </span>
            <span className="min-w-0 flex-1 break-words leading-snug text-ink">{toast.message}</span>
            <button
              type="button"
              className="text-muted transition hover:text-ink"
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer la notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
