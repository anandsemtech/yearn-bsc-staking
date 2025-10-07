// src/App.tsx
import React from "react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";

import { AppKitProvider } from "@/web3/web3.config";
import Dashboard from "./components/Dashboard";
import Header from "./components/Header";
import WelcomeScreen from "./components/WelcomeScreen";

function Root() {
  const { status, isConnected: wagmiConnected } = useAccount();
  const { isConnected: appkitConnected } = useAppKitAccount();

  // Treat either source as "connected"
  const isConnected = wagmiConnected || appkitConnected;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 relative">
      <Header />
      {isConnected ? (
        <Dashboard />
      ) : (
        <WelcomeScreen connecting={status === "connecting" || status === "reconnecting"} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppKitProvider>
      <Root />
    </AppKitProvider>
  );
}
