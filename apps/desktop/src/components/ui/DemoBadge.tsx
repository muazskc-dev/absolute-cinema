import { cn } from "../../lib/cn";

export function DemoBadge({
  label = "Demo data",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-[10px] uppercase tracking-[0.12em] text-ink-secondary",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1 rounded-full border border-[#777] bg-transparent"
      />
      {label}
    </span>
  );
}
