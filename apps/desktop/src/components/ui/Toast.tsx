import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Info, X } from "lucide-react";

import { useAppStore } from "../../stores/app-store";

export function ToastViewport() {
  const { toasts, dismissToast } = useAppStore();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3.5 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.6)]"
          >
            {toast.kind === "error" ? (
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-ink" aria-hidden />
            ) : (
              <Info size={15} className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-[12px] leading-5 text-ink">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 grid size-6 shrink-0 place-items-center rounded text-ink-muted transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
