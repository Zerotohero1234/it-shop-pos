"use client";

import { useState, useEffect } from "react";
import { X, Printer, FileText } from "lucide-react";
import { SHOP_INFO } from "@/config/shop";

/* ══ Types ════════════════════════════════════════════════════ */
export interface ReceiptData {
  invoice_number: string;
  sale_id:        number;
  created_at:     string;
  customer_name:  string | null;
  user_name:      string | null;
  payment_method: "cash" | "transfer" | "card";
  items: Array<{
    product_name: string;
    sku?:         string | null;
    quantity:     number;
    unit_price:   number;
    subtotal:     number;
  }>;
  total:            number;
  has_delivery?:    boolean;
  delivery_address?: string | null;
}

export type PrintSize = "80mm" | "a4";

/* ══ Helpers ══════════════════════════════════════════════════ */
const PM_LAO: Record<string, string> = {
  cash: "ເງິນສົດ", transfer: "ໂອນເງິນ", card: "ບັດ",
};

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).replace(",", "");
}

/* ══ HTML Builders ════════════════════════════════════════════ */

/** 80mm thermal receipt — compact monospace layout */
function build80mm(d: ReceiptData): string {
  const date = fmtDate(d.created_at);
  const pm   = PM_LAO[d.payment_method] ?? d.payment_method;

  const itemRows = d.items.map(item => {
    const unit     = item.unit_price.toLocaleString();
    const subtotal = item.subtotal.toLocaleString();
    return `<tr>
      <td class="col-name">${item.product_name}</td>
      <td class="col-qty" style="text-align:center;">${item.quantity}</td>
      <td class="col-price" style="text-align:right;">${unit}</td>
      <td class="col-total" style="text-align:right;font-weight:bold;">${subtotal}</td>
    </tr>`;
  }).join("\n");

  const deliverySection = (d.has_delivery && d.delivery_address)
    ? `<div class="sep-dash"></div>
       <div class="info-row"><b>ການຈັດສົ່ງ:</b> ມີ</div>
       <div class="info-row"><b>ທີ່ຢູ່:</b> ${d.delivery_address}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${d.invoice_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; }
    .receipt-80mm {
      width: 72mm; max-width: 72mm; margin: 0 auto; padding: 4mm;
      font-family: 'Courier New', 'Noto Sans Lao', 'Lao Sangam MN', 'Leelawadee UI', monospace;
      font-size: 11px; line-height: 1.4; color: #000;
    }
    .shop-name     { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 2mm; }
    .shop-name-lao { text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 1mm; }
    .shop-contact  { text-align: center; font-size: 9px; color: #444; margin-bottom: 1mm; }
    .sep-solid { border-top: 2px solid #000; margin: 3mm 0; }
    .sep-dash  { border-top: 1px dashed #000; margin: 2mm 0; }
    .info-row  { margin-bottom: 1mm; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 9px; text-transform: uppercase; font-weight: bold; padding-bottom: 2mm; }
    td { vertical-align: top; padding: 1px 0; word-break: break-word; }
    .col-name  { width: 40%; }
    .col-qty   { width: 10%; }
    .col-price { width: 25%; }
    .col-total { width: 25%; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; }
    .total-sub { display: flex; justify-content: space-between; font-size: 10px; margin-top: 1mm; }
    .footer      { text-align: center; margin-top: 3mm; }
    .footer-main { font-size: 12px; font-weight: bold; }
    .footer-sub  { font-size: 9px; color: #555; margin-top: 1mm; }
  </style>
</head>
<body>
<div class="receipt-80mm">

  <!-- HEADER -->
  <div class="shop-name">${SHOP_INFO.name}</div>
  <div class="shop-name-lao">${SHOP_INFO.nameLao}</div>
  <div class="shop-contact">☎ ${SHOP_INFO.phone}</div>
  <div class="shop-contact">${SHOP_INFO.address}</div>
  ${SHOP_INFO.taxId ? `<div class="shop-contact">ເລກທີ່ພາສີ: ${SHOP_INFO.taxId}</div>` : ""}

  <div class="sep-solid"></div>

  <!-- BILL INFO -->
  <div class="info-row"><b>ເລກບິນ:</b> ${d.invoice_number}</div>
  <div class="info-row"><b>ວັນທີ:</b> ${date}</div>
  <div class="info-row"><b>ພະນັກງານ:</b> ${d.user_name || "—"}</div>
  ${d.customer_name ? `<div class="info-row"><b>ລູກຄ້າ:</b> ${d.customer_name}</div>` : ""}

  <div class="sep-dash"></div>

  <!-- ITEMS -->
  <table>
    <thead>
      <tr style="border-bottom:1px dashed #000;">
        <th class="col-name"  style="text-align:left;">ສິນຄ້າ</th>
        <th class="col-qty"   style="text-align:center;">ຈ</th>
        <th class="col-price" style="text-align:right;">ລາຄາ</th>
        <th class="col-total" style="text-align:right;">ລວມ</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="sep-dash"></div>

  <!-- TOTAL -->
  <div class="total-row">
    <span>ລວມທັງໝົດ:</span>
    <span>${d.total.toLocaleString()} ₭</span>
  </div>
  <div class="total-sub">
    <span>ວິທີຊຳລະ:</span><span>${pm}</span>
  </div>
  <div class="total-sub">
    <span>ສະຖານະ:</span><span>✓ ສຳເລັດ</span>
  </div>

  ${deliverySection}

  <div class="sep-solid"></div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-main">${SHOP_INFO.footer}</div>
    <div class="footer-sub">${SHOP_INFO.footerEn}</div>
  </div>

</div>
</body>
</html>`;
}

/** A4 professional invoice layout */
function buildA4(d: ReceiptData): string {
  const date = fmtDate(d.created_at);
  const pm   = PM_LAO[d.payment_method] ?? d.payment_method;

  const itemRows = d.items.map((item, i) => `
    <tr class="${i % 2 === 1 ? "row-alt" : ""}">
      <td class="td-num">${i + 1}</td>
      <td class="td-name">
        <span class="prod-name">${item.product_name}</span>
        ${item.sku ? `<br><span class="prod-sku">${item.sku}</span>` : ""}
      </td>
      <td class="td-qty">${item.quantity}</td>
      <td class="td-price">${item.unit_price.toLocaleString()}</td>
      <td class="td-sub">${item.subtotal.toLocaleString()}</td>
    </tr>`
  ).join("\n");

  const deliverySection = (d.has_delivery && d.delivery_address)
    ? `<div class="delivery-box">
         <div class="delivery-title">📦 ຂໍ້ມູນການຈັດສົ່ງ</div>
         <div class="delivery-addr"><b>ທີ່ຢູ່:</b> ${d.delivery_address}</div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${d.invoice_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 14mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Lao', 'Lao Sangam MN', 'Leelawadee UI', 'Segoe UI', Arial, sans-serif;
      font-size: 13px; color: #111; background: #fff;
    }
    .invoice { max-width: 174mm; margin: 0 auto; }

    /* ── Header ── */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 14px; border-bottom: 3px solid #1e3a5f; margin-bottom: 18px;
    }
    .hdr-left .shop-en  { font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #1e3a5f; }
    .hdr-left .shop-lao { font-size: 14px; font-weight: 700; color: #374151; margin-top: 3px; }
    .hdr-left .contact  { font-size: 11px; color: #6b7280; margin-top: 8px; line-height: 1.75; }
    .hdr-right { text-align: right; }
    .hdr-right .rcpt-title { font-size: 22px; font-weight: 900; color: #1e3a5f; letter-spacing: 0.5px; }
    .hdr-right .rcpt-sub   { font-size: 10px; color: #9ca3af; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
    .invoice-badge {
      display: inline-block; margin-top: 9px; padding: 5px 16px;
      background: #1e3a5f; border-radius: 6px;
      font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.3px;
    }
    .invoice-date { font-size: 11px; color: #6b7280; margin-top: 6px; }

    /* ── Info grid ── */
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;
    }
    .info-cell { padding: 10px 16px; }
    .info-cell:nth-child(odd)  { border-right: 1px solid #e5e7eb; }
    .info-cell:nth-child(n+3)  { border-top:  1px solid #e5e7eb; }
    .info-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.9px; color: #9ca3af; margin-bottom: 4px; }
    .info-value { font-size: 13px; font-weight: 600; color: #111; }
    .status-chip {
      display: inline-block; padding: 3px 12px; border-radius: 999px;
      background: #ecfdf5; border: 1.5px solid #86efac; color: #059669;
      font-weight: 700; font-size: 12px;
    }

    /* ── Items table ── */
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    thead tr { background: #1e3a5f; }
    thead th {
      padding: 11px 10px; font-size: 10.5px; font-weight: 700; color: #fff;
      text-transform: uppercase; letter-spacing: 0.6px;
    }
    .th-num   { width: 36px; text-align: center; }
    .th-name  { text-align: left; }
    .th-qty   { width: 56px; text-align: center; }
    .th-price { width: 108px; text-align: right; }
    .th-sub   { width: 108px; text-align: right; }
    tbody tr  { border-top: 1px solid #f3f4f6; }
    tbody tr:last-child { border-top: 1px solid #e5e7eb; }
    .row-alt  { background: #f9fafb; }
    td { padding: 9px 10px; font-size: 12.5px; vertical-align: top; }
    .td-num   { text-align: center; color: #9ca3af; font-size: 11px; padding-top: 11px; }
    .td-name  { }
    .td-qty   { text-align: center; }
    .td-price { text-align: right; }
    .td-sub   { text-align: right; font-weight: 700; }
    .prod-name { font-weight: 600; color: #111; }
    .prod-sku  { font-size: 10px; color: #9ca3af; margin-top: 2px; }

    /* ── Totals ── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
    .totals-box  {
      width: 260px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
    }
    .tot-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 16px; border-bottom: 1px solid #f3f4f6;
      font-size: 12.5px; color: #374151;
    }
    .tot-row:last-child { border-bottom: none; }
    .tot-row.grand {
      background: #1e3a5f; border-bottom: none;
      padding: 13px 16px;
    }
    .tot-row.grand .tot-key { font-size: 14px; font-weight: 700; color: #fff; }
    .tot-row.grand .tot-val { font-size: 18px; font-weight: 900; color: #fff; }

    /* ── Delivery ── */
    .delivery-box {
      margin-top: 16px; padding: 12px 16px;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
    }
    .delivery-title { font-size: 11px; font-weight: 700; color: #1d4ed8;
                      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .delivery-addr  { font-size: 13px; color: #1e40af; }

    /* ── Footer ── */
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px dashed #d1d5db; text-align: center; }
    .footer-main { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .footer-sub  { font-size: 11px; color: #9ca3af; }
    .footer-note { font-size: 9.5px; color: #d1d5db; margin-top: 8px; }
  </style>
</head>
<body>
<div class="invoice">

  <!-- HEADER -->
  <div class="header">
    <div class="hdr-left">
      <div class="shop-en">${SHOP_INFO.name}</div>
      <div class="shop-lao">${SHOP_INFO.nameLao}</div>
      <div class="contact">
        ☎&nbsp;${SHOP_INFO.phone}<br>
        📍&nbsp;${SHOP_INFO.address}
        ${SHOP_INFO.taxId ? `<br>ເລກທີ່ພາສີ:&nbsp;${SHOP_INFO.taxId}` : ""}
      </div>
    </div>
    <div class="hdr-right">
      <div class="rcpt-title">ໃບຮັບເງິນ</div>
      <div class="rcpt-sub">Receipt / Invoice</div>
      <div class="invoice-badge">${d.invoice_number}</div>
      <div class="invoice-date">${date}</div>
    </div>
  </div>

  <!-- INFO GRID -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">ພະນັກງານ</div>
      <div class="info-value">${d.user_name || "—"}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">ລູກຄ້າ</div>
      <div class="info-value">${d.customer_name || "ລູກຄ້າທົ່ວໄປ"}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">ວິທີຊຳລະ</div>
      <div class="info-value">${pm}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">ສະຖານະ</div>
      <div class="info-value"><span class="status-chip">✓ ສຳເລັດ</span></div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table>
    <thead>
      <tr>
        <th class="th-num">#</th>
        <th class="th-name">ສິນຄ້າ</th>
        <th class="th-qty">ຈຳນວນ</th>
        <th class="th-price">ລາຄາ/ໜ່ວຍ (₭)</th>
        <th class="th-sub">ລວມ (₭)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-wrap">
    <div class="totals-box">
      <div class="tot-row">
        <span class="tot-key">ວິທີຊຳລະ</span>
        <span class="tot-val">${pm}</span>
      </div>
      <div class="tot-row grand">
        <span class="tot-key">ລວມທັງໝົດ</span>
        <span class="tot-val">${d.total.toLocaleString()} ₭</span>
      </div>
    </div>
  </div>

  ${deliverySection}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-main">${SHOP_INFO.footer}</div>
    <div class="footer-sub">${SHOP_INFO.footerEn}</div>
    <div class="footer-note">ເອກະສານສ້າງໂດຍລະບົບ IT Shop POS · ${date}</div>
  </div>

</div>
</body>
</html>`;
}

/* ══ Main builder ══════════════════════════════════════════════ */
export function buildReceiptHTML(data: ReceiptData, size: PrintSize): string {
  return size === "a4" ? buildA4(data) : build80mm(data);
}

/* ══ Print utility ════════════════════════════════════════════ */
export function printReceipt(data: ReceiptData, size: PrintSize): void {
  const html = buildReceiptHTML(data, size);
  const w    = window.open("", "_blank", "width=520,height=760,scrollbars=yes,resizable=yes");
  if (!w) {
    alert("ກະລຸນາອະນຸຍາດ popup ໃນ browser ຂອງທ່ານ\n(Please allow popups for this site)");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  // Wait for Noto Sans Lao (Google Fonts) to fully load before printing,
  // then add a small buffer to ensure layout is finalised.
  if (w.document.fonts?.ready) {
    w.document.fonts.ready.then(() => {
      setTimeout(() => { w.print(); }, 200);
    });
  } else {
    // Fallback for browsers that don't support FontFaceSet
    setTimeout(() => { w.print(); }, 1000);
  }
}

/* ══ Modal Component ══════════════════════════════════════════ */
interface ReceiptModalProps {
  data:    ReceiptData;
  onClose: () => void;
}

export default function ReceiptModal({ data, onClose }: ReceiptModalProps) {
  const [size,        setSize]        = useState<PrintSize>("a4");
  const [previewHTML, setPreviewHTML] = useState<string>(() => buildReceiptHTML(data, "a4"));
  const [printing80,  setPrinting80]  = useState(false);
  const [printingA4,  setPrintingA4]  = useState(false);

  useEffect(() => {
    setPreviewHTML(buildReceiptHTML(data, size));
  }, [data, size]);

  function handlePrint(target: PrintSize) {
    if (target === "80mm") {
      setPrinting80(true);
      printReceipt(data, "80mm");
      setTimeout(() => setPrinting80(false), 1400);
    } else {
      setPrintingA4(true);
      printReceipt(data, "a4");
      setTimeout(() => setPrintingA4(false), 1400);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.55)", zIndex: 9999,
               display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 700,
        maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(13,17,23,0.28)",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F0F2F5",
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(145deg,#F0F9FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
              <Printer size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0D1117" }}>ພິມໃບບິນ</div>
              <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 1 }}>{data.invoice_number}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E5E9EF", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9CA3AF" }}>
            <X size={14} />
          </button>
        </div>

        {/* ── Preview tab selector ── */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #F0F2F5", flexShrink: 0,
                      display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.73rem", color: "#9CA3AF", fontWeight: 600, marginRight: 2 }}>ຕົວຢ່າງ:</span>
          {([
            { value: "80mm" as PrintSize, label: "80mm · Thermal", icon: "🖨️" },
            { value: "a4"   as PrintSize, label: "A4 · ເຈ້ຍ A4",   icon: "📄" },
          ]).map(opt => {
            const active = size === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSize(opt.value)}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.14s",
                  border: active ? "2px solid #2563EB" : "1.5px solid #E5E9EF",
                  background: active ? "#EFF6FF" : "#F9FAFB",
                  color: active ? "#1D4ED8" : "#6B7280",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: "0.85em" }}>{opt.icon}</span>
                {opt.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: "0.7rem", color: "#C1C9D4", display: "flex", alignItems: "center", gap: 4 }}>
            <FileText size={11} />
            ເບິ່ງຕົວຢ່າງ live
          </div>
        </div>

        {/* ── Preview (iframe) ── */}
        <div style={{ flex: 1, overflow: "auto", background: "#E5E9EF", padding: "16px", display: "flex", justifyContent: "center" }}>
          <div style={{
            background: "#fff", borderRadius: 4,
            boxShadow: "0 4px 24px rgba(13,17,23,0.18)",
            overflow: "hidden",
            width: size === "80mm" ? 320 : "100%",
            maxWidth: size === "80mm" ? 320 : "none",
            flexShrink: 0,
          }}>
            <iframe
              key={size}
              srcDoc={previewHTML}
              style={{
                width:  "100%",
                height: size === "80mm" ? 520 : 620,
                border: "none",
                display: "block",
              }}
              title="Receipt Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* ── Action bar ── */}
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #F0F2F5", flexShrink: 0, background: "#fff",
                      display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #E5E9EF", background: "#F9FAFB", color: "#6B7280", fontSize: "0.83rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            ປິດ
          </button>

          {/* 80mm print button */}
          <button
            onClick={() => handlePrint("80mm")}
            disabled={printing80 || printingA4}
            style={{
              flex: 1, padding: "11px", borderRadius: 10, fontFamily: "inherit", fontSize: "0.86rem", fontWeight: 700,
              border: "1.5px solid #D1D5DB",
              background: printing80 ? "#F3F4F6" : "#F9FAFB",
              color: printing80 ? "#9CA3AF" : "#374151",
              cursor: (printing80 || printingA4) ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "all 0.15s", opacity: printingA4 ? 0.5 : 1,
            }}
          >
            <Printer size={15} />
            {printing80 ? "ກຳລັງເປີດ..." : "ພິມ 80mm"}
          </button>

          {/* A4 print button */}
          <button
            onClick={() => handlePrint("a4")}
            disabled={printing80 || printingA4}
            style={{
              flex: 2, padding: "11px", borderRadius: 10, fontFamily: "inherit", fontSize: "0.92rem", fontWeight: 700,
              border: "none",
              background: (printing80 || printingA4) ? "#F3F4F6" : "linear-gradient(135deg,#2563EB,#1D4ED8)",
              color: (printing80 || printingA4) ? "#9CA3AF" : "#fff",
              cursor: (printing80 || printingA4) ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s", opacity: printing80 ? 0.5 : 1,
              boxShadow: (printing80 || printingA4) ? "none" : "0 4px 14px rgba(37,99,235,0.35)",
            }}
          >
            <Printer size={16} />
            {printingA4 ? "ກຳລັງເປີດ..." : "ພິມ A4"}
          </button>
        </div>
      </div>
    </div>
  );
}
