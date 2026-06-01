"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Monitor, Lock, User, ArrowRight, Zap, Package, BarChart3, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username: string; password: string }>({
    username: "",
    password: "",
  });
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  const validate = () => {
    const next = { username: "", password: "" };
    if (!username.trim()) next.username = "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້";
    if (!password)        next.password = "ກະລຸນາໃສ່ລະຫັດຜ່ານ";
    setErrors(next);
    return !next.username && !next.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(username, password);
      showToast("ເຂົ້າສູ່ລະບົບສຳເລັດ!", "success");
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap,      color: "#F59E0B", label: "ລະບົບ POS ຂາຍໄວ",              desc: "ຄິດໄລ່ ແລະ ອອກໃບຮັບເງິນທັນທີ" },
    { icon: Package,  color: "#0EA5E9", label: "ຄຸ້ມຄອງສາງສິນຄ້າ",            desc: "ຕິດຕາມ Stock Real-time" },
    { icon: BarChart3,color: "#10B981", label: "ລາຍງານ & ການວິເຄາະ",          desc: "ສະຖິຕິຍອດຂາຍລາຍວັນ/ລາຍເດືອນ" },
    { icon: Truck,    color: "#A855F7", label: "ຕິດຕາມການຈັດສົ່ງ",            desc: "ອັບເດດສະຖານະ Delivery" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F5F9",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle dot pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }}
      />

      {/* Amber glow top-left */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Cyan glow bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Left panel — branding */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          position: "relative",
          borderRight: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        {/* Logo mark */}
        <div style={{ marginBottom: 52 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 18px 8px 8px",
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid rgba(245,158,11,0.2)",
              boxShadow: "0 2px 12px rgba(245,158,11,0.1)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(245,158,11,0.35)",
              }}
            >
              <Monitor size={20} color="#FFFFFF" />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "#0F172A",
                }}
              >
                IT Shop
              </div>
              <div style={{ fontSize: "0.65rem", color: "#F59E0B", letterSpacing: "0.1em", fontWeight: 600 }}>
                POS SYSTEM
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 44 }}>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(2rem,4vw,3rem)",
              lineHeight: 1.15,
              color: "#0F172A",
              letterSpacing: "-0.02em",
              marginBottom: 16,
            }}
          >
            ລະບົບຈັດການ
            <br />
            <span
              style={{
                background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ຮ້ານ IT
            </span>{" "}
            <br />
            ທັນສະໄໝ
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#64748B",
              lineHeight: 1.75,
              maxWidth: 380,
            }}
          >
            ຄຸ້ມຄອງສິນຄ້າ, ຈັດການການຂາຍ, ຕິດຕາມການຈັດສົ່ງ ແລະ
            ລາຍງານທຸລະກິດ ໃນຮູບແບບດຽວ
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((f) => (
            <div
              key={f.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderRadius: 10,
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${f.color}18`,
                  border: `1px solid ${f.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <f.icon size={16} color={f.color} />
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0F172A" }}>
                  {f.label}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            fontSize: "0.7rem",
            color: "#CBD5E1",
            letterSpacing: "0.05em",
          }}
        >
          © 2026 IT Shop POS · ພາສາລາວ
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          width: 480,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 56px",
          position: "relative",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            width: "100%",
            animation: "pageEnter 0.5s ease forwards",
          }}
        >
          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                color: "#F59E0B",
                fontWeight: 700,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              ເຂົ້າສູ່ລະບົບ
            </div>
            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "1.75rem",
                color: "#0F172A",
                marginBottom: 8,
                letterSpacing: "-0.01em",
              }}
            >
              ຍິນດີຕ້ອນຮັບ 👋
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.6 }}>
              ໃສ່ຂໍ້ມູນເຂົ້າສູ່ລະບົບເພື່ອດຳເນີນການຕໍ່
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 8,
                }}
              >
                ຊື່ຜູ້ໃຊ້
              </label>
              <div style={{ position: "relative" }}>
                <User
                  size={15}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: errors.username ? "#EF4444" : "#94A3B8",
                    transition: "color 0.15s",
                  }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) setErrors(prev => ({ ...prev, username: "" }));
                  }}
                  onBlur={() => {
                    if (!username.trim()) setErrors(prev => ({ ...prev, username: "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້" }));
                  }}
                  placeholder="admin"
                  className="input-field"
                  style={{
                    paddingLeft: 40,
                    ...(errors.username && {
                      borderColor: "#EF4444",
                      background: "#FFF5F5",
                      boxShadow: "0 0 0 3px rgba(239,68,68,0.1)",
                    }),
                  }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.username && (
                <div style={{
                  marginTop: 6,
                  fontSize: "0.75rem",
                  color: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  animation: "fadeIn 0.2s ease",
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="#EF4444"/>
                    <path d="M6 3.5V6.5" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
                    <circle cx="6" cy="8.5" r="0.6" fill="#EF4444"/>
                  </svg>
                  {errors.username}
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 8,
                }}
              >
                ລະຫັດຜ່ານ
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: errors.password ? "#EF4444" : "#94A3B8",
                    transition: "color 0.15s",
                  }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: "" }));
                  }}
                  onBlur={() => {
                    if (!password) setErrors(prev => ({ ...prev, password: "ກະລຸນາໃສ່ລະຫັດຜ່ານ" }));
                  }}
                  placeholder="••••••••"
                  className="input-field"
                  style={{
                    paddingLeft: 40,
                    paddingRight: 40,
                    ...(errors.password && {
                      borderColor: "#EF4444",
                      background: "#FFF5F5",
                      boxShadow: "0 0 0 3px rgba(239,68,68,0.1)",
                    }),
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <div style={{
                  marginTop: 6,
                  fontSize: "0.75rem",
                  color: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  animation: "fadeIn 0.2s ease",
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="#EF4444"/>
                    <path d="M6 3.5V6.5" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
                    <circle cx="6" cy="8.5" r="0.6" fill="#EF4444"/>
                  </svg>
                  {errors.password}
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{
                width: "100%",
                opacity: loading ? 0.75 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "2.5px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#FFFFFF",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  ກຳລັງເຂົ້າສູ່ລະບົບ...
                </>
              ) : (
                <>
                  ເຂົ້າສູ່ລະບົບ
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="divider" style={{ margin: "28px 0" }} />

          {/* Demo credentials hint */}
          <div
            style={{
              background: "#F0F9FF",
              border: "1px solid #BAE6FD",
              borderRadius: 10,
              padding: "14px 16px",
              fontSize: "0.78rem",
              color: "#475569",
            }}
          >
            <div style={{ color: "#0EA5E9", fontWeight: 700, marginBottom: 6, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#0EA5E9", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800 }}>i</span>
              ຂໍ້ມູນທົດສອບ
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <span>
                username:{" "}
                <code className="price" style={{ color: "#0F172A", fontWeight: 600, fontSize: "0.82rem" }}>
                  admin
                </code>
              </span>
              <span>
                password:{" "}
                <code className="price" style={{ color: "#0F172A", fontWeight: 600, fontSize: "0.82rem" }}>
                  admin123
                </code>
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pageEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
