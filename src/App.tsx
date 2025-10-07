// src/App.tsx
import React, { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

/** Watches wallet connection and redirects accordingly */
function ConnectionWatcher() {
  const { isConnected } = useAppKitAccount();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (isConnected && loc.pathname !== "/dashboard") {
      nav("/dashboard", { replace: true });
      return;
    }
    if (!isConnected && loc.pathname !== "/") {
      nav("/", { replace: true });
    }
  }, [isConnected, loc.pathname, nav]);

  return null;
}

/** App shell present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 relative">
      {/* Redirect logic lives here so it runs on all pages */}
      <ConnectionWatcher />

      {/* Always-on top bar */}
      <Header />

      {/* Page content */}
      <main>
        <Outlet />
      </main>

      {/* Global toasts */}
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
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
