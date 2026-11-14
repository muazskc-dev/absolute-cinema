import { useEffect } from "react";

import { MediaLab } from "./features/lab/MediaLab";

export default function App() {
  // WebView2 can restore a previous scroll position; the deck should always
  // open at the top, especially after the window was resized between sessions.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return <MediaLab />;
}
