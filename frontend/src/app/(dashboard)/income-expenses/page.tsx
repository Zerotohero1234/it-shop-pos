"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2,
  X, ChevronLeft, ChevronRight, Calendar, Filter,
} from "lucide-react";
import { incomeExpensesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { IncomeExpense, IncomeExpenseSummary } from "@/types";

/* ─── Date helpers ─────────────────────────────────────────────── */
type DatePreset = "today" | "week" | "month" | "custom";

function getRange(preset: DatePreset, cStart: string, cEnd: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const now = new Date();
  if (preset === "today") {
    const t = fmt(now);
    return { start: t, end: t };
  }
  if (preset === "week") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun) };
  }
  if (preset === "month") {
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end: fmt(last) };
  }
  return { start: cStart, end: cEnd };
}

/* ─── Number formatter ─────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString("lo-LA", { minimumFractionDigits: 0 });

/* ─── Types ────────────────────────────────────────────────────── */
type TypeFilter   = "" | "Income" | "Expense";
type SourceFilter = "" | "manual" | "sale" | "return";

interface FormState {
  type: "Income" | "Expense";
  amount: string;
  description: string;
  transaction_date: string;
}
interface FormErrors {
  type?: string;
  amount?: string;
  description?: string;
}

/* ─── Source badge ─────────────────────────────────────────────── */
function SourceBadge({ source }: { source: IncomeExpense["source"] }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    manual: { label: "ເພີ່ມເອງ",      bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    sale:   { label: "ຈາກການຂາຍ",    bg: "#F0FDF4", color: "#15803D", border: "#86EFAC" },
    return: { label: "ຈາກການຄືນ",    bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  };
  const s = map[source] ?? map.manual;
  return (
    <span className="badge" style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, fontSize: "0.68rem",
    }}>
      {s.label}
    </span>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export default function IncomeExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "Admin";
  const today = new Date().toISOString().slice(0, 10);

  /* ── filter state ── */
  const [preset,      setPreset]      = useState<DatePreset>("month");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd,   setCustomEnd]   = useState(today);
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>("");
  const [srcFilter,   setSrcFilter]   = useState<SourceFilter>("");

  /* ── data state ── */
  const [rows,    setRows]    = useState<IncomeExpense[]>([]);
  const [summary, setSummary] = useState<IncomeExpenseSummary | null>(null);
  const [meta,    setMeta]    = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const LIMIT = 15;

  /* ── modal state ── */
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<IncomeExpense | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const [form, setForm] = useState<FormState>({
    type: "Expense",
    amount: "",
    description: "",
    transaction_date: today,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /* ── fetch ── */
  const range = getRange(preset, customStart, customEnd);

  const fetchData = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = {
        start_date: range.start,
        end_date:   range.end,
        page,
        limit: LIMIT,
        ...(typeFilter && { type: typeFilter }),
        ...(srcFilter  && { source: srcFilter }),
      };
      const [listRes, sumRes] = await Promise.all([
        incomeExpensesApi.getAll(params),
        incomeExpensesApi.getSummary({ start_date: range.start, end_date: range.end }),
      ]);
      setRows(listRes.data.data   ?? []);
      setMeta(listRes.data.meta   ?? { total: 0, page: 1, totalPages: 1 });
      setSummary(sumRes.data.data ?? null);
    } catch {
      showToast("ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້", "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, typeFilter, srcFilter]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  /* ── modal helpers ── */
  function openAdd() {
    setEditTarget(null);
    setForm({ type: "Expense", amount: "", description: "", transaction_date: today });
    setFormErrors({});
    setModalOpen(true);
  }
  function openEdit(row: IncomeExpense) {
    setEditTarget(row);
    setForm({
      type: row.type,
      amount: String(row.amount),
      description: row.description,
      transaction_date: row.transaction_date.slice(0, 10),
    });
    setFormErrors({});
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditTarget(null); }

  function validateForm(): boolean {
    const errs: FormErrors = {};
    if (!["Income", "Expense"].includes(form.type)) errs.type = "ກະລຸນາເລືອກປະເພດ";
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) errs.amount = "ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຖືກຕ້ອງ";
    if (!form.description.trim()) errs.description = "ກະລຸນາໃສ່ລາຍລະອຽດ";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        description: form.description.trim(),
        transaction_date: form.transaction_date,
      };
      if (editTarget) {
        await incomeExpensesApi.update(editTarget.id, payload);
        showToast("ແກ້ໄຂລາຍການສຳເລັດ", "success");
      } else {
        await incomeExpensesApi.create(payload);
        showToast("ເພີ່ມລາຍການສຳເລັດ", "success");
      }
      closeModal();
      fetchData(meta.page);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await incomeExpensesApi.delete(deleteId);
      showToast("ລົບລາຍການສຳເລັດ", "success");
      setDeleteId(null);
      fetchData(meta.page);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  /* ─── Render ──────────────────────────────────────────────────── */
  const balance  = summary?.balance ?? 0;
  const balColor = balance >= 0 ? "#059669" : "#DC2626";

  return (
    <div className="page-enter" style={{ padding: "28px 32px", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="page-header" style={{
            fontFamily: "Syne, sans-serif", fontWeight: 800,
            fontSize: "1.45rem", color: "#0D1117", letterSpacing: "-0.02em",
          }}>
            ລາຍຮັບ-ລາຍຈ່າຍ
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.82rem", marginTop: 4 }}>
            ຈັດການ ແລະ ຕິດຕາມລາຍຮັບ-ລາຍຈ່າຍທັງໝົດ
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} />
            ເພີ່ມລາຍການ
          </button>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 28 }}>
        <SummaryCard
          icon={<TrendingUp size={20} />}
          iconClass="icon-box-green"
          accentClass="stat-accent-green"
          label="ລາຍຮັບທັງໝົດ"
          value={summary?.total_income ?? 0}
          count={summary?.income_count}
          color="#059669"
          loading={loading}
        />
        <SummaryCard
          icon={<TrendingDown size={20} />}
          iconClass="icon-box-red"
          accentClass="stat-accent-red"
          label="ລາຍຈ່າຍທັງໝົດ"
          value={summary?.total_expense ?? 0}
          count={summary?.expense_count}
          color="#DC2626"
          loading={loading}
        />
        <div className="card" style={{
          padding: "20px 24px",
          borderTop: `3px solid ${balColor}`,
          background: balance >= 0
            ? "linear-gradient(160deg,#F0FDF8 0%,#fff 50%)"
            : "linear-gradient(160deg,#FFF5F5 0%,#fff 50%)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                ຍອດຄົງເຫຼືອ
              </p>
              {loading ? (
                <div className="skeleton" style={{ height: 28, width: 120 }} />
              ) : (
                <p className="price" style={{ fontSize: "1.55rem", fontWeight: 800, color: balColor, letterSpacing: "-0.02em" }}>
                  {balance >= 0 ? "+" : ""}{fmt(balance)} ກີບ
                </p>
              )}
              <p style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: 4 }}>
                ລາຍຮັບ − ລາຍຈ່າຍ
              </p>
            </div>
            <div className="icon-box" style={{
              width: 40, height: 40,
              background: balance >= 0 ? "linear-gradient(145deg,#F0FDF8,#DCFCE7)" : "linear-gradient(145deg,#FFF5F5,#FEE2E2)",
              color: balColor,
            }}>
              <Wallet size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>

          {/* Date preset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} color="#9CA3AF" />
            {(["today","week","month","custom"] as DatePreset[]).map(p => {
              const labels: Record<DatePreset, string> = { today: "ວັນນີ້", week: "ອາທິດນີ້", month: "ເດືອນນີ້", custom: "ກຳນົດເອງ" };
              return (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: preset === p ? "#F59E0B" : "#E5E9EF",
                    background:  preset === p ? "#FFFBEB" : "#fff",
                    color:       preset === p ? "#D97706" : "#6B7280",
                    fontFamily: "inherit", transition: "all 0.14s",
                  }}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Custom date inputs */}
          {preset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" className="input-field" value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{ width: 140, padding: "6px 10px", fontSize: "0.8rem" }} />
              <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>ຫາ</span>
              <input type="date" className="input-field" value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{ width: 140, padding: "6px 10px", fontSize: "0.8rem" }} />
            </div>
          )}

          <div style={{ width: 1, height: 24, background: "#E5E9EF", margin: "0 4px" }} />

          {/* Type filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={13} color="#9CA3AF" />
            {(["","Income","Expense"] as TypeFilter[]).map(t => {
              const labels: Record<string, string> = { "": "ທັງໝົດ", Income: "ລາຍຮັບ", Expense: "ລາຍຈ່າຍ" };
              const colors: Record<string, string> = { "": "#6B7280", Income: "#059669", Expense: "#DC2626" };
              const active = typeFilter === t;
              return (
                <button key={t || "all-type"}
                  onClick={() => setTypeFilter(t)}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: active ? colors[t] + "80" : "#E5E9EF",
                    background:  active ? colors[t] + "12" : "#fff",
                    color:       active ? colors[t] : "#6B7280",
                    fontFamily: "inherit", transition: "all 0.14s",
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 24, background: "#E5E9EF", margin: "0 4px" }} />

          {/* Source filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {(["","manual","sale","return"] as SourceFilter[]).map(s => {
              const labels: Record<string, string> = { "": "ທັງໝົດ", manual: "ເພີ່ມເອງ", sale: "ຈາກການຂາຍ", return: "ຈາກການຄືນ" };
              const active = srcFilter === s;
              return (
                <button key={s || "all-src"}
                  onClick={() => setSrcFilter(s)}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: active ? "#F59E0B" : "#E5E9EF",
                    background:  active ? "#FFFBEB" : "#fff",
                    color:       active ? "#D97706" : "#6B7280",
                    fontFamily: "inherit", transition: "all 0.14s",
                  }}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          padding: "14px 20px 12px",
          borderBottom: "1px solid #F0F2F5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 700, color: "#0D1117", fontSize: "0.88rem" }}>
            ລາຍການທັງໝົດ
          </span>
          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
            {meta.total} ລາຍການ
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ວັນທີ</th>
                <th>ປະເພດ</th>
                <th>ລາຍລະອຽດ</th>
                <th style={{ textAlign: "right" }}>ຈຳນວນເງິນ (ກີບ)</th>
                <th>ແຫຼ່ງທີ່ມາ</th>
                {isAdmin && <th style={{ textAlign: "center" }}>ຈັດການ</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: isAdmin ? 6 : 5 }).map((__, j) => (
                      <td key={j}>
                        <div className="skeleton" style={{ height: 16, width: j === 2 ? 200 : 80 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "48px 20px" }}>
                    <div style={{ color: "#C1C9D4", fontSize: "0.875rem" }}>ບໍ່ມີລາຍການ</div>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                      {new Date(row.transaction_date).toLocaleDateString("lo-LA", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={
                      row.type === "Income"
                        ? { background: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC" }
                        : { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }
                    }>
                      {row.type === "Income" ? "▲ ລາຍຮັບ" : "▼ ລາຍຈ່າຍ"}
                    </span>
                  </td>
                  <td className="text-prim" style={{ maxWidth: 300 }}>
                    {row.description}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="price" style={{
                      fontWeight: 700,
                      color: row.type === "Income" ? "#059669" : "#DC2626",
                    }}>
                      {row.type === "Expense" ? "-" : "+"}{fmt(Number(row.amount))}
                    </span>
                  </td>
                  <td><SourceBadge source={row.source} /></td>
                  {isAdmin && (
                    <td style={{ textAlign: "center" }}>
                      {row.source === "manual" ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => openEdit(row)}
                            title="ແກ້ໄຂ"
                            style={{
                              padding: "5px 8px", borderRadius: 7,
                              background: "#EFF6FF", color: "#2563EB",
                              border: "1px solid #BFDBFE", cursor: "pointer",
                              display: "flex", alignItems: "center",
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteId(row.id)}
                            title="ລົບ"
                            style={{
                              padding: "5px 8px", borderRadius: 7,
                              background: "#FEF2F2", color: "#DC2626",
                              border: "1px solid #FECACA", cursor: "pointer",
                              display: "flex", alignItems: "center",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.7rem", color: "#CBD5E1" }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid #F0F2F5",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
              ໜ້າ {meta.page} / {meta.totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => fetchData(meta.page - 1)}
                disabled={meta.page <= 1}
                className="btn btn-secondary btn-sm"
                style={{ opacity: meta.page <= 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => fetchData(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="btn btn-secondary btn-sm"
                style={{ opacity: meta.page >= meta.totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content">
            {/* Header */}
            <div style={{
              padding: "22px 26px 18px",
              borderBottom: "1px solid #F0F2F5",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h2 style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0D1117" }}>
                  {editTarget ? "ແກ້ໄຂລາຍການ" : "ເພີ່ມລາຍການໃໝ່"}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: 3 }}>
                  {editTarget ? "ແກ້ໄຂຂໍ້ມູນລາຍຮັບ-ລາຍຈ່າຍ" : "ເພີ່ມລາຍຮັບ ຫຼື ລາຍຈ່າຍໃໝ່"}
                </p>
              </div>
              <button onClick={closeModal}
                style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: "#F9FAFB", border: "1.5px solid #E5E9EF",
                  cursor: "pointer", color: "#9CA3AF",
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px 26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Type toggle */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  ປະເພດ <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(["Income","Expense"] as const).map(t => (
                    <button key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{
                        padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                        fontFamily: "inherit", fontWeight: 600, fontSize: "0.875rem",
                        border: "2px solid",
                        borderColor: form.type === t
                          ? (t === "Income" ? "#10B981" : "#EF4444")
                          : "#E5E9EF",
                        background: form.type === t
                          ? (t === "Income" ? "#F0FDF4" : "#FEF2F2")
                          : "#fff",
                        color: form.type === t
                          ? (t === "Income" ? "#059669" : "#DC2626")
                          : "#6B7280",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.15s",
                      }}
                    >
                      {t === "Income" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      {t === "Income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}
                    </button>
                  ))}
                </div>
                {formErrors.type && <FieldError msg={formErrors.type} />}
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  ຈຳນວນເງິນ (ກີບ) <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0"
                  min="1"
                  value={form.amount}
                  onChange={e => {
                    setForm(f => ({ ...f, amount: e.target.value }));
                    if (formErrors.amount) setFormErrors(p => ({ ...p, amount: undefined }));
                  }}
                  style={formErrors.amount ? errorInputStyle : {}}
                />
                {formErrors.amount && <FieldError msg={formErrors.amount} />}
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  ລາຍລະອຽດ <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="ຕົວຢ່າງ: ຄ່າເຊົ່າຮ້ານ ເດືອນ 5"
                  value={form.description}
                  onChange={e => {
                    setForm(f => ({ ...f, description: e.target.value }));
                    if (formErrors.description) setFormErrors(p => ({ ...p, description: undefined }));
                  }}
                  style={{
                    resize: "vertical", minHeight: 80,
                    ...(formErrors.description ? errorInputStyle : {}),
                  }}
                />
                {formErrors.description && <FieldError msg={formErrors.description} />}
              </div>

              {/* Date */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  ວັນທີ
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={form.transaction_date}
                  onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
                <button
                  className="btn btn-secondary"
                  onClick={closeModal}
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  ຍົກເລີກ
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 2, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? (
                    <>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        animation: "spin 0.7s linear infinite",
                      }} />
                      ກຳລັງບັນທຶກ...
                    </>
                  ) : editTarget ? "ບັນທຶກການແກ້ໄຂ" : "ເພີ່ມລາຍການ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId !== null && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div style={{ padding: "28px 28px 24px", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(145deg,#FFF5F5,#FEE2E2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <Trash2 size={24} color="#DC2626" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#0D1117", marginBottom: 8 }}>
                ຢືນຢັນການລົບ?
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#64748B", lineHeight: 1.6 }}>
                ການດຳເນີນການນີ້ຈະລົບລາຍການນີ້ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={() => setDeleteId(null)} style={{ flex: 1 }} disabled={deleting}>
                  ຍົກເລີກ
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting} style={{ flex: 1 }}>
                  {deleting ? "ກຳລັງລົບ..." : "ລົບລາຍການ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Summary card ─────────────────────────────────────────────── */
function SummaryCard({
  icon, iconClass, accentClass, label, value, count, color, loading,
}: {
  icon: React.ReactNode;
  iconClass: string;
  accentClass: string;
  label: string;
  value: number;
  count?: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className={`card ${accentClass}`} style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {label}
          </p>
          {loading ? (
            <div className="skeleton" style={{ height: 28, width: 130 }} />
          ) : (
            <p className="price" style={{ fontSize: "1.5rem", fontWeight: 800, color, letterSpacing: "-0.02em" }}>
              {fmt(value)} ກີບ
            </p>
          )}
          {count !== undefined && (
            <p style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: 4 }}>
              {count} ລາຍການ
            </p>
          )}
        </div>
        <div className={`icon-box ${iconClass}`} style={{ width: 40, height: 40 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ─── Field error ──────────────────────────────────────────────── */
function FieldError({ msg }: { msg: string }) {
  return (
    <div style={{
      marginTop: 5, fontSize: "0.75rem", color: "#EF4444",
      display: "flex", alignItems: "center", gap: 5,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
        <path d="M6 3.5V6.5" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6" cy="8.5" r="0.6" fill="#EF4444" />
      </svg>
      {msg}
    </div>
  );
}

const errorInputStyle: React.CSSProperties = {
  borderColor: "#EF4444",
  background: "#FFF5F5",
  boxShadow: "0 0 0 3px rgba(239,68,68,0.1)",
};
