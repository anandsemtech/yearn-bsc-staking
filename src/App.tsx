// src/App.tsx
import React from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAccount } from "wagmi";

import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";
import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";

/** Guards
 * - RedirectIfConnected: If wallet is connected, go to /dashboard (used on '/')
 * - RequireConnected: If wallet is NOT connected, send to '/' (used on '/dashboard')
 */
function RedirectIfConnected() {
  const { isConnected, address } = useAccount();
  if (isConnected && address) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

function RequireConnected() {
  const { status, isConnected, address } = useAccount();

  // While AppKit/wagmi is restoring a session, avoid flicker
  if (status === "connecting" || status === "reconnecting") {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-gray-400">
        Checking wallet…
      </div>
    );
  }

  if (isConnected && address) {
    return <Outlet />;
  }

  // Not connected → back to welcome
  return <Navigate to="/" replace />;
}

/** App shell present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
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
        {/* Public: if already connected, redirect to /dashboard */}
        <Route element={<RedirectIfConnected />}>
          <Route path="/" element={<Welcome />} />
        </Route>

        {/* Private: only when connected */}
        <Route element={<RequireConnected />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
