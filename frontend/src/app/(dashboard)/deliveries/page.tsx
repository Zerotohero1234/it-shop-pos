"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck, MapPin, User, ChevronRight, Clock,
  CheckCircle2, PackageCheck,
} from "lucide-react";
import Header from "@/components/Header";
import { deliveriesApi } from "@/lib/api";
import { Delivery } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

type StatusFilter = "all" | "Pending" | "Shipping" | "Delivered";

const STATUS_LABELS: Record<string, string> = {
  Pending:   "ລໍຖ້າ",
  Shipping:  "ກຳລັງສົ່ງ",
  Delivered: "ສົ່ງສຳເລັດ",
};

const STATUS_NEXT: Record<string, string> = {
  Pending:  "Shipping",
  Shipping: "Delivered",
};

/* colour palettes per status */
const STATUS_PALETTE: Record<string, {
  bg: string; border: string; text: string;
  iconBg: string; iconColor: string;
  badgeBg: string; badgeBorder: string; badgeText: string;
}> = {
  Pending: {
    bg: "#FFFBEB", border: "#FDE68A", text: "#92400E",
    iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)", iconColor: "#D97706",
    badgeBg: "#FFFBEB", badgeBorder: "#FDE68A", badgeText: "#92400E",
  },
  Shipping: {
    bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8",
    iconBg: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", iconColor: "#2563EB",
    badgeBg: "#EFF6FF", badgeBorder: "#BFDBFE", badgeText: "#1D4ED8",
  },
  Delivered: {
    bg: "#F0FDF4", border: "#86EFAC", text: "#15803D",
    iconBg: "linear-gradient(145deg,#F0FDF8,#DCFCE7)", iconColor: "#059669",
    badgeBg: "#F0FDF4", badgeBorder: "#86EFAC", badgeText: "#15803D",
  },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pending:   <Clock size={18} />,
  Shipping:  <Truck size={18} />,
  Delivered: <CheckCircle2 size={18} />,
};

/* Filter tab counts */
const TAB_CONFIGS = [
  { key: "all",       label: "ທັງໝົດ",      icon: <PackageCheck size={13} /> },
  { key: "Pending",   label: "ລໍຖ້າ",       icon: <Clock size={13} /> },
  { key: "Shipping",  label: "ກຳລັງສົ່ງ",   icon: <Truck size={13} /> },
  { key: "Delivered", label: "ສຳເລັດ",       icon: <CheckCircle2 size={13} /> },
] as const;

export default function DeliveriesPage() {
  const [deliveries,  setDeliveries]  = useState<Delivery[]>([]);
  const [statusFilter,setStatusFilter]= useState<StatusFilter>("all");
  const [loading,     setLoading]     = useState(true);
  const [updatingId,  setUpdatingId]  = useState<number | null>(null);
  const { showToast } = useToast();
  useAuth(); // ensure auth context is available

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deliveriesApi.getAll(
        statusFilter !== "all" ? { status: statusFilter } : {}
      );
      setDeliveries(res.data.data || []);
    } catch {
      showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (delivery: Delivery) => {
    const next = STATUS_NEXT[delivery.status];
    if (!next) return;
    setUpdatingId(delivery.id);
    try {
      await deliveriesApi.updateStatus(delivery.id, next);
      showToast(`ອັບເດດເປັນ "${STATUS_LABELS[next]}" ສຳເລັດ`, "success");
      load();
    } catch {
      showToast("ອັບເດດຜິດພາດ", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = {
    all:       deliveries.length,
    Pending:   deliveries.filter(d => d.status === "Pending").length,
    Shipping:  deliveries.filter(d => d.status === "Shipping").length,
    Delivered: deliveries.filter(d => d.status === "Delivered").length,
  };

  const filtered = statusFilter === "all"
    ? deliveries
    : deliveries.filter(d => d.status === statusFilter);

  return (
    <>
      <Header title="ການຈັດສົ່ງ" subtitle="ຕິດຕາມ ແລະ ຈັດການການຈັດສົ່ງ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 40px" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>
            ຕິດຕາມ
          </p>
          <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            ການຈັດສົ່ງ
          </h2>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {TAB_CONFIGS.map(({ key, label, icon }) => {
            const active = statusFilter === key;
            const count  = counts[key as keyof typeof counts];
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key as StatusFilter)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? "rgba(245,158,11,0.45)" : "#E5E9EF"}`,
                  background: active ? "rgba(245,158,11,0.07)" : "#fff",
                  color: active ? "#D97706" : "#6B7280",
                  cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 7,
                  transition: "all 0.18s",
                  fontFamily: "inherit",
                  boxShadow: active ? "0 2px 8px rgba(245,158,11,0.15)" : "0 1px 2px rgba(13,17,23,0.05)",
                }}
              >
                {icon}
                {label}
                <span style={{
                  background: active ? "rgba(245,158,11,0.18)" : "#F4F6F9",
                  color:      active ? "#D97706" : "#9CA3AF",
                  borderRadius: 999, padding: "1px 7px",
                  fontSize: "0.7rem", fontWeight: 700,
                  minWidth: 20, textAlign: "center",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Cards ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 170, borderRadius: 18 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 18,
            boxShadow: "0 2px 8px rgba(13,17,23,0.06)",
            padding: "56px", textAlign: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
              background: "linear-gradient(145deg,#F4F6F9,#E5E9EF)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Truck size={22} color="#9CA3AF" />
            </div>
            <div style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>ບໍ່ມີຂໍ້ມູນການຈັດສົ່ງ</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {filtered.map(d => {
              const pal = STATUS_PALETTE[d.status] ?? STATUS_PALETTE.Pending;
              const isUpdating = updatingId === d.id;
              const hasNext    = !!STATUS_NEXT[d.status];
              return (
                <div key={d.id} style={{
                  background: "#fff", borderRadius: 18,
                  boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)",
                  padding: "20px 22px",
                  transition: "box-shadow 0.22s, transform 0.22s",
                  borderLeft: `3px solid ${pal.border}`,
                }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, {
                    boxShadow: "0 8px 24px rgba(13,17,23,0.09), 0 2px 6px rgba(13,17,23,0.04)",
                    transform: "translateY(-2px)",
                  })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, {
                    boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)",
                    transform: "translateY(0)",
                  })}
                >
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: pal.iconBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: pal.iconColor,
                      }}>
                        {STATUS_ICON[d.status]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0D1117", fontSize: "0.9rem" }}>
                          ຈັດສົ່ງ #{d.id}
                        </div>
                        <div className="price" style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>
                          ບິນ #{d.sale_id}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 10px", borderRadius: 999,
                      background: pal.badgeBg, border: `1px solid ${pal.badgeBorder}`,
                      color: pal.badgeText, fontSize: "0.72rem", fontWeight: 700,
                    }}>
                      {STATUS_LABELS[d.status]}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {d.address && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "0.8rem", color: "#6B7280" }}>
                        <MapPin size={13} style={{ flexShrink: 0, marginTop: 2, color: "#9CA3AF" }} />
                        <span>{d.address}</span>
                      </div>
                    )}
                    {d.driver_name && (
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.8rem", color: "#6B7280" }}>
                        <User size={13} style={{ color: "#9CA3AF" }} />
                        <span>ຄົນຂັບ: <strong style={{ color: "#0D1117", fontWeight: 600 }}>{d.driver_name}</strong></span>
                      </div>
                    )}
                    {d.customer_name && (
                      <div style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>
                        ລູກຄ້າ: {d.customer_name}
                      </div>
                    )}
                    {d.delivery_date && (
                      <div style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>
                        ວັນທີ: {new Date(d.delivery_date).toLocaleDateString("lo-LA")}
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  {hasNext && (
                    <button
                      onClick={() => updateStatus(d)}
                      disabled={isUpdating}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px",
                        borderRadius: 9,
                        border: `1.5px solid ${pal.border}`,
                        background: pal.bg,
                        color: pal.text,
                        cursor: isUpdating ? "wait" : "pointer",
                        fontSize: "0.8rem", fontWeight: 600,
                        fontFamily: "inherit",
                        transition: "all 0.16s",
                        opacity: isUpdating ? 0.6 : 1,
                      }}
                    >
                      {isUpdating ? "ກຳລັງອັບເດດ..." : (
                        <>
                          ອັບເດດເປັນ &quot;{STATUS_LABELS[STATUS_NEXT[d.status]]}&quot;
                          <ChevronRight size={13} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
