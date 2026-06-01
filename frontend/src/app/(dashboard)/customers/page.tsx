"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Users, X, Phone, MapPin, Mail } from "lucide-react";
import Header from "@/components/Header";
import { customersApi } from "@/lib/api";
import { Customer, CustomerFormData } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

const EMPTY: CustomerFormData = { name: "", phone: "", address: "", email: "" };

/* colour palette for customer avatars — rotates by id */
const AVATAR_PALETTES = [
  { bg: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", border: "#93C5FD", color: "#1D4ED8" },
  { bg: "linear-gradient(145deg,#F0FDF8,#DCFCE7)", border: "#86EFAC", color: "#059669" },
  { bg: "linear-gradient(145deg,#FAF5FF,#EDE9FE)", border: "#C4B5FD", color: "#7C3AED" },
  { bg: "linear-gradient(145deg,#FFF5F5,#FEE2E2)", border: "#FCA5A5", color: "#DC2626" },
  { bg: "linear-gradient(145deg,#FFFBEB,#FEF3C7)", border: "#FCD34D", color: "#D97706" },
];

/* ─ Modal ─────────────────────────────────────────────────── */
function CustomerModal({
  customer, onClose, onSave,
}: { customer: Customer | null; onClose: () => void; onSave: () => void; }) {
  const [form, setForm] = useState<CustomerFormData>(
    customer
      ? { name: customer.name, phone: customer.phone, address: customer.address, email: customer.email }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { showToast("ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ", "error"); return; }
    setSaving(true);
    try {
      if (customer) {
        await customersApi.update(customer.id, form);
        showToast("ອັບເດດລູກຄ້າສຳເລັດ", "success");
      } else {
        await customersApi.create(form);
        showToast("ເພີ່ມລູກຄ້າສຳເລັດ", "success");
      }
      onSave();
    } catch { showToast("ເກີດຂໍ້ຜິດພາດ", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0D1117" }}>
              {customer ? "ແກ້ໄຂລູກຄ້າ" : "ເພີ່ມລູກຄ້າໃໝ່"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>
              {customer ? `#${customer.id}` : "ກອກຂໍ້ມູນລູກຄ້າ"}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "7px" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 26px" }}>
          {[
            { label: "ຊື່ລູກຄ້າ *", key: "name"    as const, placeholder: "ຊຽງໃໝ່ ວົງໄຊ",       type: "text" },
            { label: "ເບີໂທ *",      key: "phone"   as const, placeholder: "020 XXXX XXXX",     type: "text" },
            { label: "ທີ່ຢູ່",         key: "address" as const, placeholder: "ວຽງຈັນ, ລາວ",       type: "text" },
            { label: "Email",          key: "email"   as const, placeholder: "example@email.com", type: "email" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="input-field"
              />
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "ກຳລັງບັນທຶກ..." : customer ? "ອັບເດດ" : "ເພີ່ມລູກຄ້າ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered,  setFiltered]  = useState<Customer[]>([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<"add" | "edit" | null>(null);
  const [selected,  setSelected]  = useState<Customer | null>(null);
  const { showToast } = useToast();
  const { user }      = useAuth();
  const isAdmin       = user?.role === "Admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersApi.getAll();
      setCustomers(res.data.data || []);
    } catch { showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFiltered(customers); return; }
    setFiltered(customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    ));
  }, [customers, search]);

  const handleDelete = async (c: Customer) => {
    if (!confirm(`ຕ້ອງການລຶບ "${c.name}" ບໍ່?`)) return;
    try {
      await customersApi.delete(c.id);
      showToast("ລຶບລູກຄ້າສຳເລັດ", "success");
      load();
    } catch { showToast("ລຶບລູກຄ້າຜິດພາດ", "error"); }
  };

  return (
    <>
      <Header title="ລູກຄ້າ" subtitle="ຄຸ້ມຄອງຂໍ້ມູນລູກຄ້າ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 40px" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>
            ຄຸ້ມຄອງ
          </p>
          <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            ລູກຄ້າ
          </h2>
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ ຫຼື ເບີໂທ..."
              className="search-input"
            />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            background: "#fff", border: "1px solid #E5E9EF",
            boxShadow: "0 1px 2px rgba(13,17,23,0.04)",
            color: "#6B7280", fontSize: "0.8rem", fontWeight: 600,
          }}>
            <Users size={14} />
            {filtered.length} ລາຍການ
          </div>
          <button
            onClick={() => { setSelected(null); setModal("add"); }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            ເພີ່ມລູກຄ້າ
          </button>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 154, borderRadius: 18 }} />
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
              <Users size={22} color="#9CA3AF" />
            </div>
            <div style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>ບໍ່ມີຂໍ້ມູນລູກຄ້າ</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {filtered.map(c => {
              const pal = AVATAR_PALETTES[c.id % AVATAR_PALETTES.length];
              return (
                <div
                  key={c.id}
                  style={{
                    background: "#fff", borderRadius: 18,
                    boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)",
                    padding: "20px 22px",
                    transition: "box-shadow 0.22s, transform 0.22s",
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
                        width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                        background: pal.bg, border: `2px solid ${pal.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.05rem", fontWeight: 800, color: pal.color,
                      }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0D1117", fontSize: "0.9rem", lineHeight: 1.2 }}>
                          {c.name}
                        </div>
                        <div className="price" style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 3 }}>
                          #{c.id}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Edit: all roles */}
                      <button
                        onClick={() => { setSelected(c); setModal("edit"); }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "6px 8px", color: "#3B82F6" }}
                        title="ແກ້ໄຂ"
                      >
                        <Edit2 size={13} />
                      </button>
                      {/* Delete: Admin only */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(c)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "6px 8px", color: "#EF4444" }}
                          title="ລຶບ"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {c.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.8rem", color: "#6B7280" }}>
                        <Phone size={12} style={{ flexShrink: 0, color: "#9CA3AF" }} />
                        {c.phone}
                      </div>
                    )}
                    {c.address && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "0.8rem", color: "#6B7280" }}>
                        <MapPin size={12} style={{ flexShrink: 0, color: "#9CA3AF", marginTop: 2 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.address}
                        </span>
                      </div>
                    )}
                    {c.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.8rem", color: "#6B7280" }}>
                        <Mail size={12} style={{ flexShrink: 0, color: "#9CA3AF" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {(modal === "add" || modal === "edit") && (
        <CustomerModal
          customer={modal === "edit" ? selected : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
