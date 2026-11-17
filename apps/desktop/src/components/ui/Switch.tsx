import { cn } from "../../lib/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  id,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-100 ease-out disabled:opacity-40",
        checked
          ? "border-white bg-white"
          : "border-line bg-surface-3 hover:border-[#3a3a3a]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block size-3.5 rounded-full transition-transform duration-100 ease-out",
          checked ? "translate-x-[14px] bg-black" : "translate-x-0 bg-[#a1a1aa]",
        )}
      />
    </button>
  );
}
