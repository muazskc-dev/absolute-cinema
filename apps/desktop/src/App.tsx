import { useEffect } from "react";
import { MotionConfig } from "motion/react";

import { AppProvider, useAppStore } from "./stores/app-store";
import { AppShell } from "./components/layout/AppShell";
import { DialogHost } from "./components/layout/DialogHost";
import { ToastViewport } from "./components/ui/Toast";

function Surface() {
  const { preferences } = useAppStore();

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = preferences.reducedMotion
      ? "true"
      : "false";
  }, [preferences.reducedMotion]);

  return (
    <MotionConfig
      reducedMotion={preferences.reducedMotion ? "always" : "never"}
    >
      <AppShell />
      <DialogHost />
      <ToastViewport />
    </MotionConfig>
  );
}

export default function App() {
  // WebView2 can restore a previous scroll position; the workspace should always
  // open at the top, especially after the window was resized between sessions.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <AppProvider>
      <Surface />
    </AppProvider>
  );
}
