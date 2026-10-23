import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
};

const BG: Record<ToastType, string> = {
  success: 'bg-emerald-50/95 border-emerald-200/90 text-emerald-950',
  error: 'bg-red-50/95 border-red-200/90 text-red-950',
  warning: 'bg-amber-50/95 border-amber-200/90 text-amber-950',
  info: 'bg-blue-50/95 border-blue-200/90 text-blue-950',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      drag="x"
      dragConstraints={{ left: 0, right: 120 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) {
          onDismiss(toast.id);
        }
      }}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-card text-[13px] font-medium backdrop-blur-md cursor-grab active:cursor-grabbing select-none ${BG[toast.type]}`}
    >
      {ICONS[toast.type]}
      <span className="flex-grow leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-black/5 rounded-lg transition-colors shrink-0 cursor-pointer text-neutral-400 hover:text-neutral-700"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-84 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
