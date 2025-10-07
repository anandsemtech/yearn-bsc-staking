// src/routes/Dashboard.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { address, isConnected } = useAppKitAccount();

  // Redirect safely when disconnected
  useEffect(() => {
    if (!isConnected) navigate("/");
  }, [isConnected, navigate]);

  if (!isConnected) return null; // prevents a flash before redirect

  // Use the image from public/ (no import)
  const logo = "/assets/yearn_logo.png";

  return (
    <div className="yt-shell">
      <header className="yt-header">
        <div className="yt-brand">
          <img src={logo} alt="YearnTogether" />
          <span>YearnTogether</span>
        </div>
        <appkit-button balance="show"></appkit-button>
      </header>

      <main className="yt-main">
        <section className="yt-panel">
          <h2 className="yt-panel-title">Welcome</h2>
          <p className="yt-muted">Connected address</p>
          <code className="yt-code">{address}</code>
          <p className="yt-muted" style={{ marginTop: 16 }}>
            We’ll add cards for Active Stakes, Packages, and Claims here.
          </p>
        </section>
      </main>
    </div>
  );
}
