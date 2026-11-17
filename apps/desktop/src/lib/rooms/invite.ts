export const INVITE_PROTOCOL = "absolute-cinema";

export function invitationLink(code: string): string {
  return `${INVITE_PROTOCOL}://join/${code}`;
}

/**
 * Accepts `AC-7F2K`, `7f2k`, `absolute-cinema://join/AC-7F2K` or an HTTPS
 * invitation URL whose last path segment is the code. Sprint 1 resolves the
 * code against local demo data only.
 */
export function parseInvitationInput(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, "");
  if (!cleaned) return "";

  let candidate = cleaned;
  if (candidate.includes("/")) {
    const segments = candidate.split("/").filter(Boolean);
    candidate = segments[segments.length - 1] ?? "";
  }

  candidate = candidate
    .replace(/^ac[-_]?/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();

  return candidate ? `AC-${candidate}` : "";
}
