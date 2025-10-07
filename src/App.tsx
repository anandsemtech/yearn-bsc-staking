// src/App.tsx
import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

/** Unified connection state (Wagmi OR AppKit) */
function useIsConnected() {
  const { isConnected: wagmiConnected } = useAccount();
  const { isConnected: appkitConnected } = useAppKitAccount();
  return wagmiConnected || appkitConnected;
}

/** Only render children when connected, otherwise bounce to "/" */
function RequireConnected({ children }: { children: React.ReactNode }) {
  const isConnected = useIsConnected();
  return isConnected ? <>{children}</> : <Navigate to="/" replace />;
}

/** Only render children when DISconnected, otherwise bounce to "/dashboard" */
function RequireDisconnected({ children }: { children: React.ReactNode }) {
  const isConnected = useIsConnected();
  return !isConnected ? <>{children}</> : <Navigate to="/dashboard" replace />;
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
        <Route
          path="/"
          element={
            <RequireDisconnected>
              <Welcome />
            </RequireDisconnected>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireConnected>
              <Dashboard />
            </RequireConnected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
