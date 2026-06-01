"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Calendar, ChevronLeft, ChevronRight, X,
  Receipt, User, Truck, RotateCcw, Eye, Loader2,
  AlertTriangle, CheckCircle2, XCircle, Clock, Package, Printer,
} from "lucide-react";
import Header from "@/components/Header";
import { salesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import ReceiptModal, { ReceiptData, printReceipt } from "@/components/ReceiptModal";

/* ══ Types ══════════════════════════════════════════════════════ */
type RefundStatus  = "none" | "partial" | "full";
type PaymentStatus = "paid"  | "pending" | "refunded";
type Preset        = "today" | "week" | "month" | "3months" | "all" | "custom";

interface SaleRow {
  id: number;
  invoice_number: string;
  total: number;
  subtotal: number;
  payment_method: string;
  payment_status: PaymentStatus;
  refund_status:  RefundStatus;
  customer_id:    number | null;
  customer_name:  string | null;
  user_name:      string | null;
  notes:          string | null;
  created_at:     string;
}

interface SaleItemDetail {
  id:           number;
  sale_id:      number;
  product_id:   number;
  product_name: string;
  sku:          string;
  quantity:     number;
  unit_price:   number;
  subtotal:     number;
  returned_qty: number;
}

interface ReturnHistoryItem {
  id:                number;
  product_name:      string;
  quantity:          number;
  refund_amount:     number;
  reason:            string | null;
  returned_by_name:  string;
  returned_at:       string;
}

interface SaleDetail extends SaleRow {
  items:          SaleItemDetail[];
  return_history: ReturnHistoryItem[];
  delivery: {
    id:            number;
    address:       string;
    status:        string;
    driver_name:   string | null;
    delivery_date: string | null;
  } | null;
}

interface ReturnLineState {
  selected:     boolean;
  qty:          number;
  reason:       string;
  max:          number;
  unit_price:   number;
  sale_item_id: number;
  product_id:   number;
  product_name: string;
}

interface SaleMeta {
  total:      number;
  page:       number;
  totalPages: number;
}

/* ══ Constants ══════════════════════════════════════════════════ */
const PM_LABEL: Record<string, string> = { cash: "ເງິນສົດ", transfer: "ໂອນ", card: "ບັດ" };

const PRESET_LABELS: Record<Preset, string> = {
  today: "ວັນນີ້", week: "ອາທິດນີ້", month: "ເດືອນນີ້",
  "3months": "3 ເດືອນ", all: "ທັງໝົດ", custom: "ກຳນົດເອງ",
};

/* ══ Helpers ════════════════════════════════════════════════════ */
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₭`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K ₭`;
  return `${n.toLocaleString()} ₭`;
}
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(preset: Preset, cStart: string, cEnd: string) {
  const today = new Date(), now = toISO(today);
  if (preset === "today")    return { start: now, end: now };
  if (preset === "week") {
    const d = today.getDay(), mon = new Date(today);
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
  if (preset === "all") return { start: "", end: "" };
  return { start: cStart || now, end: cEnd || now };
}

/** Convert a SaleDetail (from getById) into ReceiptData for printing */
function saleToReceiptData(sale: SaleDetail): ReceiptData {
  return {
    invoice_number:   sale.invoice_number,
    sale_id:          sale.id,
    created_at:       sale.created_at,
    customer_name:    sale.customer_name ?? null,
    user_name:        sale.user_name     ?? null,
    payment_method:   sale.payment_method as "cash" | "transfer" | "card",
    items: (sale.items ?? []).map(item => ({
      product_name: item.product_name,
      sku:          item.sku ?? null,
      quantity:     Number(item.quantity),
      unit_price:   Number(item.unit_price),
      subtotal:     Number(item.subtotal),
    })),
    total:            Number(sale.total),
    has_delivery:     !!sale.delivery,
    delivery_address: sale.delivery?.address ?? null,
  };
}

function getSaleStatus(paymentStatus: string, refundStatus: RefundStatus) {
  if (refundStatus === "full"    || paymentStatus === "refunded")
    return { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "ຄືນແລ້ວ",    dot: "#DC2626" };
  if (refundStatus === "partial")
    return { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "ຄືນບາງສ່ວນ", dot: "#F59E0B" };
  if (paymentStatus === "pending")
    return { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA", label: "ລໍຖ້າ",      dot: "#F97316" };
  return   { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "ສຳເລັດ",     dot: "#10B981" };
}

/* ══ Status Badge ═══════════════════════════════════════════════ */
function StatusBadge({ paymentStatus, refundStatus }: {
  paymentStatus: string;
  refundStatus:  RefundStatus;
}) {
  const s = getSaleStatus(paymentStatus, refundStatus);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: "0.74rem", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

/* ══ Sale Detail Modal ══════════════════════════════════════════ */
function SaleDetailModal({
  saleId, onClose, isAdmin, onReturnClick,
}: {
  saleId:          number;
  onClose:         () => void;
  isAdmin:         boolean;
  onReturnClick:   (sale: SaleDetail) => void;
}) {
  const [data,    setData]              = useState<SaleDetail | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    salesApi.getById(saleId)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [saleId]);

  const status   = data ? getSaleStatus(data.payment_status, data.refund_status) : null;
  const canReturn = isAdmin && data && data.refund_status !== "full" && data.payment_status !== "refunded";

  const alreadyRefunded = data
    ? (data.return_history ?? []).reduce((s, r) => s + Number(r.refund_amount), 0)
    : 0;

  return (
    <>
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.5)", zIndex: 9000,
               display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(13,17,23,0.22)",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #F0F2F5",
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0D1117" }}>
              {loading ? "ກຳລັງໂຫຼດ..." : (data?.invoice_number ?? "ລາຍລະອຽດບິນ")}
            </div>
            {data && (
              <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 3 }}>
                {new Date(data.created_at).toLocaleDateString("lo-LA", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Print button — visible once data is loaded */}
            {data && (
              <button
                onClick={() => setShowReceiptModal(true)}
                title="ພິມໃບບິນ"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8,
                  border: "1.5px solid #BFDBFE", background: "#EFF6FF",
                  color: "#2563EB", fontSize: "0.76rem", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Printer size={13} /> ພິມ
              </button>
            )}
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: 9, border: "1px solid #E5E9EF",
              background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#9CA3AF",
            }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", border: "2.5px solid #F0F2F5", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>ກຳລັງໂຫຼດ...</div>
          </div>
        ) : !data ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>ບໍ່ພົບຂໍ້ມູນ</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                { label: "ລູກຄ້າ", value: data.customer_name || "ລູກຄ້າທົ່ວໄປ", icon: <User size={11} /> },
                { label: "ວິທີຊຳລະ", value: PM_LABEL[data.payment_method] ?? data.payment_method, icon: <Receipt size={11} /> },
                { label: "ຜູ້ຂາຍ", value: data.user_name || "—", icon: <User size={11} /> },
              ].map(c => (
                <div key={c.label} style={{ background: "#F9FAFB", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#9CA3AF", fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                    {c.icon}{c.label}
                  </div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0D1117" }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Status + partial refund notice */}
            {status && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <StatusBadge paymentStatus={data.payment_status} refundStatus={data.refund_status} />
                {data.refund_status === "partial" && alreadyRefunded > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#D97706" }}>
                    ຄືນແລ້ວ <strong className="price">{fmt(alreadyRefunded)}</strong>
                    {" "}• ຍັງເຫຼືອ <strong className="price">{fmt(Number(data.total) - alreadyRefunded)}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Items table */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                ລາຍການສິນຄ້າ
              </div>
              <div style={{ border: "1px solid #F0F2F5", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={{ padding: "9px 14px", textAlign: "left",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ສິນຄ້າ</th>
                      <th style={{ padding: "9px 14px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ຊື້</th>
                      <th style={{ padding: "9px 14px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ຄືນ</th>
                      <th style={{ padding: "9px 14px", textAlign: "right",  color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ລວມ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((item, i) => {
                      const retQty    = Number(item.returned_qty ?? 0);
                      const fullyRet  = retQty >= Number(item.quantity);
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #F5F7FA", opacity: fullyRet ? 0.55 : 1 }}>
                          <td style={{ padding: "10px 14px", color: "#0D1117", fontWeight: 500 }}>
                            {item.product_name}
                            {item.sku && <span style={{ display: "block", fontSize: "0.65rem", color: "#9CA3AF" }}>{item.sku}</span>}
                            {fullyRet && (
                              <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.63rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 999, padding: "1px 7px" }}>
                                ຄືນຄົບ
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#6B7280" }}>{item.quantity}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {retQty > 0
                              ? <span style={{ color: "#DC2626", fontWeight: 700 }}>{retQty}</span>
                              : <span style={{ color: "#C1C9D4" }}>—</span>}
                          </td>
                          <td className="price" style={{ padding: "10px 14px", textAlign: "right", color: "#0D1117", fontWeight: 700 }}>
                            {fmt(Number(item.subtotal))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return history */}
            {(data.return_history ?? []).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  ປະຫວັດການຄືນ
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.return_history.map(r => (
                    <div key={r.id} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#991B1B" }}>
                          {r.product_name} × {r.quantity}
                        </span>
                        <span className="price" style={{ fontSize: "0.82rem", color: "#DC2626", fontWeight: 700 }}>
                          -{fmt(Number(r.refund_amount))}
                        </span>
                      </div>
                      {r.reason && <div style={{ fontSize: "0.74rem", color: "#7F1D1D" }}>ເຫດຜົນ: {r.reason}</div>}
                      <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 3 }}>
                        ໂດຍ {r.returned_by_name} · {new Date(r.returned_at).toLocaleDateString("lo-LA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery */}
            {data.delivery && (
              <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 12 }}>
                <Truck size={16} color="#0284C7" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0284C7", marginBottom: 4 }}>ຂໍ້ມູນການຈັດສົ່ງ</div>
                  <div style={{ fontSize: "0.8rem", color: "#0369A1" }}>{data.delivery.address}</div>
                  {data.delivery.driver_name && <div style={{ fontSize: "0.74rem", color: "#0369A1", marginTop: 2 }}>ຄົນຂັບ: {data.delivery.driver_name}</div>}
                  <div style={{ fontSize: "0.72rem", color: "#38BDF8", marginTop: 2 }}>ສະຖານະ: {data.delivery.status}</div>
                </div>
              </div>
            )}

            {/* Total */}
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: canReturn ? 14 : 0 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#92400E" }}>ຍອດລວມທັງໝົດ</span>
              <span className="price" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#D97706" }}>{fmt(Number(data.total))}</span>
            </div>

            {/* Return button */}
            {canReturn && (
              <button
                onClick={() => onReturnClick(data)}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
                  background: "linear-gradient(135deg,#FEF2F2,#FEE2E2)",
                  border: "1.5px solid #FECACA", color: "#DC2626",
                  fontSize: "0.9rem", fontWeight: 700, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#FEE2E2", transform: "translateY(-1px)" })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "linear-gradient(135deg,#FEF2F2,#FEE2E2)", transform: "translateY(0)" })}
              >
                <RotateCcw size={15} />
                {data.refund_status === "partial" ? "ຄືນເພີ່ມ" : "ຄືນສິນຄ້າ"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Receipt preview modal (nested, higher z-index) ── */}
    {showReceiptModal && data && (
      <ReceiptModal
        data={saleToReceiptData(data)}
        onClose={() => setShowReceiptModal(false)}
      />
    )}
    </>
  );
}

/* ══ Return Modal ════════════════════════════════════════════════ */
function ReturnModal({
  sale, onClose, onSuccess,
}: {
  sale:      SaleDetail;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();

  const [lines, setLines] = useState<ReturnLineState[]>(() =>
    (sale.items ?? []).map(item => {
      const max = Number(item.quantity) - Number(item.returned_qty ?? 0);
      return {
        selected: false, qty: max > 0 ? 1 : 0, reason: "",
        max, unit_price: Number(item.unit_price),
        sale_item_id: item.id, product_id: item.product_id,
        product_name: item.product_name ?? "",
      };
    })
  );

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  function updateLine(i: number, patch: Partial<ReturnLineState>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function fillAll() {
    setLines(prev => prev.map(l => l.max > 0 ? { ...l, selected: true, qty: l.max } : l));
  }

  const selectedLines  = lines.filter(l => l.selected && l.qty > 0 && l.max > 0);
  const totalRefund    = selectedLines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const allRemaining   = lines.filter(l => l.max > 0);
  const allSelected    = allRemaining.length > 0 && allRemaining.every(l => l.selected && l.qty >= l.max);

  const alreadyRefunded = (sale.return_history ?? []).reduce((s, r) => s + Number(r.refund_amount), 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      if (allSelected) {
        await salesApi.return(sale.id, { type: "full" });
      } else {
        await salesApi.return(sale.id, {
          type: "partial",
          items: selectedLines.map(l => ({
            sale_item_id: l.sale_item_id,
            product_id:   l.product_id,
            quantity:     l.qty,
            reason:       l.reason || undefined,
          })),
        });
      }
      showToast(allSelected ? "ຄືນສິນຄ້າທັງໝົດສຳເລັດ" : "ຄືນສິນຄ້າບາງສ່ວນສຳເລັດ", "success");
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      {/* Return Modal */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.55)", zIndex: 9100,
                 display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget && !showConfirm) onClose(); }}
      >
        <div style={{
          background: "#fff", borderRadius: 20, width: "100%", maxWidth: 700,
          maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 32px 80px rgba(13,17,23,0.25)",
        }}>

          {/* Header */}
          <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #F0F2F5", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(145deg,#FEF2F2,#FEE2E2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", flexShrink: 0 }}>
                    <RotateCcw size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.02rem", color: "#0D1117" }}>ຄືນສິນຄ້າ</div>
                    <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 1 }}>
                      ບິນ {sale.invoice_number} · {new Date(sale.created_at).toLocaleDateString("lo-LA", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9CA3AF", flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            {/* Bill summary strip */}
            <div style={{ display: "flex", gap: 20, marginTop: 14, padding: "11px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: "0.78rem" }}>
              <span style={{ color: "#92400E" }}>ລູກຄ້າ: <strong>{sale.customer_name || "ລູກຄ້າທົ່ວໄປ"}</strong></span>
              <span style={{ color: "#92400E" }}>ຍອດທັງໝົດ: <strong className="price">{fmt(Number(sale.total))}</strong></span>
              {alreadyRefunded > 0 && (
                <span style={{ color: "#DC2626" }}>ຄືນໄປແລ້ວ: <strong className="price">{fmt(alreadyRefunded)}</strong></span>
              )}
            </div>
          </div>

          {/* Items table */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                ເລືອກລາຍການທີ່ຕ້ອງການຄືນ
              </div>
              {!allSelected && allRemaining.length > 0 && (
                <button onClick={fillAll} style={{
                  padding: "5px 12px", borderRadius: 7, border: "1.5px solid #FDE68A",
                  background: "#FFFBEB", color: "#92400E", fontSize: "0.74rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  ✓ ຄືນທຸກຊິ້ນ
                </button>
              )}
            </div>

            <div style={{ border: "1px solid #F0F2F5", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: "9px 12px", width: 40 }} />
                    <th style={{ padding: "9px 12px", textAlign: "left",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ສິນຄ້າ</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ລາຄາ/ໜ່ວຍ</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ຊື້</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ຄືນໄປ</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ຄືນຄັ້ງນີ້</th>
                    <th style={{ padding: "9px 12px", textAlign: "right",  color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ເງິນຄືນ</th>
                    <th style={{ padding: "9px 12px", textAlign: "left",   color: "#9CA3AF", fontWeight: 600, fontSize: "0.68rem" }}>ເຫດຜົນ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const item     = sale.items[i];
                    const disabled = l.max === 0;
                    return (
                      <tr key={i} style={{ borderTop: "1px solid #F5F7FA", opacity: disabled ? 0.42 : 1, background: l.selected && !disabled ? "#FFFCF5" : "transparent", transition: "background 0.12s" }}>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={l.selected}
                            disabled={disabled}
                            onChange={e => updateLine(i, { selected: e.target.checked })}
                            style={{ width: 16, height: 16, accentColor: "#F59E0B", cursor: disabled ? "not-allowed" : "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "9px 12px", color: "#0D1117", fontWeight: 500 }}>
                          {l.product_name}
                          {item?.sku && <span style={{ display: "block", fontSize: "0.63rem", color: "#9CA3AF" }}>{item.sku}</span>}
                          {disabled && (
                            <span style={{ display: "inline-block", marginTop: 2, fontSize: "0.62rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 999, padding: "1px 6px" }}>ຄືນຄົບ</span>
                          )}
                        </td>
                        <td className="price" style={{ padding: "9px 12px", textAlign: "center", color: "#6B7280", fontSize: "0.8rem" }}>
                          {fmt(l.unit_price)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: "#6B7280" }}>
                          {item?.quantity ?? 0}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          {Number(item?.returned_qty ?? 0) > 0
                            ? <span style={{ color: "#DC2626", fontWeight: 700 }}>{item.returned_qty}</span>
                            : <span style={{ color: "#C1C9D4" }}>—</span>}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <input
                            type="number" min={1} max={l.max}
                            value={l.qty}
                            disabled={disabled || !l.selected}
                            onChange={e => {
                              const v = Math.max(1, Math.min(l.max, Number(e.target.value) || 1));
                              updateLine(i, { qty: v });
                            }}
                            style={{
                              width: 56, padding: "5px 6px", borderRadius: 7, textAlign: "center",
                              border: `1.5px solid ${l.selected && !disabled ? "#FDE68A" : "#E5E9EF"}`,
                              fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace",
                              background: l.selected && !disabled ? "#FFFEF5" : "#F9FAFB",
                              color: l.selected && !disabled ? "#0D1117" : "#9CA3AF", outline: "none",
                            }}
                          />
                        </td>
                        <td className="price" style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: l.selected && !disabled ? "#DC2626" : "#C1C9D4", fontSize: "0.82rem" }}>
                          {l.selected && !disabled ? fmt(l.qty * l.unit_price) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <input
                            type="text"
                            placeholder="ເຫດຜົນ..."
                            value={l.reason}
                            disabled={disabled || !l.selected}
                            onChange={e => updateLine(i, { reason: e.target.value })}
                            style={{
                              width: "100%", minWidth: 120, padding: "5px 9px", borderRadius: 7,
                              border: `1.5px solid ${l.selected && !disabled ? "#FDE68A" : "#E5E9EF"}`,
                              fontSize: "0.76rem", background: l.selected && !disabled ? "#FFFEF5" : "#F9FAFB",
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
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #F0F2F5", flexShrink: 0, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: "0.85rem", color: "#6B7280", fontWeight: 500 }}>ຍອດເງິນທີ່ຈະຄືນ:</span>
              <span className="price" style={{ fontSize: "1.3rem", fontWeight: 800, color: totalRefund > 0 ? "#DC2626" : "#C1C9D4" }}>
                {totalRefund > 0 ? `-${fmt(totalRefund)}` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #E5E9EF",
                background: "#F9FAFB", color: "#6B7280", fontSize: "0.85rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                ຍົກເລີກ
              </button>
              <button
                disabled={selectedLines.length === 0}
                onClick={() => setShowConfirm(true)}
                style={{
                  flex: 2, padding: "11px", borderRadius: 10, fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 700,
                  border: "none", cursor: selectedLines.length === 0 ? "not-allowed" : "pointer",
                  background: selectedLines.length === 0 ? "#F3F4F6" : "linear-gradient(135deg,#EF4444,#DC2626)",
                  color: selectedLines.length === 0 ? "#9CA3AF" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <RotateCcw size={15} />
                {allSelected
                  ? "ຄືນທັງໝົດ"
                  : selectedLines.length > 0
                    ? `ຄືນ ${selectedLines.length} ລາຍການ`
                    : "ກະລຸນາເລືອກລາຍການ"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation Dialog ── */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.65)", zIndex: 9200,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 440,
                        boxShadow: "0 24px 64px rgba(13,17,23,0.28)", padding: "28px 32px" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(145deg,#FEF2F2,#FEE2E2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0D1117" }}>ຢືນຢັນການຄືນສິນຄ້າ?</div>
                <div style={{ fontSize: "0.74rem", color: "#9CA3AF", marginTop: 2 }}>ບິນ {sale.invoice_number}</div>
              </div>
            </div>

            {/* Items to return */}
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                ລາຍການທີ່ຈະຄືນ
              </div>
              {selectedLines.map(l => (
                <div key={l.sale_item_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #FECACA" }}>
                  <span style={{ fontSize: "0.82rem", color: "#991B1B", fontWeight: 500 }}>
                    {l.product_name} × {l.qty}
                  </span>
                  <span className="price" style={{ fontSize: "0.82rem", color: "#DC2626", fontWeight: 700 }}>
                    -{fmt(l.qty * l.unit_price)}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, marginTop: 4 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#7F1D1D" }}>ຍອດຄືນລວມ</span>
                <span className="price" style={{ fontSize: "1.05rem", fontWeight: 800, color: "#DC2626" }}>-{fmt(totalRefund)}</span>
              </div>
            </div>

            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "9px 13px", marginBottom: 20, fontSize: "0.78rem", color: "#C2410C" }}>
              ⚠ ການຄືນສິນຄ້າຈະເພີ່ມສ່ວນຕ່າງໜ່ວຍຄືນໃນສາງ ແລະ ບັນທຶກຄ່າໃຊ້ຈ່າຍໂດຍອັດຕະໂນມັດ
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} disabled={submitting} style={{
                flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #E5E9EF",
                background: "#F9FAFB", color: "#6B7280", fontSize: "0.85rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                ຍົກເລີກ
              </button>
              <button onClick={handleConfirm} disabled={submitting} style={{
                flex: 2, padding: "11px", borderRadius: 10, border: "none",
                background: submitting ? "#F3F4F6" : "linear-gradient(135deg,#EF4444,#B91C1C)",
                color: submitting ? "#9CA3AF" : "#fff", fontSize: "0.88rem", fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: submitting ? 0.75 : 1,
              }}>
                {submitting
                  ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> ກຳລັງດຳເນີນການ...</>
                  : <><CheckCircle2 size={15} /> ຢືນຢັນ</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══ PAGE ═══════════════════════════════════════════════════════ */
export default function SalesPage() {
  const { user }     = useAuth();
  const { showToast } = useToast();
  const isAdmin      = user?.role === "Admin";

  const [preset,      setPreset]      = useState<Preset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [sales,     setSales]     = useState<SaleRow[]>([]);
  const [meta,      setMeta]      = useState<SaleMeta>({ total: 0, page: 1, totalPages: 1 });
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detailId,        setDetailId]        = useState<number | null>(null);
  const [returnSale,      setReturnSale]      = useState<SaleDetail | null>(null);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);

  const { start, end } = getRange(preset, customStart, customEnd);

  /* ── Fetch ── */
  const fetchSales = useCallback(async (s: string, e: string, pg: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params: Record<string, unknown> = { page: pg, limit: 15 };
      if (s) params.start_date = s;
      if (e) params.end_date   = e;
      const res = await salesApi.getAll(params as any);
      setSales(res.data.data ?? []);
      setMeta(res.data.meta  ?? { total: 0, page: 1, totalPages: 1 });
    } catch {
      showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (preset !== "custom" || (customStart && customEnd)) {
      fetchSales(start, end, page);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, page]);

  function handlePreset(p: Preset) {
    if (p === "custom" && !customStart) {
      const today = new Date(), ago = new Date(today);
      ago.setDate(today.getDate() - 29);
      setCustomStart(toISO(ago));
      setCustomEnd(toISO(today));
    }
    setPreset(p);
    setPage(1);
  }

  /* ── Filtered + searched rows ── */
  const displayedSales = sales.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      const matchInv  = s.invoice_number?.toLowerCase().includes(q);
      const matchCust = s.customer_name?.toLowerCase().includes(q) ?? false;
      if (!matchInv && !matchCust) return false;
    }
    if (statusFilter === "paid")     return s.payment_status === "paid" && s.refund_status === "none";
    if (statusFilter === "partial")  return s.refund_status === "partial";
    if (statusFilter === "refunded") return s.refund_status === "full" || s.payment_status === "refunded";
    return true;
  });

  /* ── Summary counts ── */
  const countCompleted = sales.filter(s => s.payment_status === "paid" && s.refund_status === "none").length;
  const countPartial   = sales.filter(s => s.refund_status === "partial").length;
  const countReturned  = sales.filter(s => s.refund_status === "full" || s.payment_status === "refunded").length;
  const totalRevenue   = sales.reduce((acc, s) => acc + Number(s.total), 0);

  function handleReturnSuccess() {
    setReturnSale(null);
    setDetailId(null);
    fetchSales(start, end, page, true);
  }

  if (loading) return (
    <>
      <Header title="ປະຫວັດການຂາຍ" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #F0F2F5", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>ກຳລັງໂຫຼດ...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    </>
  );

  return (
    <>
      <Header title="ປະຫວັດການຂາຍ" subtitle="ລາຍການຂາຍ ແລະ ການຄືນສິນຄ້າ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 48px", overflowY: "auto" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>
            ການຂາຍ
          </p>
          <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            ປະຫວັດການຂາຍ
          </h2>
        </div>

        {/* ── Summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "ຍອດລວມ", value: fmt(totalRevenue), bg: "#FFFBEB", border: "#FDE68A", top: "#F59E0B", color: "#D97706", icon: <Receipt size={18} />, iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)" },
            { label: "ສຳເລັດ",  value: `${countCompleted} ລາຍການ`, bg: "#F0FDF4", border: "#A7F3D0", top: "#10B981", color: "#059669", icon: <CheckCircle2 size={18} />, iconBg: "linear-gradient(145deg,#F0FDF8,#DCFCE7)" },
            { label: "ຄືນບາງສ່ວນ", value: `${countPartial} ລາຍການ`, bg: "#FFFBEB", border: "#FDE68A", top: "#F59E0B", color: "#D97706", icon: <Clock size={18} />, iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)" },
            { label: "ຄືນທັງໝົດ", value: `${countReturned} ລາຍການ`, bg: "#FFF5F5", border: "#FECACA", top: "#EF4444", color: "#DC2626", icon: <XCircle size={18} />, iconBg: "linear-gradient(145deg,#FFF5F5,#FEE2E2)" },
          ].map(card => (
            <div key={card.label} style={{
              background: "#fff", borderRadius: 16, padding: "18px 20px",
              boxShadow: "0 2px 8px rgba(13,17,23,0.06)", borderTop: `3px solid ${card.top}`,
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 6px 20px rgba(13,17,23,0.09)", transform: "translateY(-2px)" })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 2px 8px rgba(13,17,23,0.06)", transform: "translateY(0)" })}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color, marginBottom: 12 }}>
                {card.icon}
              </div>
              <div className="price" style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0D1117", lineHeight: 1, marginBottom: 5 }}>{card.value}</div>
              <div style={{ fontSize: "0.79rem", color: "#6B7280", fontWeight: 500 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

            {/* Date presets */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#9CA3AF", fontSize: "0.74rem", fontWeight: 600 }}>
              <Calendar size={13} /> ຊ່ວງ:
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {(["today","week","month","3months","all","custom"] as Preset[]).map(p => {
                const active = preset === p;
                return (
                  <button key={p} onClick={() => handlePreset(p)} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600,
                    cursor: "pointer", border: active ? "1.5px solid #FCD34D" : "1.5px solid transparent",
                    background: active ? "#FEF3C7" : "#F3F4F6",
                    color: active ? "#D97706" : "#6B7280",
                    boxShadow: active ? "0 0 0 3px rgba(251,191,36,0.15)" : "none", transition: "all 0.14s",
                  }}>
                    {PRESET_LABELS[p]}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1 }} />

            {/* Status filter chips */}
            <div style={{ display: "flex", gap: 5 }}>
              {[
                { value: "",          label: "ທັງໝົດ" },
                { value: "paid",      label: "ສຳເລັດ" },
                { value: "partial",   label: "ຄືນບາງສ່ວນ" },
                { value: "refunded",  label: "ຄືນແລ້ວ" },
              ].map(opt => {
                const active = statusFilter === opt.value;
                return (
                  <button key={opt.value} onClick={() => setStatusFilter(opt.value)} style={{
                    padding: "5px 11px", borderRadius: 999, fontSize: "0.74rem", fontWeight: 600,
                    cursor: "pointer", border: active ? "1.5px solid #0D1117" : "1.5px solid #E5E9EF",
                    background: active ? "#0D1117" : "#fff", color: active ? "#fff" : "#6B7280",
                    transition: "all 0.14s",
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ຊອກຫາເລກບິນ, ລູກຄ້າ..."
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: 9, border: "1.5px solid #E5E9EF",
                  fontSize: "0.8rem", width: 210, color: "#0D1117", outline: "none",
                  background: "#F9FAFB", fontFamily: "inherit",
                }}
              />
            </div>

            {refreshing && (
              <Loader2 size={16} style={{ color: "#F59E0B", animation: "spin 0.7s linear infinite" }} />
            )}
          </div>

          {preset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: "0.78rem", color: "#9CA3AF", fontWeight: 600 }}>ຕັ້ງແຕ່:</span>
              <input type="date" value={customStart}
                onChange={e => { setCustomStart(e.target.value); setPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E9EF", fontSize: "0.82rem", color: "#0D1117", outline: "none" }} />
              <span style={{ fontSize: "0.78rem", color: "#9CA3AF", fontWeight: 600 }}>ຮອດ:</span>
              <input type="date" value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E9EF", fontSize: "0.82rem", color: "#0D1117", outline: "none" }} />
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", overflow: "hidden" }}>

          {/* Table header row */}
          <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                <Receipt size={14} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0D1117" }}>ລາຍການຂາຍ</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 1 }}>
                  {displayedSales.length > 0 ? `${displayedSales.length} ລາຍການ` : "ບໍ່ມີຂໍ້ມູນ"}
                  {search || statusFilter ? ` (ກຣອງ)` : ""}
                </div>
              </div>
            </div>

            {/* Pagination top */}
            {meta.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.74rem", color: "#9CA3AF" }}>ໜ້າ {meta.page}/{meta.totalPages}</span>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, color: "#6B7280" }}>
                  <ChevronLeft size={13} />
                </button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: "1.5px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: page >= meta.totalPages ? "not-allowed" : "pointer", opacity: page >= meta.totalPages ? 0.4 : 1, color: "#6B7280" }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          {displayedSales.length === 0 ? (
            <div style={{ padding: "64px 32px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#C1C9D4" }}>
                <Package size={24} />
              </div>
              <div style={{ color: "#9CA3AF", fontSize: "0.88rem" }}>
                {search || statusFilter ? "ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ" : "ບໍ່ມີລາຍການຂາຍໃນຊ່ວງນີ້"}
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ເລກບິນ</th>
                  <th>ວັນທີ</th>
                  <th>ລູກຄ້າ</th>
                  <th>ຜູ້ຂາຍ</th>
                  <th style={{ textAlign: "right" }}>ຍອດເງິນ</th>
                  <th style={{ textAlign: "center" }}>ວິທີຊຳລະ</th>
                  <th style={{ textAlign: "center" }}>ສະຖານະ</th>
                  <th style={{ textAlign: "center" }}>ການດຳເນີນງານ</th>
                </tr>
              </thead>
              <tbody>
                {displayedSales.map(s => {
                  const canReturn = isAdmin && s.refund_status !== "full" && s.payment_status !== "refunded";
                  return (
                    <tr key={s.id}
                      onClick={() => setDetailId(s.id)}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "#FAFBFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <span
                          className="price"
                          style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2563EB", cursor: "pointer" }}
                          onClick={() => setDetailId(s.id)}
                        >
                          {s.invoice_number}
                        </span>
                      </td>
                      <td style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                        {new Date(s.created_at).toLocaleDateString("lo-LA", { day: "2-digit", month: "short", year: "numeric" })}
                        <div style={{ fontSize: "0.68rem", color: "#C1C9D4", marginTop: 1 }}>
                          {new Date(s.created_at).toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="text-prim">
                        {s.customer_name || <span style={{ color: "#C1C9D4", fontStyle: "italic", fontSize: "0.78rem" }}>ລູກຄ້າທົ່ວໄປ</span>}
                      </td>
                      <td style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                        {s.user_name || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="price" style={{ fontWeight: 700, color: "#0D1117" }}>{fmt(Number(s.total))}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#F3F4F6", border: "1px solid #E5E9EF", borderRadius: 6, padding: "3px 9px", fontSize: "0.74rem", color: "#6B7280", fontWeight: 600 }}>
                          {PM_LABEL[s.payment_method] ?? s.payment_method}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <StatusBadge paymentStatus={s.payment_status} refundStatus={s.refund_status} />
                      </td>
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {/* View Detail */}
                          <button
                            onClick={() => setDetailId(s.id)}
                            title="ເບິ່ງລາຍລະອຽດ"
                            style={{
                              width: 30, height: 30, borderRadius: 7, border: "1.5px solid #E5E9EF",
                              background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "#6B7280", transition: "all 0.13s",
                            }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#EFF6FF", borderColor: "#BFDBFE", color: "#2563EB" })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#F9FAFB", borderColor: "#E5E9EF", color: "#6B7280" })}
                          >
                            <Eye size={13} />
                          </button>

                          {/* Print button — all users */}
                          <button
                            onClick={async () => {
                              try {
                                const res = await salesApi.getById(s.id);
                                setReceiptModalData(saleToReceiptData(res.data.data));
                              } catch {
                                showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error");
                              }
                            }}
                            title="ພິມໃບບິນ"
                            style={{
                              width: 30, height: 30, borderRadius: 7, border: "1.5px solid #E5E9EF",
                              background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "#6B7280", transition: "all 0.13s",
                            }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#EFF6FF", borderColor: "#BFDBFE", color: "#2563EB" })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#F9FAFB", borderColor: "#E5E9EF", color: "#6B7280" })}
                          >
                            <Printer size={13} />
                          </button>

                          {/* Return — admin only */}
                          {canReturn && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await salesApi.getById(s.id);
                                  setReturnSale(res.data.data);
                                } catch {
                                  showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error");
                                }
                              }}
                              title={s.refund_status === "partial" ? "ຄືນເພີ່ມ" : "ຄືນສິນຄ້າ"}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "5px 10px", borderRadius: 7,
                                border: "1.5px solid #FECACA", background: "#FEF2F2",
                                color: "#DC2626", fontSize: "0.74rem", fontWeight: 700,
                                cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
                              }}
                              onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#FEE2E2", borderColor: "#FCA5A5" })}
                              onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "#FEF2F2", borderColor: "#FECACA" })}
                            >
                              <RotateCcw size={11} />
                              {s.refund_status === "partial" ? "ຄືນເພີ່ມ" : "ຄືນ"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Bottom pagination */}
          {meta.totalPages > 1 && (
            <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.76rem", color: "#9CA3AF" }}>
                ສະແດງ {((page - 1) * 15) + 1}–{Math.min(page * 15, meta.total)} ຈາກ {meta.total} ລາຍການ
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #E5E9EF", background: "#F9FAFB", fontSize: "0.78rem", fontWeight: 600, color: "#6B7280", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                  ← ກ່ອນ
                </button>
                {(() => {
                  const total = meta.totalPages;
                  const count = Math.min(5, total);
                  const s     = Math.max(1, Math.min(page - 2, total - count + 1));
                  return Array.from({ length: count }, (_, i) => s + i).map(pg => (
                    <button key={pg} onClick={() => setPage(pg)} style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: pg === page ? "1.5px solid #FCD34D" : "1.5px solid #E5E9EF",
                      background: pg === page ? "#FEF3C7" : "#F9FAFB",
                      fontSize: "0.78rem", fontWeight: 700,
                      color: pg === page ? "#D97706" : "#6B7280", cursor: "pointer",
                    }}>{pg}</button>
                  ));
                })()}
                <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #E5E9EF", background: "#F9FAFB", fontSize: "0.78rem", fontWeight: 600, color: "#6B7280", cursor: page >= meta.totalPages ? "not-allowed" : "pointer", opacity: page >= meta.totalPages ? 0.4 : 1 }}>
                  ຕໍ່ →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Sale Detail Modal ── */}
      {detailId !== null && !returnSale && (
        <SaleDetailModal
          saleId={detailId}
          onClose={() => setDetailId(null)}
          isAdmin={isAdmin}
          onReturnClick={sale => {
            setReturnSale(sale);
            setDetailId(null);
          }}
        />
      )}

      {/* ── Return Modal ── */}
      {returnSale && (
        <ReturnModal
          sale={returnSale}
          onClose={() => setReturnSale(null)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {/* ── Receipt Modal (print) ── */}
      {receiptModalData && (
        <ReceiptModal
          data={receiptModalData}
          onClose={() => setReceiptModalData(null)}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </>
  );
}
