"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Users, ShoppingCart,
  Truck, BarChart3, LogOut, Monitor, Tag, UserCog, Wallet, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const nav = [
  { href: "/dashboard",       icon: LayoutDashboard, label: "ແດດບອດ",          adminOnly: false },
  { href: "/pos",             icon: ShoppingCart,    label: "ຂາຍສິນຄ້າ",       adminOnly: false },
  { href: "/sales",           icon: ClipboardList,   label: "ປະຫວັດການຂາຍ",    adminOnly: false },
  { href: "/products",        icon: Package,         label: "ສິນຄ້າ",           adminOnly: false },
  { href: "/categories",      icon: Tag,             label: "ໝວດໝູ່",           adminOnly: false },
  { href: "/customers",       icon: Users,           label: "ລູກຄ້າ",           adminOnly: false },
  { href: "/deliveries",      icon: Truck,           label: "ການຈັດສົ່ງ",       adminOnly: false },
  { href: "/income-expenses", icon: Wallet,          label: "ລາຍຮັບ-ລາຍຈ່າຍ",  adminOnly: false },
  { href: "/reports",         icon: BarChart3,       label: "ລາຍງານ",           adminOnly: false },
  { href: "/employees",       icon: UserCog,         label: "ພະນັກງານ",         adminOnly: true  },
];

export default function Sidebar() {
  const path     = usePathname();
  const { user, logout } = useAuth();
  const isAdmin  = user?.role === "Admin";
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <aside style={{
      width: 240, minWidth: 240,
      height: "100vh", position: "sticky", top: 0,
      background: "#fff",
      borderRight: "1px solid #E5E9EF",
      display: "flex", flexDirection: "column",
      boxShadow: "1px 0 0 #E5E9EF",
    }}>

      {/* ── Brand ── */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #F0F2F5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(145deg, #FCD34D, #F59E0B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 10px rgba(245,158,11,0.38)",
            flexShrink: 0,
          }}>
            <Monitor size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "#0D1117", letterSpacing: "-0.02em" }}>IT Shop</div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", color: "#F59E0B", textTransform: "uppercase" }}>POS System</div>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C1C9D4", textTransform: "uppercase", padding: "4px 10px 10px" }}>
          ເມນູ
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {nav.filter(item => !item.adminOnly || isAdmin).map(({ href, icon: Icon, label }) => {
            const active = path === href || (href !== "/dashboard" && path.startsWith(href));
            return (
              <Link key={href} href={href} className={`sidebar-item ${active ? "active" : ""}`}>
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User ── */}
      <div style={{ padding: "12px", borderTop: "1px solid #F0F2F5" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px 10px 10px",
          background: "#F9FAFB",
          borderRadius: 10,
          marginBottom: 8,
          border: "1px solid #EAECEF",
        }}>
          {/* avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: isAdmin
              ? "linear-gradient(145deg, #FEF3C7, #FDE68A)"
              : "linear-gradient(145deg, #EDE9FE, #DDD6FE)",
            border: isAdmin ? "2px solid #FCD34D" : "2px solid #C4B5FD",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.8rem", fontWeight: 800,
            color: isAdmin ? "#D97706" : "#6D28D9",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0D1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name ?? "ຜູ້ໃຊ້"}
            </div>
            <div style={{ fontSize: "0.67rem", fontWeight: 600, color: isAdmin ? "#D97706" : "#7C3AED", marginTop: 1 }}>
              {isAdmin ? "Admin" : "Employee"}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "8px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1.5px solid #EAECEF",
            color: "#9CA3AF", fontSize: "0.8rem", fontWeight: 600,
            fontFamily: "inherit", transition: "all 0.15s",
          }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" })}
          onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "transparent", borderColor: "#EAECEF", color: "#9CA3AF" })}
        >
          <LogOut size={13} />
          ອອກຈາກລະບົບ
        </button>
      </div>
    </aside>
  );
}
