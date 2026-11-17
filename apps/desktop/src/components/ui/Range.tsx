import { cn } from "../../lib/cn";

export interface RangeProps {
  label: string;
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
  className?: string;
}

/**
 * Flat monochrome slider. The filled portion is a plain div, not a gradient;
 * the native range input supplies keyboard behavior, focus and the thumb.
 */
export function Range({
  label,
  value,
  max,
  step,
  disabled = false,
  onChange,
  onCommit,
  className,
}: RangeProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={cn("relative flex h-4 w-full items-center", className)}>
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-line"
      />
      <div
        aria-hidden
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink"
        style={{ width: `${percent}%` }}
      />
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max > 0 ? max : 1}
        step={step ?? (max > 0 && max < 2 ? 0.05 : 0.1)}
        value={max > 0 ? Math.min(value, max) : 0}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onKeyUp={(event) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(event.key)
          ) {
            onCommit?.();
          }
        }}
        className="cinema-range relative z-10 w-full"
      />
    </div>
  );
}
