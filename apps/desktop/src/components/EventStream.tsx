import { motion } from "motion/react";
import { Terminal } from "lucide-react";

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" }}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-muted" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">IPC stream</p>
            <h2 className="mt-1 text-sm font-medium text-paper">mpv events</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-line px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-faint transition hover:border-line-strong hover:text-muted"
        >
          Clear
        </button>
      </div>

      <div className="h-[240px] overflow-y-auto px-5 py-3 font-mono text-[10px] leading-5">
        {entries.length === 0 ? (
          <p className="pt-2 text-faint">Waiting for events. Start the engine and open a file.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 border-b border-line/40 py-1 last:border-b-0">
              <span className="shrink-0 text-faint/70">{entry.at}</span>
              <span className="shrink-0 text-accent/90">{entry.event}</span>
              <span className="min-w-0 truncate text-muted">{entry.detail}</span>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}
