import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "../../lib/cn";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
  checked?: boolean;
}

export interface ContextMenuProps {
  label: string;
  items: ContextMenuItem[];
  align?: "start" | "end";
  trigger?: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
}

export function ContextMenu({
  label,
  items,
  align = "end",
  trigger,
  triggerLabel,
  triggerClassName,
  panelClassName,
}: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const estimatedHeight = items.length * 34 + 16;
    if (rect && rect.bottom + estimatedHeight > window.innerHeight - 12) {
      setPlacement("up");
    } else {
      setPlacement("down");
    }
    setOpen(true);
    window.requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      );
      first?.focus({ preventScroll: true });
    });
  }, [items.length]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onResize = () => close();

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [close, open]);

  const moveFocus = (direction: 1 | -1) => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      ),
    );
    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      (currentIndex + direction + focusable.length) % focusable.length;
    focusable[nextIndex]?.focus({ preventScroll: true });
  };

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {trigger ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={triggerLabel ?? label}
          title={triggerLabel ?? label}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openMenu();
            }
          }}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-[12px] text-ink-secondary transition-colors duration-100 hover:bg-surface-2 hover:text-ink",
            triggerClassName,
          )}
        >
          {trigger}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel ?? label}
          title={triggerLabel ?? label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openMenu();
            }
          }}
          className={cn(
            "inline-grid size-8 place-items-center rounded-md border border-transparent text-ink-secondary transition-colors duration-100 hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            open && "bg-surface-2 text-ink",
            triggerClassName,
          )}
        >
          <MoreHorizontal size={16} />
        </button>
      )}

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              panelRef.current
                ?.querySelector<HTMLButtonElement>(
                  '[role="menuitem"]:not([disabled])',
                )
                ?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              const focusable = panelRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not([disabled])',
              );
              focusable?.[focusable.length - 1]?.focus();
            } else if (event.key === "Tab") {
              close();
            }
          }}
          className={cn(
            "absolute z-50 min-w-[208px] overflow-y-auto rounded-lg border border-line bg-surface-2 p-1 shadow-[0_18px_48px_rgba(0,0,0,0.65)]",
            placement === "down" ? "top-full mt-1" : "bottom-full mb-1",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore ? (
                <div className="my-1 h-px bg-line-subtle" role="separator" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[12px] text-ink-secondary transition-colors duration-100 hover:bg-surface-3 hover:text-ink focus:bg-surface-3 focus:text-ink focus-visible:outline-none disabled:opacity-40"
              >
                <span className="grid size-4 shrink-0 place-items-center text-ink-muted">
                  {item.checked ? (
                    <CheckMark />
                  ) : (
                    item.icon ?? null
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
