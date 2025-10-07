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
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";
import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub";

/** Single source of truth: consider connected if either AppKit or Wagmi says so */
function useIsConnected() {
  const { isConnected: wagmiConnected } = useAccount();
  const { isConnected: appkitConnected } = useAppKitAccount();
  return wagmiConnected || appkitConnected;
}

/** Watches connection & current path and navigates accordingly (mobile friendly) */
function ConnectionWatcher() {
  const isConnected = useIsConnected();
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    if (isConnected && loc.pathname !== "/dashboard") {
      nav("/dashboard", { replace: true });
    } else if (!isConnected && loc.pathname !== "/") {
      nav("/", { replace: true });
    }
  }, [isConnected, loc.pathname, nav]);

  return null;
}

/** App shell present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <ConnectionWatcher />
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
