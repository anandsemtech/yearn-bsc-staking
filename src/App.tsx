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
import { useAccount } from "wagmi";

import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";
import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";

/** Watches wallet state and keeps URL in sync */
function RouterSync() {
  const { isConnected, status } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const onDashboard = location.pathname.startsWith("/dashboard");

    // When connected → go to dashboard
    if (status === "connected" && !onDashboard) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // When not connected → keep on welcome
    if (status === "disconnected" && onDashboard) {
      navigate("/", { replace: true });
      return;
    }
    // Note: when status === "reconnecting", AppKit is restoring the session.
    // We don't redirect until it settles to connected/disconnected.
  }, [status, isConnected, location.pathname, navigate]);

  return null;
}

/** App shell present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <RouterSync />
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
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
