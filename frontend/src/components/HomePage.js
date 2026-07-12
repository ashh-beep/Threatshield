import React from "react";
import UrlChecker from "./UrlChecker";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <nav style={{
        background: "#111",
        padding: 0,
        display: "flex",
        alignItems: "center",
        height: 70,
        borderBottom: "1px solid #222"
      }}>
        <img
          src="/logo-G.jpg"
          alt="Gatekeeper Logo"
          style={{
            height: 48,
            width: 48,
            borderRadius: "50%",
            objectFit: "cover",
            background: "#222",
            margin: "10px 24px 10px 30px"
          }}
        />
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, fontFamily:"Inter,sans-serif", letterSpacing: 1 }}>Gatekeeper</div>
        <div style={{ flex: 1 }} />
        <div style={{ marginRight: 32, display: "flex", gap: 36, alignItems: "center" }}>
          <a href="#" style={{ color: "#fff", fontSize: 18 }}>Scan Link</a>
          <a href="#" style={{ color: "#ccc", fontSize: 16 }}>How it works</a>
          <a href="#" style={{ color: "#ccc", fontSize: 16 }}>About</a>
        </div>
      </nav>
      <main style={{
        minHeight: "calc(100vh - 70px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          color: "#fff", textAlign: "center", margin: "0 0 38px 0",
          fontSize: "2.6rem", fontWeight: 600, letterSpacing: 2, lineHeight: 1.2
        }}>
          Identify &amp; Stop Risky Links Instantly.<br />
          <span style={{ color: "#22e9be" }}>The modern phishing shield.</span>
        </div>
        <UrlChecker />
      </main>
    </div>
  );
}


