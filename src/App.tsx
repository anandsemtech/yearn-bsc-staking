// src/App.tsx
import React from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

/**
 * ConnectionGate
 * - Pushes to /dashboard when connected and at /
 * - Pushes to / when NOT connected and path !== /
 * - Uses a small hydration flag to avoid a first-paint flicker
 */
function ConnectionGate() {
  const { isConnected } = useAppKitAccount();
  const nav = useNavigate();
  const loc = useLocation();

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (!hydrated) return;

    // If user connects on the welcome page → go to dashboard
    if (isConnected && loc.pathname === "/") {
      nav("/dashboard", { replace: true });
      return;
    }

    // If user is not connected and is on any non-root route → go to welcome
    if (!isConnected && loc.pathname !== "/") {
      nav("/", { replace: true });
      return;
    }
  }, [hydrated, isConnected, loc.pathname, nav]);

  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const showHeader = pathname !== "/"; // hide header on welcome

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* This component performs redirects based on wallet connection */}
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
        {/* Public welcome page */}
        <Route path="/" element={<Welcome />} />

        {/* Protected page (ConnectionGate will redirect to / if not connected) */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Catch-all → welcome */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
