import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // initialises translations before the first render
import { App } from "./App";
import { AppProviders } from "./AppProviders";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
