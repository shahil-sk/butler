import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { setupGlobalShortcuts } from "@/kernel/router";
import { Shell } from "@/shell/Shell";

export default function App() {
  useEffect(() => {
    const cleanup = setupGlobalShortcuts();
    return cleanup;
  }, []);

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
