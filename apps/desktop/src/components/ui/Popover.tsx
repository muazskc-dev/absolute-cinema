import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "../../lib/cn";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}

/**
 * Non-modal anchored panel. Escape closes it and returns focus to the anchor;
 * clicking outside closes it without stealing focus.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  label,
  align = "end",
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const preferred = panel?.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? panel)?.focus({ preventScroll: true });
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
      anchorRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={label}
          tabIndex={-1}
          initial={{ opacity: 0, y: -4, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -2, scale: 0.995 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className={cn(
            "absolute top-full z-50 mt-2 w-[300px] rounded-lg border border-line bg-surface-2 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
