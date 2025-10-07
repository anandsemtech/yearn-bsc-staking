// src/App.tsx
import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Welcome from "./routes/WelcomeScreen";
import Dashboard from "./routes/Dashboard";

import Header from "@/components/Header";
import ToastHub from "@/components/ui/ToastHub"; // mounted once

/** App shell that is present on every route */
function Shell() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
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
