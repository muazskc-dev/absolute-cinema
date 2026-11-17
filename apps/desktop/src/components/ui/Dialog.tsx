import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

import { useDialogFocus } from "../../hooks/use-dialog-focus";
import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
  className?: string;
}

const WIDTHS = {
  sm: "max-w-[400px]",
  md: "max-w-[440px]",
  lg: "max-w-[520px]",
} as const;

/**
 * Modal dialog. Render inside <AnimatePresence> so the exit animation runs when
 * the parent removes it.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  width = "md",
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <motion.div
        className="absolute inset-0 bg-black/72"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.985, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.99, y: 2 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "relative flex max-h-[calc(100vh-48px)] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface-2 shadow-[0_32px_80px_rgba(0,0,0,0.7)]",
          WIDTHS[width],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-6 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-[16px] font-medium leading-6 tracking-[-0.01em] text-ink"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-[12px] leading-5 text-ink-secondary"
              >
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            label="Close dialog"
            icon={<X size={16} />}
            size="sm"
            className="-mr-1 -mt-0.5"
            onClick={onClose}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line-subtle bg-surface-1/40 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * Convenience wrapper for screens that own an AnimatePresence boundary.
 */
export function DialogPresence({ children }: { children: ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}
