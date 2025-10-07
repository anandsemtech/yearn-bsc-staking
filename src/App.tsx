// src/App.tsx
import React from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

function ConnectionGate() {
  // 👇 single source of truth = AppKit
  const { isConnected } = useAppKitAccount();
  const nav = useNavigate();
  const loc = useLocation();

  // avoid redirect flicker on very first paint
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (!hydrated) return;

    // forward: welcome -> dashboard when connected
    if (isConnected && loc.pathname === "/") {
      nav("/dashboard", { replace: true });
      return;
    }
    // back: any non-root -> root when not connected
    if (!isConnected && loc.pathname !== "/") {
      nav("/", { replace: true });
      return;
    }
  }, [hydrated, isConnected, loc.pathname, nav]);

  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const showHeader = pathname !== "/"; // no header on the welcome page

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <ConnectionGate />
      {showHeader && <Header />}
      <main>
        <Outlet />
      </main>
      <ToastHub />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
