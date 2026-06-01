"use client";

import { useState, useEffect } from "react";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const isAdmin  = user?.role === "Admin";
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <header style={{
      height: 58,
      background: "rgba(255,255,255,0.82)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid #E5E9EF",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      position: "sticky", top: 0, zIndex: 100, flexShrink: 0,
      boxShadow: "0 1px 0 #E5E9EF",
    }}>

      {/* Left */}
      <div>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.975rem", color: "#0D1117", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && <p style={{ fontSize: "0.68rem", color: "#9CA3AF", marginTop: 1 }}>{subtitle}</p>}
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Mini clock */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 12px", borderRadius: 8,
          background: "#F9FAFB", border: "1px solid #EAECEF",
        }}>
          <span className="price" style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F59E0B" }}>
            {now.toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span style={{ fontSize: "0.64rem", color: "#9CA3AF" }}>
            {now.toLocaleDateString("lo-LA", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>

        {/* Bell */}
        <button style={{
          width: 34, height: 34, borderRadius: 8,
          background: "#F9FAFB", border: "1px solid #EAECEF",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#9CA3AF", position: "relative",
          transition: "all 0.14s",
        }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#F3F4F6", color: "#6B7280" })}
          onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#F9FAFB", color: "#9CA3AF" })}
        >
          <Bell size={14} />
          <span style={{
            position: "absolute", top: 8, right: 8,
            width: 5, height: 5, borderRadius: "50%",
            background: "#F59E0B", border: "1.5px solid #fff",
          }} />
        </button>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
          background: isAdmin ? "linear-gradient(145deg,#FEF3C7,#FDE68A)" : "linear-gradient(145deg,#EDE9FE,#DDD6FE)",
          border: isAdmin ? "2px solid #FCD34D" : "2px solid #C4B5FD",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.78rem", fontWeight: 800,
          color: isAdmin ? "#D97706" : "#6D28D9",
          boxShadow: isAdmin ? "0 2px 6px rgba(245,158,11,0.25)" : "0 2px 6px rgba(109,40,217,0.2)",
        }} title={user?.name}>
          {initials}
        </div>
      </div>
    </header>
  );
}
