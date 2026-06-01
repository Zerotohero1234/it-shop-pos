"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Banknote, Send, X, Check, Package, ScanLine,
} from "lucide-react";
import Header from "@/components/Header";
import { productsApi, customersApi, salesApi, BASE_URL_STATIC } from "@/lib/api";
import { Product, Customer, CartItem } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import BarcodeScanner from "@/components/BarcodeScanner";
import ReceiptModal, { ReceiptData, printReceipt } from "@/components/ReceiptModal";

function formatKip(n: number) { return n.toLocaleString() + " ₭"; }

export default function POSPage() {
  const [products,         setProducts]         = useState<Product[]>([]);
  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [productSearch,    setProductSearch]    = useState("");
  const [cart,             setCart]             = useState<CartItem[]>([]);
  const [payment,          setPayment]          = useState<"cash" | "transfer">("cash");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [delivery,         setDelivery]         = useState(false);
  const [deliveryAddress,  setDeliveryAddress]  = useState("");
  const [processing,       setProcessing]       = useState(false);
  const [success,          setSuccess]          = useState(false);
  const [receiptData,      setReceiptData]      = useState<ReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [scannerOpen,      setScannerOpen]      = useState(false);
  const { showToast } = useToast();
  const { user }      = useAuth();

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([productsApi.getAll(), customersApi.getAll()]);
      setProducts(pRes.data.data   || []);
      setCustomers(cRes.data.data  || []);
    } catch { showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error"); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = products.filter(p =>
    p.stock > 0 &&
    (productSearch === "" ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(productSearch.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) { showToast("ສິນຄ້າໃນສາງບໍ່ພຽງພໍ", "error"); return prev; }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev =>
      prev.map(i => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) =>
    setCart(prev => prev.filter(i => i.product.id !== productId));

  const handleBarcodeDetected = useCallback((code: string) => {
    // Exact SKU match (case-insensitive fallback)
    const found = products.find(p =>
      p.sku === code || p.sku?.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      showToast(`ບໍ່ພົບສິນຄ້າ: ${code}`, "error");
      return;
    }
    if (found.stock === 0) {
      showToast(`${found.name}: ໝົດສາງ`, "error");
      return;
    }
    const inCart = cart.find(i => i.product.id === found.id);
    if (inCart && inCart.quantity >= found.stock) {
      showToast(`${found.name}: ສາງບໍ່ພຽງພໍ`, "error");
      return;
    }
    addToCart(found);
    showToast(`+1  ${found.name}`, "success");
  }, [products, cart, addToCart, showToast]);

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0)               { showToast("ກະລຸນາເລືອກສິນຄ້າກ່ອນ", "error"); return; }
    if (delivery && !deliveryAddress)    { showToast("ກະລຸນາໃສ່ທີ່ຢູ່ຈັດສົ່ງ", "error"); return; }
    setProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id,
        payment_method: payment,
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        ...(delivery && { delivery: { address: deliveryAddress } }),
      };
      const res    = await salesApi.create(payload);
      const saleData = res.data.data ?? {};
      const saleId   = saleData.id ?? saleData.sale_id;

      // Build receipt data from current cart (no extra API call needed)
      const receipt: ReceiptData = {
        invoice_number:   saleData.invoice_number ?? `#${saleId}`,
        sale_id:          saleId,
        created_at:       new Date().toISOString(),
        customer_name:    selectedCustomer?.name ?? null,
        user_name:        user?.name ?? null,
        payment_method:   payment,
        items: cart.map(i => ({
          product_name: i.product.name,
          sku:          i.product.sku ?? null,
          quantity:     i.quantity,
          unit_price:   i.product.price,
          subtotal:     i.product.price * i.quantity,
        })),
        total,
        has_delivery:     delivery && !!deliveryAddress,
        delivery_address: delivery ? deliveryAddress : null,
      };
      setReceiptData(receipt);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally { setProcessing(false); }
  };

  const resetPOS = () => {
    setCart([]); setSelectedCustomer(null); setDelivery(false);
    setDeliveryAddress(""); setPayment("cash");
    setSuccess(false); setReceiptData(null); setShowReceiptModal(false);
    load();
  };

  /* ── Success Screen ────────────────────────────────────────── */
  if (success && receiptData) {
    return (
      <>
        <Header title="ຂາຍສິນຄ້າ (POS)" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "#F4F6F9" }}>
          <div style={{ textAlign: "center", maxWidth: 480, width: "100%" }}>

            {/* Success animation */}
            <div style={{
              width: 84, height: 84, borderRadius: "50%",
              background: "linear-gradient(145deg,#F0FDF8,#DCFCE7)",
              border: "2.5px solid #86EFAC",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px", animation: "scaleIn 0.4s cubic-bezier(0.22,1,0.36,1)",
            }}>
              <Check size={36} color="#059669" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.7rem", color: "#0D1117", marginBottom: 6, letterSpacing: "-0.03em" }}>
              ຂາຍສຳເລັດ!
            </h2>
            <p style={{ color: "#9CA3AF", marginBottom: 24, fontSize: "0.875rem" }}>
              {receiptData.invoice_number} · ສ້າງສຳເລັດແລ້ວ
            </p>

            {/* Receipt summary card */}
            <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 12px rgba(13,17,23,0.08)", padding: "22px 28px", marginBottom: 20, borderTop: "3px solid #F59E0B", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>ຍອດລວມທັງໝົດ</div>
                  <div className="price" style={{ fontSize: "2.1rem", color: "#F59E0B", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
                    {receiptData.total.toLocaleString()} ₭
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>ວິທີຊຳລະ</div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0D1117" }}>
                    {receiptData.payment_method === "cash" ? "💵 ເງິນສົດ" : "💳 ໂອນເງິນ"}
                  </div>
                </div>
              </div>
              {/* Item list mini */}
              <div style={{ borderTop: "1px solid #F0F2F5", paddingTop: 14 }}>
                {receiptData.items.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
                    <span style={{ color: "#6B7280" }}>{item.product_name} × {item.quantity}</span>
                    <span className="price" style={{ fontWeight: 700, color: "#0D1117" }}>{item.subtotal.toLocaleString()} ₭</span>
                  </div>
                ))}
                {receiptData.items.length > 3 && (
                  <div style={{ fontSize: "0.76rem", color: "#9CA3AF", marginTop: 4 }}>... ແລະ {receiptData.items.length - 3} ລາຍການ</div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowReceiptModal(true)}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "1.5px solid #BFDBFE",
                  background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: "#1D4ED8",
                  fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { transform: "translateY(-1px)", boxShadow: "0 4px 14px rgba(37,99,235,0.2)" })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { transform: "translateY(0)", boxShadow: "none" })}
              >
                🖨️ ພິມໃບບິນ
              </button>
              <button
                onClick={resetPOS}
                className="btn btn-primary btn-lg"
                style={{ flex: 1, padding: "14px", fontSize: "0.92rem" }}
              >
                <Check size={16} />
                ສຳເລັດ
              </button>
            </div>

            {/* Quick print without modal */}
            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => printReceipt(receiptData, "80mm")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E9EF", background: "#fff", fontSize: "0.75rem", color: "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
                🖨️ ພິມ 80mm ທັນທີ
              </button>
              <button onClick={() => printReceipt(receiptData, "a4")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E9EF", background: "#fff", fontSize: "0.75rem", color: "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
                📄 ພິມ A4 ທັນທີ
              </button>
            </div>
          </div>
        </div>

        {/* Receipt preview modal */}
        {showReceiptModal && (
          <ReceiptModal data={receiptData} onClose={() => setShowReceiptModal(false)} />
        )}

        <style>{`@keyframes scaleIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      </>
    );
  }

  /* ── Main POS Layout ────────────────────────────────────────── */
  return (
    <>
      <Header title="ຂາຍສິນຄ້າ (POS)" subtitle="ລະບົບ Point of Sale" />

      <div className="page-enter" style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 58px)" }}>

        {/* ════ LEFT — Products ════ */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", borderRight: "1px solid #F0F2F5" }}>
          {/* Search + Scan */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                type="text" value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="ຄົ້ນຫາສິນຄ້າ..."
                className="search-input"
              />
            </div>
            {/* Barcode scan button */}
            <button
              onClick={() => setScannerOpen(true)}
              title="ສະແກນ Barcode"
              style={{
                flexShrink: 0,
                width: 42, height: 42,
                borderRadius: 10,
                border: "1.5px solid #E5E9EF",
                background: "#fff",
                color: "#6B7280",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(13,17,23,0.05)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: "#FFFBEB", borderColor: "#FCD34D", color: "#D97706",
                boxShadow: "0 0 0 3px rgba(251,191,36,0.15)",
              })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: "#fff", borderColor: "#E5E9EF", color: "#6B7280",
                boxShadow: "0 1px 3px rgba(13,17,23,0.05)",
              })}
            >
              <ScanLine size={17} strokeWidth={2} />
            </button>
          </div>

          {/* Product grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
            {filteredProducts.map(p => {
              const inCart = cart.find(i => i.product.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  style={{
                    background: inCart ? "rgba(245,158,11,0.04)" : "#fff",
                    border: `1.5px solid ${inCart ? "rgba(245,158,11,0.4)" : "#E5E9EF"}`,
                    borderRadius: 14,
                    boxShadow: inCart
                      ? "0 4px 16px rgba(245,158,11,0.12)"
                      : "0 1px 3px rgba(13,17,23,0.05)",
                    padding: "16px",
                    cursor: "pointer",
                    position: "relative",
                    userSelect: "none",
                    transition: "all 0.16s ease",
                  }}
                  onMouseEnter={e => {
                    if (!inCart) Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 4px 12px rgba(13,17,23,0.09)", transform: "translateY(-1px)" });
                  }}
                  onMouseLeave={e => {
                    if (!inCart) Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 1px 3px rgba(13,17,23,0.05)", transform: "translateY(0)" });
                  }}
                >
                  {/* Cart badge */}
                  {inCart && (
                    <div style={{
                      position: "absolute", top: 9, right: 9,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#F59E0B", color: "#fff",
                      fontSize: "0.68rem", fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
                    }}>
                      {inCart.quantity}
                    </div>
                  )}

                  {/* Product image / icon */}
                  <div style={{
                    width: "100%", height: 96, borderRadius: 10,
                    overflow: "hidden", marginBottom: 12,
                    background: "linear-gradient(145deg,#F4F6F9,#E5E9EF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${BASE_URL_STATIC}${p.image_url}`}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={e => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.style.display = "none";
                          (el.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                        }}
                      />
                    ) : null}
                    <div style={{
                      display: p.image_url ? "none" : "flex",
                      alignItems: "center", justifyContent: "center",
                      width: "100%", height: "100%",
                      color: "#9CA3AF",
                    }}>
                      <Package size={22} />
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, color: "#0D1117", fontSize: "0.85rem", marginBottom: 3, lineHeight: 1.3 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginBottom: 10, fontFamily: "JetBrains Mono, monospace" }}>
                    {p.sku || p.category_name || ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="price" style={{ color: "#F59E0B", fontWeight: 700, fontSize: "0.9rem" }}>
                      {p.price.toLocaleString()} ₭
                    </span>
                    <span style={{
                      fontSize: "0.7rem",
                      color: p.low_stock ? "#EF4444" : "#9CA3AF",
                      background: p.low_stock ? "#FEF2F2" : "#F4F6F9",
                      padding: "1px 6px", borderRadius: 5,
                    }}>
                      {p.low_stock ? "⚠ " : ""}{p.stock}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px", color: "#9CA3AF", fontSize: "0.875rem" }}>
                ບໍ່ພົບສິນຄ້າ
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT — Cart ════ */}
        <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", overflowY: "auto", background: "#fff" }}>

          {/* Cart header */}
          <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: cart.length > 0 ? "linear-gradient(145deg,#FEF9EC,#FEF3C7)" : "#F4F6F9",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: cart.length > 0 ? "#D97706" : "#9CA3AF",
                transition: "all 0.2s",
              }}>
                <ShoppingCart size={15} />
              </div>
              <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#0D1117" }}>
                ກະຕ່າ
              </span>
              {cart.length > 0 && (
                <span style={{
                  background: "#F59E0B", color: "#fff",
                  borderRadius: 999, padding: "1px 8px",
                  fontSize: "0.7rem", fontWeight: 700,
                  boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
                }}>
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: "#9CA3AF" }}>
                <ShoppingCart size={34} style={{ margin: "0 auto 14px", opacity: 0.18 }} />
                <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>ກະຕ່າຫວ່າງ</div>
                <div style={{ fontSize: "0.75rem", marginTop: 4, opacity: 0.7 }}>ກົດທີ່ສິນຄ້າເພື່ອເພີ່ມ</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cart.map(item => (
                  <div key={item.product.id} className="cart-item">

                    {/* ── Top row: thumbnail + name/price + remove ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                      {/* Product image thumbnail */}
                      <div style={{
                        width: 46, height: 46, borderRadius: 9, flexShrink: 0,
                        overflow: "hidden",
                        background: "linear-gradient(145deg,#F4F6F9,#E5E9EF)",
                        border: "1px solid #E5E9EF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                      }}>
                        {item.product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${BASE_URL_STATIC}${item.product.image_url}`}
                            alt={item.product.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={e => {
                              const el = e.currentTarget as HTMLImageElement;
                              el.style.display = "none";
                              (el.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                            }}
                          />
                        ) : null}
                        <div style={{
                          display: item.product.image_url ? "none" : "flex",
                          alignItems: "center", justifyContent: "center",
                          width: "100%", height: "100%",
                          color: "#C1C9D4",
                          position: "absolute", inset: 0,
                        }}>
                          <Package size={18} />
                        </div>
                      </div>

                      {/* Name + unit price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "0.82rem", fontWeight: 600, color: "#0D1117",
                          marginBottom: 2, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {item.product.name}
                        </div>
                        {item.product.sku && (
                          <div style={{ fontSize: "0.68rem", color: "#C1C9D4", fontFamily: "JetBrains Mono, monospace", marginBottom: 2 }}>
                            {item.product.sku}
                          </div>
                        )}
                        <div className="price" style={{ fontSize: "0.74rem", color: "#F59E0B", fontWeight: 600 }}>
                          {formatKip(item.product.price)}
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        style={{
                          background: "none", border: "none", color: "#CBD5E1",
                          cursor: "pointer", padding: 3, flexShrink: 0,
                          borderRadius: 5, transition: "color 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* ── Bottom row: qty stepper + subtotal ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingLeft: 56 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                        <button
                          onClick={() => updateQty(item.product.id, -1)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", borderRadius: "7px 0 0 7px", border: "1.5px solid #E5E9EF", borderRight: "none" }}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="price" style={{
                          width: 36, textAlign: "center",
                          fontSize: "0.85rem", fontWeight: 700, color: "#0D1117",
                          background: "#F9FAFB", border: "1.5px solid #E5E9EF",
                          padding: "4px 0", display: "inline-block",
                        }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.product.id, 1)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", borderRadius: "0 7px 7px 0", border: "1.5px solid #E5E9EF", borderLeft: "none" }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="price" style={{ fontSize: "0.88rem", color: "#0D1117", fontWeight: 700 }}>
                        {formatKip(item.product.price * item.quantity)}
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout section */}
          <div style={{ padding: "16px", borderTop: "1px solid #F3F4F6", background: "#FAFBFC" }}>

            {/* Customer select */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.74rem", color: "#6B7280", marginBottom: 6, fontWeight: 600, letterSpacing: "0.02em" }}>
                ລູກຄ້າ (ເລືອກໄດ້)
              </label>
              <select
                value={selectedCustomer?.id || ""}
                onChange={e => {
                  const c = customers.find(c => c.id === Number(e.target.value));
                  setSelectedCustomer(c || null);
                }}
                className="input-field"
                style={{ fontSize: "0.82rem" }}
              >
                <option value="">ລູກຄ້າທົ່ວໄປ</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </select>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.74rem", color: "#6B7280", marginBottom: 6, fontWeight: 600, letterSpacing: "0.02em" }}>
                ວິທີຊຳລະ
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["cash", "transfer"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayment(m)}
                    style={{
                      padding: "10px",
                      borderRadius: 9,
                      border: `1.5px solid ${payment === m ? "rgba(245,158,11,0.5)" : "#E5E9EF"}`,
                      background: payment === m ? "rgba(245,158,11,0.07)" : "#fff",
                      color: payment === m ? "#D97706" : "#6B7280",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      fontSize: "0.8rem", fontWeight: 600,
                      transition: "all 0.18s",
                      fontFamily: "inherit",
                      boxShadow: payment === m ? "0 2px 8px rgba(245,158,11,0.15)" : "none",
                    }}
                  >
                    {m === "cash" ? <Banknote size={14} /> : <CreditCard size={14} />}
                    {m === "cash" ? "ເງິນສົດ" : "ໂອນ"}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery toggle */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div
                  onClick={() => setDelivery(!delivery)}
                  style={{
                    width: 38, height: 21, borderRadius: 11,
                    background: delivery ? "#F59E0B" : "#E5E9EF",
                    position: "relative", transition: "background 0.22s", cursor: "pointer", flexShrink: 0,
                    boxShadow: delivery ? "0 2px 8px rgba(245,158,11,0.3)" : "none",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: delivery ? 19 : 3,
                    width: 15, height: 15, borderRadius: "50%",
                    background: "#fff", transition: "left 0.22s",
                    boxShadow: "0 1px 4px rgba(13,17,23,0.2)",
                  }} />
                </div>
                <span style={{ fontSize: "0.8rem", color: delivery ? "#0D1117" : "#9CA3AF", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                  <Send size={13} />
                  ຈັດສົ່ງ
                </span>
              </label>
              {delivery && (
                <textarea
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="ທີ່ຢູ່ຈັດສົ່ງ..."
                  rows={2}
                  className="input-field"
                  style={{ marginTop: 8, resize: "none", fontSize: "0.82rem" }}
                />
              )}
            </div>

            {/* Total */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 0", borderTop: "1px solid #F3F4F6", marginBottom: 14,
            }}>
              <span style={{ fontSize: "0.82rem", color: "#9CA3AF", fontWeight: 500 }}>ຍອດລວມ</span>
              <span className="price" style={{ fontSize: "1.5rem", color: "#F59E0B", fontWeight: 800, letterSpacing: "-0.04em" }}>
                {formatKip(total)}
              </span>
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={processing || cart.length === 0}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", opacity: cart.length === 0 ? 0.5 : 1 }}
            >
              {processing ? (
                <>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                  ກຳລັງດຳເນີນການ...
                </>
              ) : (
                <>
                  <Check size={17} />
                  ຢືນຢັນການຂາຍ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>

      {/* ── Barcode Scanner Modal ── */}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
