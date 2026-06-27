import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

/**
 * Usage:
 *   const [toast, setToast] = useState(null);
 *   showToast = (msg, type='success') => { setToast({msg,type}); }
 *   <Toast toast={toast} onDismiss={() => setToast(null)} />
 */
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  return (
    <div
      className={`fixed bottom-28 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-floating border text-sm font-semibold max-w-md mx-auto transition-all ${
        isError
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-success-50 border-success-200 text-success-700'
      }`}
    >
      {isError ? (
        <AlertTriangle className="w-5 h-5 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 shrink-0" />
      )}
      <span className="flex-1">{toast.msg}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
