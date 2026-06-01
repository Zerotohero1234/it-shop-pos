"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Tag, Edit2, Trash2, X, Package, Search } from "lucide-react";
import Header from "@/components/Header";
import { categoriesApi } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

interface Category {
  id: number;
  name: string;
  description?: string;
  product_count: number;
  created_at: string;
}

/* colour palette rotates per category id */
const PALETTES = [
  { bg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)", border: "#FCD34D", color: "#D97706", light: "#FFFBEB" },
  { bg: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", border: "#93C5FD", color: "#1D4ED8", light: "#EFF6FF" },
  { bg: "linear-gradient(145deg,#F0FDF8,#DCFCE7)", border: "#86EFAC", color: "#059669", light: "#F0FDF4" },
  { bg: "linear-gradient(145deg,#FAF5FF,#EDE9FE)", border: "#C4B5FD", color: "#7C3AED", light: "#FAF5FF" },
  { bg: "linear-gradient(145deg,#FFF5F5,#FEE2E2)", border: "#FCA5A5", color: "#DC2626", light: "#FEF2F2" },
  { bg: "linear-gradient(145deg,#F0FDFA,#CCFBF1)", border: "#5EEAD4", color: "#0D9488", light: "#F0FDFA" },
];

/* ─ Modal ─────────────────────────────────────────────────── */
function CategoryModal({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name,        setName]        = useState(category?.name        ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [saving,      setSaving]      = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { showToast("ກະລຸນາໃສ່ຊື່ໝວດໝູ່", "error"); return; }
    setSaving(true);
    try {
      if (category) {
        await categoriesApi.update(category.id, name.trim(), description.trim() || undefined);
        showToast("ແກ້ໄຂໝວດໝູ່ສຳເລັດ", "success");
      } else {
        await categoriesApi.create(name.trim(), description.trim() || undefined);
        showToast("ເພີ່ມໝວດໝູ່ສຳເລັດ", "success");
      }
      onSave();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0D1117" }}>
              {category ? "ແກ້ໄຂໝວດໝູ່" : "ເພີ່ມໝວດໝູ່ໃໝ່"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>
              {category ? `ID: #${category.id}` : "ສ້າງໝວດໝູ່ສິນຄ້າໃໝ່"}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "7px" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 26px" }}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>
              ຊື່ໝວດໝູ່ <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ເຊັ່ນ: CPU, RAM, Storage..."
              className="input-field"
              autoFocus
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>
              ລາຍລະອຽດ
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ລາຍລະອຽດໝວດໝູ່ (ບໍ່ຈຳເປັນ)..."
              rows={3}
              className="input-field"
              style={{ resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "ກຳລັງບັນທຶກ..." : category ? "ອັບເດດ" : "ເພີ່ມໝວດໝູ່"}
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
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtered,   setFiltered]   = useState<Category[]>([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<"add" | "edit" | null>(null);
  const [selected,   setSelected]   = useState<Category | null>(null);
  const { showToast } = useToast();
  const { user }      = useAuth();
  const isAdmin       = user?.role === "Admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.getAll();
      setCategories(res.data.data || []);
    } catch { showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFiltered(categories); return; }
    setFiltered(categories.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase())
    ));
  }, [categories, search]);

  const handleDelete = async (cat: Category) => {
    if (cat.product_count > 0) {
      if (!confirm(`ໝວດໝູ່ "${cat.name}" ມີ ${cat.product_count} ສິນຄ້າ.\nສິນຄ້າທຸກລາຍການຈະຖືກຍ້າຍອອກຈາກໝວດໝູ່ນີ້.\nຕ້ອງການລຶບບໍ່?`)) return;
    } else {
      if (!confirm(`ຕ້ອງການລຶບ "${cat.name}" ບໍ່?`)) return;
    }
    try {
      await categoriesApi.delete(cat.id);
      showToast("ລຶບໝວດໝູ່ສຳເລັດ", "success");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ລຶບຜິດພາດ";
      showToast(msg, "error");
    }
  };

  const totalProducts = categories.reduce((s, c) => s + Number(c.product_count), 0);

  return (
    <>
      <Header title="ໝວດໝູ່" subtitle="ຈັດການໝວດໝູ່ສິນຄ້າ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 40px" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>
            ຄຸ້ມຄອງ
          </p>
          <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            ໝວດໝູ່ສິນຄ້າ
          </h2>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "ໝວດໝູ່ທັງໝົດ",   value: categories.length,                                     accent: "#F59E0B", iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)" },
            { label: "ສິນຄ້າທັງໝົດ",   value: totalProducts,                                          accent: "#0EA5E9", iconBg: "linear-gradient(145deg,#EFF6FF,#DBEAFE)" },
            { label: "ໝວດໝູ່ຫວ່າງ",   value: categories.filter(c => c.product_count === 0).length,  accent: "#8B5CF6", iconBg: "linear-gradient(145deg,#FAF5FF,#EDE9FE)" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#fff", borderRadius: 16,
              boxShadow: "0 2px 8px rgba(13,17,23,0.06)",
              padding: "18px 22px",
              borderTop: `3px solid ${s.accent}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: s.accent,
              }}>
                <Tag size={17} />
              </div>
              <div>
                <div className="price" style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D1117", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາໝວດໝູ່..."
              className="search-input"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => { setSelected(null); setModal("add"); }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              ເພີ່ມໝວດໝູ່
            </button>
          )}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 130, borderRadius: 16 }} />
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
              <Tag size={22} color="#9CA3AF" />
            </div>
            <div style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
              {search ? "ບໍ່ພົບໝວດໝູ່ທີ່ຄົ້ນຫາ" : "ຍັງບໍ່ມີໝວດໝູ່"}
            </div>
            {!search && isAdmin && (
              <button
                onClick={() => { setSelected(null); setModal("add"); }}
                className="btn btn-primary"
                style={{ marginTop: 16 }}
              >
                <Plus size={15} /> ເພີ່ມໝວດໝູ່ທຳອິດ
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {filtered.map(cat => {
              const pal = PALETTES[cat.id % PALETTES.length];
              return (
                <div
                  key={cat.id}
                  style={{
                    background: "#fff", borderRadius: 16,
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
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                        background: pal.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: pal.color,
                      }}>
                        <Tag size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0D1117", fontSize: "0.92rem", lineHeight: 1.2 }}>
                          {cat.name}
                        </div>
                        <div className="price" style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: 2 }}>
                          #C{cat.id}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => { setSelected(cat); setModal("edit"); }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "6px 8px", color: "#3B82F6" }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "6px 8px", color: "#EF4444" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {cat.description && (
                    <div style={{
                      fontSize: "0.78rem", color: "#6B7280",
                      marginBottom: 14, lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {cat.description}
                    </div>
                  )}

                  {/* Product count pill */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 999,
                    background: pal.light,
                    border: `1px solid ${pal.border}`,
                    fontSize: "0.78rem", fontWeight: 600, color: pal.color,
                  }}>
                    <Package size={12} />
                    {cat.product_count} ສິນຄ້າ
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {(modal === "add" || modal === "edit") && (
        <CategoryModal
          category={modal === "edit" ? selected : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
