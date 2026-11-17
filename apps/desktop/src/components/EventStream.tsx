import { motion } from "motion/react";
import { Terminal } from "lucide-react";

import { Button } from "./ui/Button";

export interface LogEntry {
  id: number;
  at: string;
  event: string;
  detail: string;
}

interface EventStreamProps {
  entries: LogEntry[];
  onClear: () => void;
}

export function EventStream({ entries, onClear }: EventStreamProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
      aria-label="mpv IPC events"
      className="overflow-hidden rounded-xl border border-line-subtle bg-surface-1"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Terminal size={13} className="text-ink-secondary" aria-hidden />
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-secondary">
              IPC stream
            </p>
            <h2 className="mt-0.5 text-[12px] font-medium text-ink">
              mpv events
            </h2>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={entries.length === 0}
        >
          Clear
        </Button>
      </div>

      <div className="h-[228px] overflow-y-auto px-4 py-2 font-mono text-[10px] leading-5">
        {entries.length === 0 ? (
          <p className="pt-2 text-ink-secondary">
            Waiting for events. Start the engine and open a file.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-2.5 border-b border-line-subtle py-1 last:border-b-0"
            >
              <span className="shrink-0 text-ink-secondary">{entry.at}</span>
              <span className="shrink-0 text-ink">{entry.event}</span>
              <span className="min-w-0 truncate text-ink-secondary">
                {entry.detail}
              </span>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}
