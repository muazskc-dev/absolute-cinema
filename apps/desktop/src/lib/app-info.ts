import { openUrl } from "@tauri-apps/plugin-opener";

import { isTauriRuntime } from "./mpv";

export const APP_NAME = "ABSOLUTE-CINEMA";
export const APP_VERSION = "0.1.0";
export const REPO_URL = "https://github.com/muazskc-dev/absolute-cinema";
export const GEIST_URL = "https://vercel.com/font";
export const MPV_URL = "https://mpv.io";
export const WCAG_URL =
  "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum";
export const OWASP_PASSWORD_URL =
  "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html";

export async function openExternal(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await openUrl(url);
      return;
    } catch {
      // Fall back to the webview if the opener scope rejects the URL.
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
