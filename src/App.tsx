// src/App.tsx
import React from "react";
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

/** Hard-sync URL with AppKit connection state (runs on every state change). */
function AppKitRouterSync() {
  const { isConnected } = useAppKitAccount();
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    // If connected but not on /dashboard → go there
    if (isConnected && loc.pathname !== "/dashboard") {
      nav("/dashboard", { replace: true });
      return;
    }
    // If disconnected but not on / → go to welcome
    if (!isConnected && loc.pathname !== "/") {
      nav("/", { replace: true });
    }
  }, [isConnected, loc.pathname, nav]);

  return null;
}

/** Gate that only shows children if connected; otherwise sends to "/" */
function RequireConnected({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAppKitAccount();
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Public-only route: if connected, jump to "/dashboard" */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAppKitAccount();
  if (isConnected) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** App shell present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      {/* Always keep router in sync with AppKit */}
      <AppKitRouterSync />
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
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
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
