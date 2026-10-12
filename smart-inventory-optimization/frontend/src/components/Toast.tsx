import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastSeverity = 'success' | 'error' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  severity: ToastSeverity;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const severityClass =
    toast.severity === 'success'
      ? 'toast-success'
      : toast.severity === 'error'
        ? 'toast-error'
        : 'toast-warning';

  const icon =
    toast.severity === 'success' ? '✓' : toast.severity === 'error' ? '✕' : '⚠';

  return (
    <div className={`toast ${severityClass}`} role="alert" aria-live="polite">
      <span aria-hidden="true">{icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        className="toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

/** Container that renders active toasts. */
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

let _nextId = 1;

/** Hook for managing toast state. */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(_nextId);

  const showToast = useCallback((message: string, severity: ToastSeverity = 'success') => {
    const id = counterRef.current++;
    _nextId = counterRef.current;
    setToasts((prev) => [...prev, { id, message, severity }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

export default Toast;
