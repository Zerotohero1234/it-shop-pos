"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, DollarSign, ShoppingCart, Package,
  AlertTriangle, ArrowUpRight, Calendar, ChevronLeft, ChevronRight,
  X, Trophy, Receipt, Truck, User, Download, FileDown, Loader2,
} from "lucide-react";
import Header from "@/components/Header";
import { reportsApi, salesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

/* ══ Types ══════════════════════════════════════════════════════ */
type Preset = "today" | "week" | "month" | "3months" | "custom";

interface DailyRow    { date: string; total_revenue: number; total_sales: number; }
interface MonthlyRow  { month: string; total_revenue: number; total_sales: number; }
interface IncomeRow   { type: string; total: number; count: number; }
interface IncomeSummary { total_income: number; total_expense: number; net_profit: number; }
interface TopProduct  { id: number; name: string; sku: string; category_name: string | null; total_quantity: number; total_revenue: number; sale_count: number; }
interface SaleRow     { id: number; invoice_number: string; total: number; payment_method: string; payment_status: string; refund_status: string; customer_name: string | null; created_at: string; }
interface SaleMeta    { total: number; page: number; totalPages: number; }
interface LowStockRow { id: number; name: string; sku: string; category_name: string | null; stock: number; min_stock: number; }

/* ══ Helpers ════════════════════════════════════════════════════ */
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₭`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K ₭`;
  return `${n.toLocaleString()} ₭`;
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(preset: Preset, cStart: string, cEnd: string): { start: string; end: string } {
  const today = new Date();
  const now   = toISO(today);
  if (preset === "today") return { start: now, end: now };
  if (preset === "week") {
    const d = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
    return { start: toISO(mon), end: now };
  }
  if (preset === "month") {
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, "0");
    return { start: `${y}-${m}-01`, end: now };
  }
  if (preset === "3months") {
    const s = new Date(today); s.setDate(today.getDate() - 89);
    return { start: toISO(s), end: now };
  }
  return { start: cStart || now, end: cEnd || now };
}

const PRESET_LABELS: Record<Preset, string> = {
  today:    "ວັນນີ້",
  week:     "ອາທິດນີ້",
  month:    "ເດືອນນີ້",
  "3months":"3 ເດືອນ",
  custom:   "ກຳນົດເອງ",
};

const PM_LABEL: Record<string, string> = { cash: "ເງິນສົດ", transfer: "ໂອນ", card: "ບັດ" };

/** Returns display info based on refund_status first, then payment_status */
function getSaleStatusDisplay(paymentStatus: string, refundStatus?: string): { bg: string; color: string; label: string } {
  if (refundStatus === "full")    return { bg: "#FEF2F2", color: "#DC2626", label: "ຄືນແລ້ວ" };
  if (refundStatus === "partial") return { bg: "#FFFBEB", color: "#D97706", label: "ຄືນບາງສ່ວນ" };
  if (paymentStatus === "refunded") return { bg: "#FEF2F2", color: "#DC2626", label: "ຄືນແລ້ວ" };
  if (paymentStatus === "pending")  return { bg: "#FFF7ED", color: "#C2410C", label: "ລໍຖ້າ" };
  return { bg: "#ECFDF5", color: "#059669", label: "ສຳເລັດ" };
}

// Keep for legacy usage in SaleDetailModal
const PS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  paid:     { bg: "#ECFDF5", color: "#059669", label: "ສຳເລັດ" },
  refunded: { bg: "#FEF2F2", color: "#DC2626", label: "ຄືນແລ້ວ" },
  pending:  { bg: "#FFFBEB", color: "#D97706", label: "ລໍຖ້າ" },
};

/* ══ Chart Tooltip ══════════════════════════════════════════════ */
interface TipProps { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string; }
function ChartTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E9EF", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(13,17,23,0.1)" }}>
      <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color ?? "#F59E0B", flexShrink: 0 }} />
          <span className="price" style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0D1117" }}>
            {p.name?.includes("revenue") ? fmt(Number(p.value)) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ══ Summary Card ═══════════════════════════════════════════════ */
const ACCENTS: Record<string, { top: string; iconBg: string; iconColor: string; trendBg: string; trendColor: string }> = {
  amber:  { top: "#F59E0B", iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)", iconColor: "#D97706", trendBg: "#FFFBEB", trendColor: "#92400E" },
  red:    { top: "#EF4444", iconBg: "linear-gradient(145deg,#FFF5F5,#FEE2E2)", iconColor: "#DC2626", trendBg: "#FEF2F2", trendColor: "#991B1B" },
  green:  { top: "#10B981", iconBg: "linear-gradient(145deg,#F0FDF8,#DCFCE7)", iconColor: "#059669", trendBg: "#F0FDF4", trendColor: "#15803D" },
  purple: { top: "#8B5CF6", iconBg: "linear-gradient(145deg,#FAF5FF,#EDE9FE)", iconColor: "#7C3AED", trendBg: "#FAF5FF", trendColor: "#6D28D9" },
};
interface CardProps { label: string; value: string; accent: string; icon: React.ReactNode; trend?: string; sub?: string; }
function SummaryCard({ label, value, accent, icon, trend, sub }: CardProps) {
  const c = ACCENTS[accent] ?? ACCENTS.amber;
  return (
    <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06),0 1px 2px rgba(13,17,23,0.04)", padding: "22px 24px", borderTop: `3px solid ${c.top}`, position: "relative", overflow: "hidden", transition: "box-shadow 0.22s,transform 0.22s" }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 8px 24px rgba(13,17,23,0.09),0 2px 6px rgba(13,17,23,0.04)", transform: "translateY(-2px)" })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 2px 8px rgba(13,17,23,0.06),0 1px 2px rgba(13,17,23,0.04)", transform: "translateY(0)" })}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: c.iconColor, flexShrink: 0 }}>{icon}</div>
        {trend && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: c.trendBg, fontSize: "0.68rem", color: c.trendColor, fontWeight: 700, border: `1px solid ${c.top}30` }}>
            <ArrowUpRight size={10} />{trend}
          </div>
        )}
      </div>
      <div className="price" style={{ fontSize: "1.7rem", fontWeight: 800, color: "#0D1117", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: "0.82rem", color: "#6B7280", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 5 }}>{sub}</div>}
      <div style={{ position: "absolute", bottom: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${c.top}10`, pointerEvents: "none" }} />
    </div>
  );
}

/* ══ Chart section label ════════════════════════════════════════ */
function ChartLabel({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{  fontWeight: 700, fontSize: "0.95rem", color: "#0D1117" }}>{title}</div>
      <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

/* ══ Sale Detail Modal ══════════════════════════════════════════ */
function SaleDetailModal({
  id, onClose, isAdmin, onReturnSuccess,
}: {
  id: number;
  onClose: () => void;
  isAdmin: boolean;
  onReturnSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [data,        setData]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [showReturn,  setShowReturn]  = useState(false);

  const loadData = () => {
    setLoading(true);
    salesApi.getById(id)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReturnDone() {
    setShowReturn(false);
    loadData();          // refresh sale data
    onReturnSuccess();   // refresh parent list
  }

  const status = data ? getSaleStatusDisplay(data.payment_status, data.refund_status) : null;
  const canReturn = isAdmin && data && data.refund_status !== "full";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: showReturn ? 680 : 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(13,17,23,0.2)", transition: "max-width 0.2s" }}>

        {/* Header */}
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #F0F2F5", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0D1117" }}>
              {loading ? "ກຳລັງໂຫຼດ..." : showReturn ? `ຄືນສິນຄ້າ — ${data?.invoice_number}` : (data?.invoice_number ?? "ລາຍລະອຽດບິນ")}
            </div>
            {data && (
              <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 3 }}>
                {new Date(data.created_at).toLocaleDateString("lo-LA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {showReturn && (
              <button onClick={() => setShowReturn(false)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E5E9EF", background: "#F9FAFB", fontSize: "0.78rem", fontWeight: 600, color: "#6B7280", cursor: "pointer" }}>
                ← ກັບຄືນ
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 40 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #E5E9EF", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : !data ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>ບໍ່ພົບຂໍ້ມູນ</div>
        ) : showReturn ? (
          <ReturnForm
            sale={data}
            onDone={handleReturnDone}
            onCancel={() => setShowReturn(false)}
            showToast={showToast}
          />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>

            {/* Status row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <User size={11} /> ລູກຄ້າ
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0D1117" }}>{data.customer_name || "ລູກຄ້າທົ່ວໄປ"}</div>
              </div>
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>ວິທີຊຳລະ</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0D1117" }}>{PM_LABEL[data.payment_method] ?? data.payment_method}</div>
              </div>
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>ສະຖານະ</div>
                {status && (
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: status.bg, color: status.color, fontSize: "0.78rem", fontWeight: 700 }}>
                    {status.label}
                  </span>
                )}
              </div>
            </div>

            {/* Partial refund info */}
            {data.refund_status === "partial" && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.8rem", color: "#92400E" }}>
                <strong>ຍອດຄືນແລ້ວ: </strong>
                <span className="price">
                  {fmt((data.return_history ?? []).reduce((s: number, r: any) => s + Number(r.refund_amount), 0))}
                </span>
                {" "}• ຍັງເຫຼືອ:{" "}
                <span className="price" style={{ fontWeight: 700 }}>
                  {fmt(Number(data.total) - (data.return_history ?? []).reduce((s: number, r: any) => s + Number(r.refund_amount), 0))}
                </span>
              </div>
            )}

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ລາຍການສິນຄ້າ</div>
              <div style={{ border: "1px solid #F0F2F5", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={{ padding: "9px 14px", textAlign: "left",    color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ສິນຄ້າ</th>
                      <th style={{ padding: "9px 14px", textAlign: "center",  color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ຊື້</th>
                      <th style={{ padding: "9px 14px", textAlign: "center",  color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ຄືນແລ້ວ</th>
                      <th style={{ padding: "9px 14px", textAlign: "right",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ລວມ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((item: any, i: number) => {
                      const retQty = Number(item.returned_qty ?? 0);
                      const fullyReturned = retQty >= Number(item.quantity);
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #F0F2F5", opacity: fullyReturned ? 0.5 : 1 }}>
                          <td style={{ padding: "10px 14px", color: "#0D1117", fontWeight: 500 }}>
                            {item.product_name}
                            {item.sku && <span style={{ display: "block", fontSize: "0.66rem", color: "#9CA3AF" }}>{item.sku}</span>}
                            {fullyReturned && <span style={{ display: "inline-block", marginTop: 2, fontSize: "0.64rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 999, padding: "1px 7px" }}>ຄືນຄົບ</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#6B7280" }}>{item.quantity}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {retQty > 0
                              ? <span style={{ color: "#DC2626", fontWeight: 700 }}>{retQty}</span>
                              : <span style={{ color: "#C1C9D4" }}>—</span>}
                          </td>
                          <td className="price" style={{ padding: "10px 14px", textAlign: "right", color: "#0D1117", fontWeight: 700 }}>{fmt(Number(item.subtotal))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return history */}
            {(data.return_history ?? []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ປະຫວັດການຄືນ</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(data.return_history as any[]).map((r: any) => (
                    <div key={r.id} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: "0.8rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "#991B1B" }}>{r.product_name} × {r.quantity}</span>
                        <span className="price" style={{ color: "#DC2626", fontWeight: 700 }}>-{fmt(Number(r.refund_amount))}</span>
                      </div>
                      {r.reason && <div style={{ color: "#7F1D1D", fontSize: "0.74rem" }}>ເຫດຜົນ: {r.reason}</div>}
                      <div style={{ color: "#9CA3AF", fontSize: "0.7rem", marginTop: 3 }}>
                        ໂດຍ {r.returned_by_name} · {new Date(r.returned_at).toLocaleDateString("lo-LA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery */}
            {data.delivery && (
              <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12 }}>
                <Truck size={16} color="#0284C7" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0284C7", marginBottom: 4 }}>ຂໍ້ມູນການຈັດສົ່ງ</div>
                  <div style={{ fontSize: "0.8rem", color: "#0369A1" }}>{data.delivery.address}</div>
                  {data.delivery.driver_name && <div style={{ fontSize: "0.74rem", color: "#0369A1", marginTop: 2 }}>ຄົນຂັບ: {data.delivery.driver_name}</div>}
                  <div style={{ fontSize: "0.72rem", color: "#38BDF8", marginTop: 2 }}>ສະຖານະ: {data.delivery.status}</div>
                </div>
              </div>
            )}

            {/* Total + return button */}
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#92400E" }}>ຍອດລວມທັງໝົດ</span>
              <span className="price" style={{ fontSize: "1.3rem", fontWeight: 800, color: "#D97706" }}>{fmt(Number(data.total))}</span>
            </div>

            {canReturn && (
              <button
                onClick={() => setShowReturn(true)}
                style={{
                  width: "100%", marginTop: 14, padding: "11px", borderRadius: 10,
                  background: "linear-gradient(135deg,#FEF2F2,#FEE2E2)",
                  border: "1.5px solid #FECACA", color: "#DC2626",
                  fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                ↩ ຄືນສິນຄ້າ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ Return Form (inside detail modal) ═════════════════════════ */
type ReturnLineState = {
  selected:     boolean;
  qty:          number;
  reason:       string;
  max:          number;      // quantity - already returned
  unit_price:   number;
  sale_item_id: number;
  product_id:   number;
  product_name: string;
};

function ReturnForm({
  sale, onDone, onCancel, showToast,
}: {
  sale:      any;
  onDone:    () => void;
  onCancel:  () => void;
  showToast: (msg: string, type: "success"|"error"|"info") => void;
}) {
  const items: any[] = sale.items ?? [];

  const [lines, setLines] = useState<ReturnLineState[]>(() =>
    items.map((item: any) => {
      const max = Number(item.quantity) - Number(item.returned_qty ?? 0);
      return {
        selected:     false,
        qty:          max > 0 ? 1 : 0,
        reason:       "",
        max,
        unit_price:   Number(item.unit_price),
        sale_item_id: item.id,
        product_id:   item.product_id,
        product_name: item.product_name ?? "",
      };
    })
  );
  const [submitting, setSubmitting] = useState(false);

  function updateLine(i: number, patch: Partial<ReturnLineState>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function fillAll() {
    setLines(prev => prev.map(l =>
      l.max > 0 ? { ...l, selected: true, qty: l.max } : l
    ));
  }

  const selectedLines = lines.filter(l => l.selected && l.qty > 0);
  const totalRefund   = selectedLines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const allSelected   = lines.every(l => l.max === 0 || (l.selected && l.qty >= l.max));

  async function submit(isFullReturn: boolean) {
    if (isFullReturn) {
      // full return
      setSubmitting(true);
      try {
        await salesApi.return(sale.id, { type: "full" });
        showToast("ຄືນສິນຄ້າສຳເລັດ", "success");
        onDone();
      } catch (err: unknown) {
        const msg = (err as any)?.response?.data?.message ?? "ເກີດຂໍ້ຜິດພາດ";
        showToast(msg, "error");
      } finally { setSubmitting(false); }
      return;
    }

    if (selectedLines.length === 0) {
      showToast("ກະລຸນາເລືອກສິນຄ້າທີ່ຕ້ອງການຄືນ", "error");
      return;
    }
    setSubmitting(true);
    try {
      await salesApi.return(sale.id, {
        type: "partial",
        items: selectedLines.map(l => ({
          sale_item_id: l.sale_item_id,
          product_id:   l.product_id,
          quantity:     l.qty,
          reason:       l.reason || undefined,
        })),
      });
      showToast("ຄືນສິນຄ້າບາງສ່ວນສຳເລັດ", "success");
      onDone();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

      {/* Bill summary strip */}
      <div style={{ padding: "12px 28px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", display: "flex", gap: 24, fontSize: "0.78rem" }}>
        <span style={{ color: "#92400E" }}>ຍອດລວມ: <strong className="price">{fmt(Number(sale.total))}</strong></span>
        {(sale.return_history ?? []).length > 0 && (
          <span style={{ color: "#DC2626" }}>
            ຄືນແລ້ວ: <strong className="price">
              {fmt((sale.return_history as any[]).reduce((s: number, r: any) => s + Number(r.refund_amount), 0))}
            </strong>
          </span>
        )}
      </div>

      {/* Items table */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={{ padding: "8px 10px", width: 36 }}></th>
              <th style={{ padding: "8px 10px", textAlign: "left",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ສິນຄ້າ</th>
              <th style={{ padding: "8px 10px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ຊື້</th>
              <th style={{ padding: "8px 10px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ຄືນແລ້ວ</th>
              <th style={{ padding: "8px 10px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ຄືນຄັ້ງນີ້</th>
              <th style={{ padding: "8px 10px", textAlign: "right",  color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ເງິນຄືນ</th>
              <th style={{ padding: "8px 10px", textAlign: "left",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.7rem" }}>ເຫດຜົນ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const item = items[i];
              const disabled = l.max === 0;
              return (
                <tr key={i} style={{ borderTop: "1px solid #F5F7FA", opacity: disabled ? 0.45 : 1 }}>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <input type="checkbox"
                      checked={l.selected}
                      disabled={disabled}
                      onChange={e => updateLine(i, { selected: e.target.checked })}
                      style={{ width: 15, height: 15, accentColor: "#F59E0B", cursor: disabled ? "not-allowed" : "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px", color: "#0D1117", fontWeight: 500 }}>
                    {l.product_name}
                    {item?.sku && <span style={{ display: "block", fontSize: "0.64rem", color: "#9CA3AF" }}>{item.sku}</span>}
                    {disabled && <span style={{ display: "inline-block", fontSize: "0.63rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 999, padding: "1px 6px" }}>ຄືນຄົບ</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#6B7280" }}>{item?.quantity ?? 0}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {Number(item?.returned_qty ?? 0) > 0
                      ? <span style={{ color: "#DC2626", fontWeight: 700 }}>{item.returned_qty}</span>
                      : <span style={{ color: "#C1C9D4" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <input
                      type="number" min={1} max={l.max}
                      value={l.qty}
                      disabled={disabled || !l.selected}
                      onChange={e => {
                        const v = Math.max(1, Math.min(l.max, Number(e.target.value) || 1));
                        updateLine(i, { qty: v });
                      }}
                      style={{
                        width: 54, padding: "4px 6px", borderRadius: 6, textAlign: "center",
                        border: "1.5px solid #E5E9EF", fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace",
                        background: (!disabled && l.selected) ? "#fff" : "#F9FAFB",
                        color: (!disabled && l.selected) ? "#0D1117" : "#9CA3AF",
                        outline: "none",
                      }}
                    />
                  </td>
                  <td className="price" style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: l.selected ? "#DC2626" : "#C1C9D4" }}>
                    {l.selected ? fmt(l.qty * l.unit_price) : "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input
                      type="text"
                      placeholder="ເຫດຜົນ (ຖ້ານຕ້ອງການ)"
                      value={l.reason}
                      disabled={disabled || !l.selected}
                      onChange={e => updateLine(i, { reason: e.target.value })}
                      style={{
                        width: "100%", minWidth: 130,
                        padding: "4px 8px", borderRadius: 6,
                        border: "1.5px solid #E5E9EF", fontSize: "0.78rem",
                        background: (!disabled && l.selected) ? "#fff" : "#F9FAFB",
                        color: "#0D1117", outline: "none", fontFamily: "inherit",
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary + action buttons */}
      <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #F0F2F5", flexShrink: 0, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: "0.82rem", color: "#6B7280" }}>
            ຍອດຄືນທັງໝົດ:
          </span>
          <span className="price" style={{ fontSize: "1.2rem", fontWeight: 800, color: totalRefund > 0 ? "#DC2626" : "#C1C9D4" }}>
            {totalRefund > 0 ? `-${fmt(totalRefund)}` : "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} disabled={submitting}
            style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1.5px solid #E5E9EF", background: "#F9FAFB", color: "#6B7280", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            ຍົກເລີກ
          </button>
          {!allSelected && (
            <button onClick={fillAll} disabled={submitting}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1.5px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ✓ ຄືນທັງໝົດ
            </button>
          )}
          {allSelected ? (
            <button onClick={() => submit(true)} disabled={submitting}
              style={{ flex: 2, padding: "9px", borderRadius: 8, background: "linear-gradient(135deg,#DC2626,#B91C1C)", border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "ກຳລັງດຳເນີນການ..." : "↩ ຄືນທັງໝົດ"}
            </button>
          ) : (
            <button onClick={() => submit(false)} disabled={submitting || selectedLines.length === 0}
              style={{ flex: 2, padding: "9px", borderRadius: 8, background: selectedLines.length === 0 ? "#F3F4F6" : "linear-gradient(135deg,#EF4444,#DC2626)", border: "none", color: selectedLines.length === 0 ? "#9CA3AF" : "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: selectedLines.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "ກຳລັງດຳເນີນການ..." : `↩ ຄືນທີ່ເລືອກ (${selectedLines.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Export helpers ═════════════════════════════════════════════ */

/** Generic CSV download — BOM-prefixed so Excel opens Lao text correctly */
async function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  const Papa = (await import("papaparse")).default;
  const csv  = Papa.unparse(rows, { header: true });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF from a DOM element via html2canvas → jsPDF (A4, multi-page) */
async function snapshotToPDF(el: HTMLElement, filename: string) {
  // Temporarily hide export buttons so they don't appear in the PDF
  const btns = el.querySelectorAll<HTMLElement>("[data-noprint]");
  btns.forEach(b => { b.style.visibility = "hidden"; });

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#F4F6F9",
    logging: false,
  });

  btns.forEach(b => { b.style.visibility = ""; });

  const { default: jsPDF } = await import("jspdf");
  const pdf   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW  = pdf.internal.pageSize.getWidth();
  const pdfH  = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const imgW  = pdfW;
  const imgH  = pdfW / ratio;
  const imgData = canvas.toDataURL("image/png");

  if (imgH <= pdfH) {
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
  } else {
    let remaining = imgH;
    let offset    = 0;
    while (remaining > 0) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -offset, imgW, imgH);
      offset    += pdfH;
      remaining -= pdfH;
    }
  }

  pdf.save(filename);
}

/* ── Small reusable export button ──────────────────────────────── */
interface ExportBtnProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: "csv" | "pdf";
}
function ExportBtn({ label, icon, onClick, loading, variant = "csv" }: ExportBtnProps) {
  const colors = variant === "pdf"
    ? { bg: "#FFF1F2", border: "#FECDD3", color: "#BE123C", hBg: "#FFE4E6" }
    : { bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D", hBg: "#DCFCE7" };
  return (
    <button
      data-noprint
      disabled={loading}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 8, cursor: loading ? "wait" : "pointer",
        border: `1.5px solid ${colors.border}`,
        background: colors.bg, color: colors.color,
        fontSize: "0.74rem", fontWeight: 700, fontFamily: "inherit",
        transition: "all 0.15s", flexShrink: 0,
        opacity: loading ? 0.7 : 1,
      }}
      onMouseEnter={e => !loading && Object.assign((e.currentTarget as HTMLButtonElement).style, { background: colors.hBg })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: colors.bg })}
    >
      {loading ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : icon}
      {label}
    </button>
  );
}

/* ══ PAGE ═══════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "Admin";

  const [preset,      setPreset]      = useState<Preset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");

  const [daily,         setDaily]         = useState<DailyRow[]>([]);
  const [monthly,       setMonthly]       = useState<MonthlyRow[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary>({ total_income: 0, total_expense: 0, net_profit: 0 });
  const [topProducts,   setTopProducts]   = useState<TopProduct[]>([]);
  const [sales,         setSales]         = useState<SaleRow[]>([]);
  const [salesMeta,     setSalesMeta]     = useState<SaleMeta>({ total: 0, page: 1, totalPages: 1 });
  const [salesPage,     setSalesPage]     = useState(1);
  const [lowStock,      setLowStock]      = useState<LowStockRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [rangeLoading,  setRangeLoading]  = useState(false);
  const [detailId,      setDetailId]      = useState<number | null>(null);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [csvSales,      setCsvSales]      = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { start, end } = getRange(preset, customStart, customEnd);

  /* ── Fetch static data (not date-filtered) ── */
  useEffect(() => {
    Promise.all([
      reportsApi.lowStock(),
      reportsApi.monthly({ months: 6 }),
    ]).then(([lRes, mRes]) => {
      setLowStock(lRes.data.data || []);
      setMonthly(mRes.data.data  || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* ── Fetch date-filtered data ── */
  const fetchRange = useCallback(async (s: string, e: string, pg: number) => {
    setRangeLoading(true);
    try {
      const [iRes, dRes, tRes, sRes] = await Promise.all([
        reportsApi.incomeExpenses({ start_date: s, end_date: e }),
        reportsApi.daily({ start_date: s, end_date: e }),
        reportsApi.topProducts({ start_date: s, end_date: e, limit: 10 }),
        salesApi.getAll({ page: pg, limit: 10, start_date: s, end_date: e }),
      ]);
      setIncomeSummary(iRes.data.summary || { total_income: 0, total_expense: 0, net_profit: 0 });
      setDaily(dRes.data.data  || []);
      setTopProducts(tRes.data.data || []);
      setSales(sRes.data.data  || []);
      setSalesMeta(sRes.data.meta || { total: 0, page: 1, totalPages: 1 });
    } catch { /* silent */ }
    finally { setRangeLoading(false); }
  }, []);

  useEffect(() => {
    if (preset !== "custom" || (customStart && customEnd)) {
      fetchRange(start, end, salesPage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, salesPage]);

  function handlePreset(p: Preset) {
    if (p === "custom" && !customStart) {
      const today = new Date(), ago = new Date(today);
      ago.setDate(today.getDate() - 29);
      setCustomStart(toISO(ago));
      setCustomEnd(toISO(today));
    }
    setPreset(p);
    setSalesPage(1);
  }

  /* ── Export handlers ── */
  async function handleExportPDF() {
    if (!printRef.current) return;
    setPdfLoading(true);
    try {
      const dateStr = `${start}_${end}`.replace(/[^0-9-_]/g, "");
      await snapshotToPDF(printRef.current, `IT-Shop-Report-${dateStr}.pdf`);
    } finally { setPdfLoading(false); }
  }

  function handleExportLowStock() {
    const rows = lowStock.map(p => ({
      "ສິນຄ້າ": p.name,
      "SKU": p.sku,
      "ໝວດໝູ່": p.category_name ?? "",
      "ໃນສາງ": p.stock,
      "ລະດັບຕ່ຳ": p.min_stock,
      "ຂາດ": p.min_stock - p.stock,
    }));
    downloadCSV(rows, `LowStock-${start}.csv`);
  }

  function handleExportTopProducts() {
    const rows = topProducts.map((p, i) => ({
      "ອັນດັບ": i + 1,
      "ສິນຄ້າ": p.name,
      "SKU": p.sku,
      "ໝວດໝູ່": p.category_name ?? "",
      "ຈຳນວນຂາຍ": Number(p.total_quantity),
      "ຍອດເງິນ (₭)": Number(p.total_revenue),
      "ຈຳນວນໃບບິນ": p.sale_count,
    }));
    downloadCSV(rows, `TopProducts-${start}_${end}.csv`);
  }

  async function handleExportAllSales() {
    setCsvSales(true);
    try {
      // Fetch all pages for the selected range
      const res = await salesApi.getAll({ page: 1, limit: 1000, start_date: start, end_date: end });
      const allSales: SaleRow[] = res.data.data ?? [];
      const rows = allSales.map(s => ({
        "ເລກບິນ": s.invoice_number,
        "ວັນທີ": new Date(s.created_at).toLocaleDateString("en-GB"),
        "ລູກຄ້າ": s.customer_name ?? "ລູກຄ້າທົ່ວໄປ",
        "ຍອດເງິນ (₭)": Number(s.total),
        "ວິທີຊຳລະ": PM_LABEL[s.payment_method] ?? s.payment_method,
        "ສະຖານະ": PS_COLOR[s.payment_status]?.label ?? s.payment_status,
      }));
      downloadCSV(rows, `Sales-${start}_${end}.csv`);
    } finally { setCsvSales(false); }
  }

  /* ── Derived chart data ── */
  const dailyChart = daily.map(d => ({
    date: d.date ? new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "",
    revenue: d.total_revenue, orders: d.total_sales,
  }));
  const monthlyChart = monthly.map(m => ({
    month: m.month ? new Date(m.month + "-01").toLocaleDateString("lo-LA", { month: "short" }) : m.month,
    revenue: m.total_revenue, orders: m.total_sales,
  }));
  const pieData   = [
    { name: "ລາຍຮັບ",   value: incomeSummary.total_income  },
    { name: "ລາຍຈ່າຍ", value: incomeSummary.total_expense },
  ];
  const PIE_COLORS = ["#F59E0B", "#EF4444"];

  if (loading) return (
    <>
      <Header title="ລາຍງານ" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #E5E9EF", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>ກຳລັງໂຫຼດ...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    </>
  );

  return (
    <>
      <Header title="ລາຍງານ" subtitle="ສະຖິຕິ ແລະ ການວິເຄາະທຸລະກິດ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 48px", overflowY: "auto" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>ການວິເຄາະ</p>
            <h2 style={{  fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>ລາຍງານ & ສະຖິຕິ</h2>
          </div>
          <ExportBtn
            label="ສົ່ງອອກ PDF"
            icon={<FileDown size={13} />}
            onClick={handleExportPDF}
            loading={pdfLoading}
            variant="pdf"
          />
        </div>

        {/* ── Date range filter ── */}
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: "0.75rem", fontWeight: 600 }}>
              <Calendar size={13} /> ຊ່ວງເວລາ:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {(["today", "week", "month", "3months", "custom"] as Preset[]).map(p => {
                const active = preset === p;
                return (
                  <button key={p} onClick={() => handlePreset(p)} style={{
                    padding: "6px 14px", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600,
                    cursor: "pointer", border: active ? "1.5px solid #FCD34D" : "1.5px solid transparent",
                    background: active ? "#FEF3C7" : "#F3F4F6",
                    color: active ? "#D97706" : "#6B7280",
                    boxShadow: active ? "0 0 0 3px rgba(251,191,36,0.15)" : "none",
                    transition: "all 0.15s",
                  }}>
                    {PRESET_LABELS[p]}
                  </button>
                );
              })}
            </div>

            {rangeLoading && (
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #E5E9EF", borderTopColor: "#F59E0B", animation: "spin 0.7s linear infinite" }} />
            )}
          </div>

          {preset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: "0.78rem", color: "#9CA3AF", fontWeight: 600 }}>ຕັ້ງແຕ່:</span>
              <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setSalesPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E9EF", fontSize: "0.82rem", color: "#0D1117", outline: "none" }} />
              <span style={{ fontSize: "0.78rem", color: "#9CA3AF", fontWeight: 600 }}>ຮອດ:</span>
              <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setSalesPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E9EF", fontSize: "0.82rem", color: "#0D1117", outline: "none" }} />
            </div>
          )}
        </div>

        {/* ══ PDF-capturable section ══════════════════════════════ */}
        <div ref={printRef} style={{ background: "#F4F6F9" }}>

        {/* ── Summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          <SummaryCard label="ລາຍໄດ້ທັງໝົດ"  value={fmt(incomeSummary.total_income)}  accent="amber"  icon={<DollarSign size={18}/>}   trend="+ລາຍຮັບ" />
          <SummaryCard label="ລາຍຈ່າຍທັງໝົດ" value={fmt(incomeSummary.total_expense)} accent="red"    icon={<TrendingUp size={18}/>}  sub="ຄ່າໃຊ້ຈ່າຍ" />
          <SummaryCard label="ກຳໄລສຸດທິ"      value={fmt(incomeSummary.net_profit)}   accent={incomeSummary.net_profit >= 0 ? "green" : "red"} icon={<ShoppingCart size={18}/>} trend={incomeSummary.net_profit >= 0 ? "+ກຳໄລ" : undefined} />
          <SummaryCard label="ສິນຄ້າໃກ້ໝົດ"   value={`${lowStock.length}`}            accent="purple" icon={<Package size={18}/>}     sub="ລາຍການ" />
        </div>

        {/* ── Row 1: charts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Daily line */}
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "24px 28px" }}>
            <ChartLabel title="ລາຍໄດ້ຕາມວັນ" sub={`${start} → ${end}`} />
            {dailyChart.length === 0 ? (
              <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: "#D1D5DB", fontSize: "0.82rem" }}>ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້</div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F2F5" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} width={42} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "#F59E0B", strokeWidth: 1, strokeDasharray: "4 3" }} />
                  <Line type="monotone" dataKey="revenue" name="revenue" stroke="#F59E0B" strokeWidth={2.5} dot={false} activeDot={{ fill: "#fff", r: 5, stroke: "#F59E0B", strokeWidth: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 6-month bar (always trend) */}
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "24px 28px" }}>
            <ChartLabel title="ແນວໂນ້ມ 6 ເດືອນ" sub="ຍອດຂາຍລວມລາຍເດືອນ" />
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={monthlyChart} barSize={28}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F0F2F5" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} width={42} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(245,158,11,0.05)" }} />
                <Bar dataKey="revenue" name="revenue" fill="#F59E0B" radius={[5, 5, 0, 0]} opacity={0.88} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Row 2: Pie + Low stock ── */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, marginBottom: 20 }}>
          {/* Pie */}
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "24px 28px" }}>
            <ChartLabel title="ລາຍຮັບ vs ລາຍຈ່າຍ" sub="ສັດສ່ວນໃນຊ່ວງທີ່ເລືອກ" />
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend formatter={v => <span style={{ color: "#6B7280", fontSize: "0.78rem" }}>{v}</span>} />
                <Tooltip formatter={v => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {pieData.map((d, i) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#6B7280" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i] }} />{d.name}
                  </div>
                  <span className="price" style={{ color: PIE_COLORS[i], fontWeight: 700, fontSize: "0.82rem" }}>{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Low stock table */}
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(145deg,#FFF5F5,#FEE2E2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", flexShrink: 0 }}>
                  <AlertTriangle size={14} />
                </div>
                <div>
                  <div style={{  fontWeight: 700, fontSize: "0.9rem", color: "#0D1117" }}>ສິນຄ້າໃກ້ໝົດສາງ</div>
                  <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 2 }}>ຕ່ຳກວ່າລະດັບຕ່ຳສຸດທີ່ກຳນົດ</div>
                </div>
              </div>
              {lowStock.length > 0 && (
                <ExportBtn label="ສົ່ງອອກ CSV" icon={<Download size={12} />} onClick={handleExportLowStock} />
              )}
            </div>
            {lowStock.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>✅</div>
                <div style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>ທຸກສິນຄ້າຢູ່ໃນລະດັບປົກກະຕິ</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ສິນຄ້າ</th><th>ໝວດໝູ່</th>
                    <th style={{ textAlign: "center" }}>ໃນສາງ</th>
                    <th style={{ textAlign: "center" }}>ລະດັບຕ່ຳ</th>
                    <th style={{ textAlign: "center" }}>ຂາດ</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="text-prim">{p.name}</div>
                        {p.sku && <div style={{ fontSize: "0.66rem", color: "#9CA3AF" }}>{p.sku}</div>}
                      </td>
                      <td><span style={{ background: "#F8FAFC", border: "1px solid #E5E9EF", borderRadius: 5, padding: "2px 8px", fontSize: "0.74rem", color: "#6B7280" }}>{p.category_name || "—"}</span></td>
                      <td style={{ textAlign: "center" }}><span className="price" style={{ color: "#EF4444", fontWeight: 700 }}>{p.stock}</span></td>
                      <td style={{ textAlign: "center" }}><span className="price" style={{ color: "#9CA3AF" }}>{p.min_stock}</span></td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, padding: "2px 7px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 999, fontSize: "0.72rem", color: "#DC2626", fontWeight: 700 }}>
                          {p.min_stock - p.stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Top Selling Products ── */}
        <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(145deg,#FEF9EC,#FEF3C7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", flexShrink: 0 }}>
                <Trophy size={14} />
              </div>
              <div>
                <div style={{  fontWeight: 700, fontSize: "0.9rem", color: "#0D1117" }}>ສິນຄ້າຂາຍດີ Top 10</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 2 }}>ສິນຄ້າທີ່ຂາຍໄດ້ຫຼາຍທີ່ສຸດໃນຊ່ວງທີ່ເລືອກ</div>
              </div>
            </div>
            {topProducts.length > 0 && (
              <ExportBtn label="ສົ່ງອອກ CSV" icon={<Download size={12} />} onClick={handleExportTopProducts} />
            )}
          </div>
          {topProducts.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>📦</div>
              <div style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>ບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງນີ້</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "center", width: 48 }}>ອັນດັບ</th>
                  <th>ສິນຄ້າ</th>
                  <th>ໝວດໝູ່</th>
                  <th style={{ textAlign: "center" }}>ຈຳນວນຂາຍ</th>
                  <th style={{ textAlign: "right" }}>ຍອດເງິນ</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center" }}>
                      {idx < 3 ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 26, height: 26, borderRadius: "50%", fontSize: "0.75rem", fontWeight: 800,
                          background: idx === 0 ? "linear-gradient(145deg,#FEF3C7,#FDE68A)" : idx === 1 ? "linear-gradient(145deg,#F3F4F6,#E5E7EB)" : "linear-gradient(145deg,#FEF3E7,#FDE8D8)",
                          color: idx === 0 ? "#D97706" : idx === 1 ? "#6B7280" : "#C2410C",
                          border: idx === 0 ? "1.5px solid #FCD34D" : idx === 1 ? "1.5px solid #D1D5DB" : "1.5px solid #FDBA74",
                        }}>
                          {idx + 1}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "#9CA3AF", fontWeight: 600 }}>{idx + 1}</span>
                      )}
                    </td>
                    <td>
                      <div className="text-prim">{p.name}</div>
                      {p.sku && <div style={{ fontSize: "0.66rem", color: "#9CA3AF" }}>{p.sku}</div>}
                    </td>
                    <td><span style={{ background: "#F8FAFC", border: "1px solid #E5E9EF", borderRadius: 5, padding: "2px 8px", fontSize: "0.74rem", color: "#6B7280" }}>{p.category_name || "—"}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 999, padding: "2px 10px", fontSize: "0.78rem", fontWeight: 700, color: "#D97706" }}>
                        {Number(p.total_quantity).toLocaleString()} ຫົວ
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="price" style={{ fontWeight: 700, color: "#059669", fontSize: "0.88rem" }}>{fmt(Number(p.total_revenue))}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Close PDF capture region ── */}
        </div>

        {/* ── Sales History ── */}
        <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", flexShrink: 0 }}>
                <Receipt size={14} />
              </div>
              <div>
                <div style={{  fontWeight: 700, fontSize: "0.9rem", color: "#0D1117" }}>ປະຫວັດການຂາຍ</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 2 }}>
                  {salesMeta.total > 0 ? `${salesMeta.total} ລາຍການ • ຄລິກເພື່ອເບິ່ງລາຍລະອຽດ` : "ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້"}
                </div>
              </div>
            </div>

            {/* Pagination + CSV export */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ExportBtn label="ສົ່ງອອກ CSV" icon={<Download size={12} />} onClick={handleExportAllSales} loading={csvSales} />
              {salesMeta.totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.76rem", color: "#9CA3AF" }}>
                    ໜ້າ {salesMeta.page} / {salesMeta.totalPages}
                  </span>
                  <button
                    disabled={salesPage <= 1 || rangeLoading}
                    onClick={() => setSalesPage(p => p - 1)}
                    style={{ width: 28, height: 28, borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: salesPage <= 1 ? "not-allowed" : "pointer", color: salesPage <= 1 ? "#D1D5DB" : "#6B7280", opacity: salesPage <= 1 ? 0.5 : 1 }}>
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    disabled={salesPage >= salesMeta.totalPages || rangeLoading}
                    onClick={() => setSalesPage(p => p + 1)}
                    style={{ width: 28, height: 28, borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: salesPage >= salesMeta.totalPages ? "not-allowed" : "pointer", color: salesPage >= salesMeta.totalPages ? "#D1D5DB" : "#6B7280", opacity: salesPage >= salesMeta.totalPages ? 0.5 : 1 }}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {sales.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>🧾</div>
              <div style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>ບໍ່ມີລາຍການຂາຍໃນຊ່ວງນີ້</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ເລກບິນ</th>
                  <th>ວັນທີ</th>
                  <th>ລູກຄ້າ</th>
                  <th style={{ textAlign: "right" }}>ຍອດເງິນ</th>
                  <th style={{ textAlign: "center" }}>ວິທີຊຳລະ</th>
                  <th style={{ textAlign: "center" }}>ສະຖານະ</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const ps = getSaleStatusDisplay(s.payment_status, s.refund_status);
                  return (
                    <tr key={s.id} onClick={() => setDetailId(s.id)} style={{ cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "#FAFBFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                    >
                      <td>
                        <span className="price" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2563EB" }}>{s.invoice_number}</span>
                      </td>
                      <td style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                        {new Date(s.created_at).toLocaleDateString("lo-LA", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="text-prim">{s.customer_name || <span style={{ color: "#C1C9D4", fontStyle: "italic" }}>ລູກຄ້າທົ່ວໄປ</span>}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="price" style={{ fontWeight: 700, color: "#0D1117" }}>{fmt(Number(s.total))}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#F3F4F6", border: "1px solid #E5E9EF", borderRadius: 5, padding: "2px 9px", fontSize: "0.74rem", color: "#6B7280", fontWeight: 600 }}>
                          {PM_LABEL[s.payment_method] ?? s.payment_method}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: ps.bg, color: ps.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", fontWeight: 700 }}>
                          {ps.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Bottom pagination */}
          {salesMeta.totalPages > 1 && (
            <div style={{ padding: "14px 28px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.76rem", color: "#9CA3AF" }}>
                ສະແດງ {((salesPage - 1) * 10) + 1}–{Math.min(salesPage * 10, salesMeta.total)} ຈາກ {salesMeta.total} ລາຍການ
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button disabled={salesPage <= 1 || rangeLoading} onClick={() => setSalesPage(p => p - 1)}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", fontSize: "0.78rem", fontWeight: 600, color: "#6B7280", cursor: salesPage <= 1 ? "not-allowed" : "pointer", opacity: salesPage <= 1 ? 0.5 : 1 }}>
                  ← ກ່ອນ
                </button>
                {(() => {
                  const total = salesMeta.totalPages;
                  const count = Math.min(5, total);
                  const start = Math.max(1, Math.min(salesPage - 2, total - count + 1));
                  return Array.from({ length: count }, (_, i) => start + i).map(pg => (
                    <button key={pg} onClick={() => setSalesPage(pg)}
                      style={{ width: 30, height: 30, borderRadius: 7, border: pg === salesPage ? "1.5px solid #FCD34D" : "1.5px solid #E5E9EF", background: pg === salesPage ? "#FEF3C7" : "#F9FAFB", fontSize: "0.78rem", fontWeight: 700, color: pg === salesPage ? "#D97706" : "#6B7280", cursor: "pointer" }}>
                      {pg}
                    </button>
                  ));
                })()}
                <button disabled={salesPage >= salesMeta.totalPages || rangeLoading} onClick={() => setSalesPage(p => p + 1)}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", fontSize: "0.78rem", fontWeight: 600, color: "#6B7280", cursor: salesPage >= salesMeta.totalPages ? "not-allowed" : "pointer", opacity: salesPage >= salesMeta.totalPages ? 0.5 : 1 }}>
                  ຕໍ່ →
                </button>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ── Sale detail modal ── */}
      {detailId !== null && (
        <SaleDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          isAdmin={isAdmin}
          onReturnSuccess={() => fetchRange(start, end, salesPage)}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </>
  );
}
