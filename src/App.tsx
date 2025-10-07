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
import { useAccount } from "wagmi";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";

import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

/** Guards */
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isConnected, status } = useAccount();
  // While connecting/reconnecting, don't bounce the user around
  if (status === "connecting" || status === "reconnecting") return null;
  if (!isConnected) return <Navigate to="/" replace />;
  return children;
}

function GuestRoute({ children }: { children: React.ReactElement }) {
  const { isConnected } = useAccount();
  if (isConnected) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Shell present on every page */
function Shell() {
  const { isConnected } = useAccount();
  const nav = useNavigate();
  const loc = useLocation();

  // Safety: if user connects while sitting on "/", push them to /dashboard.
  React.useEffect(() => {
    if (isConnected && (loc.pathname === "/" || loc.pathname === "")) {
      nav("/dashboard", { replace: true });
    }
  }, [isConnected, loc.pathname, nav]);

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
            <GuestRoute>
              <Welcome />
            </GuestRoute>
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
