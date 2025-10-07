// src/App.tsx
import React, { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";

import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub"; // mounted once

/** Redirect guard that reacts to wallet connection/disconnection */
function AuthGate() {
  const { status, isConnected: wagmiConnected } = useAccount();
  const { isConnected: appkitConnected } = useAppKitAccount();
  const isConnected = wagmiConnected || appkitConnected;

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If connected and sitting on "/", go to dashboard
    if (isConnected && (location.pathname === "/" || location.pathname === "/welcome")) {
      navigate("/dashboard", { replace: true });
      return;
    }
    // If not connected and trying to view /dashboard, send back to welcome
    if (!isConnected && location.pathname.startsWith("/dashboard")) {
      navigate("/", { replace: true });
    }
  }, [isConnected, location.pathname, navigate]);

  return null;
}

/** App shell that is present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 transition-colors duration-200 relative">
      <Header />
      {/* Auth-based redirects */}
      <AuthGate />
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
