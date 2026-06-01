"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Edit2, Trash2, X, Shield, User,
  KeyRound, UserCog, Eye, EyeOff,
} from "lucide-react";
import Header from "@/components/Header";
import { usersApi } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

interface Employee {
  id: number;
  username: string;
  name: string;
  role: "Admin" | "Employee";
  created_at: string;
}

/* ─ Add Employee Modal ────────────────────────────────────── */
function AddModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "Employee" });
  const [showPwd, setShowPwd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.name || !form.password) {
      showToast("ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບ", "error"); return;
    }
    if (form.password.length < 6) {
      showToast("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວ", "error"); return;
    }
    setSaving(true);
    try {
      await usersApi.register(form);
      showToast("ເພີ່ມພະນັກງານສຳເລັດ", "success");
      onSave();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0D1117" }}>ເພີ່ມພະນັກງານໃໝ່</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>ສ້າງບັນຊີຜູ້ໃຊ້ໃໝ່</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "7px" }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 26px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {/* Name - full width */}
            <div style={{ gridColumn: "1/-1", marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>ຊື່ - ນາມສະກຸນ *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="ທ. ສົມໃຈ ວົງສາ" className="input-field" autoFocus />
            </div>
            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>ຊື່ຜູ້ໃຊ້ *</label>
              <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="somchai123" className="input-field"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" }} />
            </div>
            {/* Role */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>ສິດການໃຊ້ງານ</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input-field">
                <option value="Employee">ພະນັກງານ</option>
                <option value="Admin">ຜູ້ດູແລ</option>
              </select>
            </div>
            {/* Password - full width */}
            <div style={{ gridColumn: "1/-1", marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>ລະຫັດຜ່ານ * (ຢ່າງໜ້ອຍ 6 ຕົວ)</label>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••" className="input-field" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0 }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມພະນັກງານ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─ Edit Employee Modal ───────────────────────────────────── */
function EditModal({ employee, onClose, onSave }: { employee: Employee; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(employee.name);
  const [role, setRole] = useState(employee.role);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { user: me } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { showToast("ກະລຸນາໃສ່ຊື່", "error"); return; }
    setSaving(true);
    try {
      await usersApi.update(employee.id, { name: name.trim(), role });
      showToast("ແກ້ໄຂຂໍ້ມູນສຳເລັດ", "success");
      onSave();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setSaving(false); }
  };

  const isSelf = me?.id === employee.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0D1117" }}>ແກ້ໄຂຂໍ້ມູນ</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>@{employee.username}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "7px" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px 26px" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>ຊື່ - ນາມສະກຸນ</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>
              ສິດການໃຊ້ງານ {isSelf && <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(ບໍ່ສາມາດປ່ຽນຂອງຕົນເອງ)</span>}
            </label>
            <select value={role} onChange={e => setRole(e.target.value as "Admin" | "Employee")}
              className="input-field" disabled={isSelf}>
              <option value="Employee">ພະນັກງານ</option>
              <option value="Admin">ຜູ້ດູແລ</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "ກຳລັງບັນທຶກ..." : "ອັບເດດ"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─ Reset Password Modal ──────────────────────────────────── */
function ResetPwdModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { showToast("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວ", "error"); return; }
    setSaving(true);
    try {
      await usersApi.resetPassword(employee.id, newPassword);
      showToast("ຣີເຊັດລະຫັດຜ່ານສຳເລັດ", "success");
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0D1117" }}>ຣີເຊັດລະຫັດຜ່ານ</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2 }}>{employee.name} (@{employee.username})</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "7px" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px 26px" }}>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 14px", borderRadius: 10, marginBottom: 18,
            background: "#FFFBEB", border: "1px solid #FDE68A",
          }}>
            <KeyRound size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: "0.78rem", color: "#92400E", lineHeight: 1.5 }}>
              ລະຫັດຜ່ານໃໝ່ຈະຖືກນຳໃຊ້ທັນທີ. ໃຫ້ແຈ້ງພະນັກງານດ້ວຍ.
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#374151", marginBottom: 6, fontWeight: 600 }}>
              ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 6 ຕົວ)
            </label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••" className="input-field"
                style={{ paddingRight: 42, fontFamily: "JetBrains Mono, monospace" }} autoFocus />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "ກຳລັງຣີເຊັດ..." : "ຣີເຊັດລະຫັດຜ່ານ"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<"add" | "edit" | "reset" | null>(null);
  const [selected,  setSelected]  = useState<Employee | null>(null);
  const { showToast }     = useToast();
  const { user: me }      = useAuth();
  const isAdmin           = me?.role === "Admin";
  const router            = useRouter();

  /* ── Access guard: Employee → redirect to dashboard ── */
  useEffect(() => {
    if (me && !isAdmin) {
      showToast("ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້", "error");
      router.replace("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll();
      setEmployees(res.data.data || []);
    } catch { showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (emp: Employee) => {
    if (me?.id === emp.id) { showToast("ບໍ່ສາມາດລຶບບັນຊີຂອງຕົນເອງ", "error"); return; }
    if (!confirm(`ຕ້ອງການລຶບ "${emp.name}" ບໍ່?`)) return;
    try {
      await usersApi.delete(emp.id);
      showToast("ລຶບພະນັກງານສຳເລັດ", "success");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ລຶບຜິດພາດ";
      showToast(msg, "error");
    }
  };

  const admins    = employees.filter(e => e.role === "Admin");
  const staff     = employees.filter(e => e.role === "Employee");

  return (
    <>
      <Header title="ພະນັກງານ" subtitle="ຈັດການຜູ້ໃຊ້ງານລະບົບ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px 28px 40px" }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 4 }}>ຄຸ້ມຄອງ</p>
          <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#0D1117", letterSpacing: "-0.03em", lineHeight: 1.1 }}>ພະນັກງານ</h2>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "ທັງໝົດ",      value: employees.length, accent: "#F59E0B", iconBg: "linear-gradient(145deg,#FEF9EC,#FEF3C7)", icon: <UserCog size={17}/> },
            { label: "ຜູ້ດູແລ Admin", value: admins.length,   accent: "#D97706", iconBg: "linear-gradient(145deg,#FEF9EC,#FDE68A)", icon: <Shield size={17}/> },
            { label: "ພະນັກງານ",    value: staff.length,    accent: "#0EA5E9", iconBg: "linear-gradient(145deg,#EFF6FF,#DBEAFE)", icon: <User size={17}/> },
          ].map(s => (
            <div key={s.label} style={{
              background: "#fff", borderRadius: 16,
              boxShadow: "0 2px 8px rgba(13,17,23,0.06)",
              padding: "18px 22px", borderTop: `3px solid ${s.accent}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: s.accent,
              }}>
                {s.icon}
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
        {isAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <button onClick={() => setModal("add")} className="btn btn-primary">
              <Plus size={16} /> ເພີ່ມພະນັກງານ
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 16 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* ── Admins ── */}
            {admins.length > 0 && (
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: "linear-gradient(145deg,#FEF9EC,#FDE68A)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#D97706",
                  }}>
                    <Shield size={13} />
                  </div>
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#0D1117" }}>
                    ຜູ້ດູແລລະບົບ
                  </span>
                  <span style={{
                    background: "#FFFBEB", border: "1px solid #FDE68A",
                    borderRadius: 999, padding: "1px 8px",
                    fontSize: "0.7rem", color: "#D97706", fontWeight: 700,
                  }}>
                    {admins.length}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                  {admins.map(emp => (
                    <EmployeeCard key={emp.id} emp={emp} me={me} isAdmin={isAdmin}
                      onEdit={() => { setSelected(emp); setModal("edit"); }}
                      onReset={() => { setSelected(emp); setModal("reset"); }}
                      onDelete={() => handleDelete(emp)} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Staff ── */}
            {staff.length > 0 && (
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: "linear-gradient(145deg,#EFF6FF,#DBEAFE)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#1D4ED8",
                  }}>
                    <User size={13} />
                  </div>
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#0D1117" }}>
                    ພະນັກງານ
                  </span>
                  <span style={{
                    background: "#EFF6FF", border: "1px solid #BFDBFE",
                    borderRadius: 999, padding: "1px 8px",
                    fontSize: "0.7rem", color: "#1D4ED8", fontWeight: 700,
                  }}>
                    {staff.length}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                  {staff.map(emp => (
                    <EmployeeCard key={emp.id} emp={emp} me={me} isAdmin={isAdmin}
                      onEdit={() => { setSelected(emp); setModal("edit"); }}
                      onReset={() => { setSelected(emp); setModal("reset"); }}
                      onDelete={() => handleDelete(emp)} />
                  ))}
                </div>
              </section>
            )}

            {employees.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(13,17,23,0.06)", padding: "56px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px", background: "linear-gradient(145deg,#F4F6F9,#E5E9EF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCog size={22} color="#9CA3AF" />
                </div>
                <div style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>ຍັງບໍ່ມີຂໍ້ມູນພະນັກງານ</div>
              </div>
            )}
          </div>
        )}
      </main>

      {modal === "add"   && <AddModal onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {modal === "edit"  && selected && <EditModal employee={selected} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {modal === "reset" && selected && <ResetPwdModal employee={selected} onClose={() => setModal(null)} />}
    </>
  );
}

/* ─ Employee Card ─────────────────────────────────────────── */
function EmployeeCard({
  emp, me, isAdmin, onEdit, onReset, onDelete,
}: {
  emp: Employee;
  me: { id: number; role: string; name?: string } | null;
  isAdmin: boolean;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const isSelf   = me?.id === emp.id;
  const isAdminRole = emp.role === "Admin";

  const avatarStyle = isAdminRole
    ? { bg: "linear-gradient(145deg,#FEF3C7,#FDE68A)", border: "#FCD34D", color: "#D97706" }
    : { bg: "linear-gradient(145deg,#EDE9FE,#DDD6FE)", border: "#C4B5FD", color: "#7C3AED" };

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)",
      padding: "18px 20px",
      transition: "box-shadow 0.22s, transform 0.22s",
      borderLeft: `3px solid ${isAdminRole ? "#FCD34D" : "#C4B5FD"}`,
      position: "relative",
    }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, {
        boxShadow: "0 8px 24px rgba(13,17,23,0.09), 0 2px 6px rgba(13,17,23,0.04)", transform: "translateY(-2px)",
      })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, {
        boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)", transform: "translateY(0)",
      })}
    >
      {/* "You" badge */}
      {isSelf && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "#F0FDF4", border: "1px solid #86EFAC",
          borderRadius: 999, padding: "2px 8px",
          fontSize: "0.65rem", color: "#15803D", fontWeight: 700,
        }}>
          ຕົວທ່ານເອງ
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: avatarStyle.bg, border: `2px solid ${avatarStyle.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", fontWeight: 800, color: avatarStyle.color,
        }}>
          {emp.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "#0D1117", fontSize: "0.9rem", lineHeight: 1.2 }}>
            {emp.name}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>
            @{emp.username}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Role badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 999,
          background: isAdminRole ? "#FFFBEB" : "#EFF6FF",
          border: `1px solid ${isAdminRole ? "#FDE68A" : "#BFDBFE"}`,
          color: isAdminRole ? "#D97706" : "#1D4ED8",
          fontSize: "0.72rem", fontWeight: 700,
        }}>
          {isAdminRole ? <Shield size={11}/> : <User size={11}/>}
          {isAdminRole ? "Admin" : "Employee"}
        </span>

        {/* Action buttons (Admin only) */}
        {isAdmin && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ padding: "6px 8px", color: "#3B82F6" }} title="ແກ້ໄຂ">
              <Edit2 size={13} />
            </button>
            <button onClick={onReset} className="btn btn-ghost btn-sm" style={{ padding: "6px 8px", color: "#F59E0B" }} title="ຣີເຊັດລະຫັດຜ່ານ">
              <KeyRound size={13} />
            </button>
            {!isSelf && (
              <button onClick={onDelete} className="btn btn-ghost btn-sm" style={{ padding: "6px 8px", color: "#EF4444" }} title="ລຶບ">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Joined date */}
      <div style={{ fontSize: "0.68rem", color: "#C4C9D4", marginTop: 10 }}>
        ເຂົ້າຮ່ວມ: {new Date(emp.created_at).toLocaleDateString("lo-LA", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}
