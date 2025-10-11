import { Buffer } from "buffer";
(window as any).Buffer = (window as any).Buffer || Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppKitProvider } from "./providers/AppKitProvider";
import { DataProvider } from "./providers/DataProvider";
import App from "./App";
import "./theme.css";

/* ✅ Hard-lock Tailwind dark variants globally */
document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DataProvider>
      <AppKitProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <App />
        </BrowserRouter>
      </AppKitProvider>
    </DataProvider>
  </React.StrictMode>
);
