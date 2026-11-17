import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";

import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Always-mounted side panel. Keeping the DOM alive preserves the chat scroll
 * position when the drawer closes. It is not modal: Escape closes it, and the
 * rest of the workspace stays reachable.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closeAndRestore = () => {
    onCloseRef.current();
    const target = previousFocus.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred =
        panel.querySelector<HTMLElement>("[data-drawer-autofocus]");
      (preferred ?? panel).focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeAndRestore();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <motion.aside
      ref={panelRef}
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
      initial={false}
      animate={{ x: open ? "0%" : "100%" }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "absolute inset-y-0 right-0 z-40 flex w-[336px] max-w-full flex-col border-l border-line bg-surface-2 shadow-[-24px_0_60px_rgba(0,0,0,0.5)] max-[900px]:w-full focus-visible:outline-none",
        className,
      )}
    >
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-medium text-ink">{title}</h2>
          {description ? (
            <p className="truncate text-[11px] text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton
          label={`Close ${title.toLowerCase()}`}
          icon={<X size={16} />}
          size="sm"
          onClick={closeAndRestore}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-line-subtle">{footer}</div>
      ) : null}
    </motion.aside>
  );
}
