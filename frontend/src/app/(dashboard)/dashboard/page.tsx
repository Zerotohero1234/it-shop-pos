"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, ShoppingCart, Package, Truck,
  AlertTriangle, ArrowUpRight, DollarSign, Users,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import Header from "@/components/Header";
import { reportsApi, salesApi, productsApi, deliveriesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/* ── helpers ── */
function formatKip(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

interface TooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string; }
function ChartTip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E9EF", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(13,17,23,0.1)" }}>
      <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginBottom: 4 }}>{label}</div>
      <div className="price" style={{ fontSize: "1rem", fontWeight: 700, color: "#F59E0B" }}>
        {formatKip(payload[0].value)} ₭
      </div>
    </div>
  );
}

/* ── stat card ── */
interface Stat { label: string; value: string|number; sub?: string; accent: string; icon: React.ReactNode; trend?: string; }
const ACCENTS: Record<string,{ top:string; iconBg:string; iconColor:string; trendBg:string; trendColor:string }> = {
  amber:  { top:"#F59E0B", iconBg:"linear-gradient(145deg,#FEF9EC,#FEF3C7)", iconColor:"#D97706", trendBg:"#FFFBEB", trendColor:"#92400E" },
  cyan:   { top:"#0EA5E9", iconBg:"linear-gradient(145deg,#F0FAFF,#E0F2FE)", iconColor:"#0284C7", trendBg:"#EFF6FF", trendColor:"#1D4ED8" },
  green:  { top:"#10B981", iconBg:"linear-gradient(145deg,#F0FDF8,#DCFCE7)", iconColor:"#059669", trendBg:"#F0FDF4", trendColor:"#15803D" },
  purple: { top:"#8B5CF6", iconBg:"linear-gradient(145deg,#FAF5FF,#EDE9FE)", iconColor:"#7C3AED", trendBg:"#FAF5FF", trendColor:"#6D28D9" },
};

function StatCard({ s }: { s: Stat }) {
  const c = ACCENTS[s.accent] ?? ACCENTS.amber;
  return (
    <div style={{
      background: "#fff", borderRadius: 18,
      boxShadow: "0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)",
      padding: "22px 24px",
      borderTop: `3px solid ${c.top}`,
      transition: "box-shadow 0.22s, transform 0.22s",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow:"0 8px 24px rgba(13,17,23,0.09), 0 2px 6px rgba(13,17,23,0.04)", transform:"translateY(-2px)" })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow:"0 2px 8px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)", transform:"translateY(0)" })}
    >
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: 16 }}>
        {/* Icon */}
        <div style={{ width:42, height:42, borderRadius:11, background:c.iconBg, display:"flex", alignItems:"center", justifyContent:"center", color:c.iconColor, flexShrink:0 }}>
          {s.icon}
        </div>
        {/* Trend */}
        {s.trend && (
          <div style={{ display:"flex", alignItems:"center", gap:3, padding:"3px 8px", borderRadius:999, background:c.trendBg, fontSize:"0.68rem", color:c.trendColor, fontWeight:700, border:`1px solid ${c.top}30` }}>
            <ArrowUpRight size={10} />
            {s.trend}
          </div>
        )}
      </div>

      <div className="price" style={{ fontSize:"2rem", fontWeight:800, color:"#0D1117", letterSpacing:"-0.04em", lineHeight:1, marginBottom:6 }}>
        {s.value}
      </div>
      <div style={{ fontSize:"0.82rem", color:"#6B7280", fontWeight:500 }}>{s.label}</div>
      {s.sub && <div style={{ fontSize:"0.7rem", color:"#9CA3AF", marginTop:5 }}>{s.sub}</div>}

      {/* Decorative circle */}
      <div style={{
        position:"absolute", bottom:-20, right:-20,
        width:80, height:80, borderRadius:"50%",
        background: `${c.top}10`,
        pointerEvents:"none",
      }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<Array<{ date:string; revenue:number }>>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Array<{
    id:number; total:number; payment_method:string;
    payment_status:string; customer_name?:string;
  }>>([]);
  const [stats, setStats] = useState({ revenue:0, orders:0, deliveries:0, products:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [daily, lowStock, salesRes, prodRes, delivRes] = await Promise.all([
          reportsApi.daily({ days: 7 }),
          reportsApi.lowStock(),
          salesApi.getAll({ limit: 6 }),
          productsApi.getAll(),
          deliveriesApi.getAll({ status: "Pending" }),
        ]);
        const d = daily.data.data ?? [];
        const last = d[d.length - 1];
        setChartData(d.map((r: { date: string; total_revenue: number }) => ({
          date: r.date ? new Date(r.date).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }) : "",
          revenue: r.total_revenue,
        })));
        setStats({
          revenue:   last?.total_revenue ?? 0,
          orders:    last?.total_sales ?? 0,
          deliveries:(delivRes.data.data ?? []).length,
          products:  (prodRes.data.data ?? []).length,
        });
        setLowStockCount(lowStock.data.data?.length ?? 0);
        setRecentSales((salesRes.data.data ?? []).slice(0, 6));
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const statCards: Stat[] = [
    { label:"ລາຍໄດ້ວັນນີ້",    value:`${formatKip(stats.revenue)} ₭`, accent:"amber",  icon:<DollarSign size={18}/>,  trend:"+12%" },
    { label:"ຄຳສັ່ງຊື້",       value:stats.orders,     sub:"ລາຍການ",     accent:"cyan",   icon:<ShoppingCart size={18}/> },
    { label:"ສິນຄ້າທັງໝົດ",    value:stats.products,   sub:lowStockCount>0 ? `⚠ ${lowStockCount} ໃກ້ໝົດ` : "ສາງປົກກະຕິ", accent:"green",  icon:<Package size={18}/> },
    { label:"ລໍຖ້າຈັດສົ່ງ",   value:stats.deliveries, sub:"ລາຍການ",     accent:"purple", icon:<Truck size={18}/> },
  ];

  return (
    <>
      <Header title="ແດດບອດ" subtitle={`ຍິນດີຕ້ອນຮັບ, ${user?.name ?? "ຜູ້ໃຊ້"} 👋`} />

      <main className="page-enter" style={{ flex:1, padding:"28px 28px 40px", overflowY:"auto" }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom:28, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:"0.67rem", fontWeight:700, letterSpacing:"0.1em", color:"#F59E0B", textTransform:"uppercase", marginBottom:4 }}>
              ພາບລວມທຸລະກິດ
            </p>
            <h2 style={{fontWeight:800, fontSize:"1.55rem", color:"#0D1117", letterSpacing:"-0.03em", lineHeight:1.1 }}>
              ສະຖິຕິ 7 ວັນ
            </h2>
          </div>
          <a href="/reports" style={{
            display:"flex", alignItems:"center", gap:5,
            padding:"7px 14px", borderRadius:9,
            background:"#fff", border:"1px solid #E5E9EF",
            color:"#6B7280", fontSize:"0.78rem", fontWeight:600,
            textDecoration:"none", boxShadow:"0 1px 3px rgba(13,17,23,0.05)",
            transition:"all 0.14s",
          }}>
            ເບິ່ງລາຍງານ <ArrowRight size={13} />
          </a>
        </div>

        {/* ── Stat grid ── */}
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:148 }} />)}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
            {statCards.map(s => <StatCard key={s.label} s={s} />)}
          </div>
        )}

        {/* ── Bento row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20, marginBottom:20 }}>

          {/* Chart */}
          <div style={{
            background:"#fff", borderRadius:18,
            boxShadow:"0 2px 8px rgba(13,17,23,0.06)",
            padding:"24px 28px",
          }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
              <div>
                <h3 style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"1rem", color:"#0D1117", marginBottom:3 }}>
                  ລາຍໄດ້ 7 ວັນ
                </h3>
                <p style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>ກີບ (KIP)</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, background:"#F0FDF4", border:"1px solid #86EFAC", fontSize:"0.68rem", color:"#15803D", fontWeight:700 }}>
                <TrendingUp size={10} />
                ແນວໂນ້ມ +
              </div>
            </div>

            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#F59E0B" stopOpacity={0.20} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#F0F2F5" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:"#9CA3AF", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#9CA3AF", fontSize:11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} width={40} />
                <Tooltip content={<ChartTip />} cursor={{ stroke:"#F59E0B", strokeWidth:1, strokeDasharray:"4 3" }} />
                <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2.5}
                  fill="url(#ag)" dot={false}
                  activeDot={{ fill:"#fff", r:5, stroke:"#F59E0B", strokeWidth:2.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent sales */}
          <div style={{ background:"#fff", borderRadius:18, boxShadow:"0 2px 8px rgba(13,17,23,0.06)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {/* header */}
            <div style={{ padding:"20px 22px 14px", borderBottom:"1px solid #F3F4F6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <h3 style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"0.9rem", color:"#0D1117" }}>
                ການຂາຍລ່າສຸດ
              </h3>
              <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:"0.65rem", fontWeight:700, color:"#15803D", background:"#F0FDF4", border:"1px solid #86EFAC", padding:"2px 8px", borderRadius:999 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:"#22C55E", display:"inline-block" }} />
                Live
              </span>
            </div>

            {/* rows */}
            <div style={{ flex:1, overflowY:"auto" }}>
              {recentSales.length === 0 ? (
                <div style={{ textAlign:"center", padding:"36px 0", color:"#9CA3AF", fontSize:"0.85rem" }}>ຍັງບໍ່ມີຂໍ້ມູນ</div>
              ) : recentSales.map((sale, i) => (
                <div key={sale.id} style={{
                  display:"flex", alignItems:"center", gap:11,
                  padding:"11px 22px",
                  borderBottom: i < recentSales.length-1 ? "1px solid #F7F9FB" : "none",
                  transition:"background 0.1s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background="#FAFBFC"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background="transparent"}
                >
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background:"linear-gradient(145deg,#FEF9EC,#FDE68A)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.65rem", fontWeight:800, color:"#D97706",
                    fontFamily:"JetBrains Mono, monospace",
                  }}>
                    #{sale.id}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.8rem", fontWeight:600, color:"#0D1117", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {sale.customer_name || "ລູກຄ້າທົ່ວໄປ"}
                    </div>
                    <div style={{ fontSize:"0.67rem", color:"#9CA3AF", marginTop:1 }}>
                      {sale.payment_method === "cash" ? "ເງິນສົດ" : "ໂອນ"}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div className="price" style={{ fontSize:"0.85rem", fontWeight:700, color:"#0D1117" }}>
                      {formatKip(Number(sale.total))} ₭
                    </div>
                    <span className={`badge ${sale.payment_status === "refunded" ? "status-returned" : "status-completed"}`}
                      style={{ fontSize:"0.6rem", padding:"1px 6px", marginTop:2, display:"inline-block" }}>
                      {sale.payment_status === "refunded" ? "ຄືນ" : "ສຳເລັດ"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Low-stock banner ── */}
        {lowStockCount > 0 && (
          <div style={{
            display:"flex", alignItems:"center", gap:14,
            padding:"16px 20px", borderRadius:14,
            background:"linear-gradient(135deg,#FFF5F5,#FFF)",
            border:"1px solid #FECACA",
            boxShadow:"0 2px 8px rgba(220,38,38,0.07)",
          }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(145deg,#FEE2E2,#FECACA)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <AlertTriangle size={16} color="#DC2626" />
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:"0.875rem", fontWeight:700, color:"#DC2626", marginBottom:2 }}>
                ສິນຄ້າໃກ້ໝົດ {lowStockCount} ລາຍການ
              </p>
              <p style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>
                ຕ່ຳກວ່າລະດັບຕ່ຳສຸດ —{" "}
                <a href="/products" style={{ color:"#F59E0B", textDecoration:"none", fontWeight:600 }}>ກວດສອບ →</a>
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
