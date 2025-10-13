// src/App.tsx
import React, { useEffect } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";
import { captureReferrerFromLocation } from "@/lib/referrer";

// ⬇️ Mount this overlay once for all tx confirmations
import TxConfirmOverlay from "@/components/TxConfirmOverlay";


/** One-time global capture of ?ref=0x... on initial mount */
function RefCaptureOnce() {
  useEffect(() => {
    captureReferrerFromLocation();
  }, []);
  return null;
}

/** Small gate so we don't redirect during SSR/first paint */
function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Only render children when connected; otherwise push to "/" */
const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const hydrated = useHydrated();
  const { isConnected } = useAppKitAccount();
  const loc = useLocation();

  if (!hydrated) return null; // avoid any flicker
  if (!isConnected) {
    return <Navigate to="/" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
};

/** If already connected, skip the welcome and go to dashboard */
const PublicOnlyRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const hydrated = useHydrated();
  const { isConnected } = useAppKitAccount();

  if (!hydrated) return null;
  if (isConnected) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

function Shell() {
  const { pathname } = useLocation();
  const showHeader = pathname !== "/"; // no header on the welcome page
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Global once-per-app ref capture */}
      <RefCaptureOnce />

      {showHeader && <Header />}
      <main>
        <Outlet />
      </main>

      {/* Global toasts */}
      <ToastHub />

      {/* 🔥 Global tx confirmation overlay (spins, then confetti on success) */}
      <TxConfirmOverlay />
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
            <PublicOnlyRoute>
              <Welcome />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
