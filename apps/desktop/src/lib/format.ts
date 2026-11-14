export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}x`;
}

export function basename(path: string | null | undefined): string {
  if (!path) return "No source";
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function shortError(error: string, max = 140): string {
  return error.length > max ? `${error.slice(0, max - 1)}…` : error;
}
