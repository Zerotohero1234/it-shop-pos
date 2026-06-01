"use client";

import { useEffect, useRef, useState } from "react";
import { X, Scan, Zap, AlertCircle } from "lucide-react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

/* ─── Helpers ───────────────────────────────────────────────── */

/**
 * Reliably stops the scanner AND releases the camera hardware.
 * Tries scanner.stop() first; if that throws (e.g. it was never
 * fully started), falls back to stopping the video tracks in the
 * scanner container directly so the camera LED always turns off.
 */
async function releaseScanner(
  scanner: Html5QrcodeType,
  containerId: string
) {
  try {
    await scanner.stop();
  } catch {
    // stop() can throw if scanning was never successfully started —
    // manually kill tracks inside the container as a fallback
    const container = document.getElementById(containerId);
    container?.querySelectorAll<HTMLVideoElement>("video").forEach(v => {
      (v.srcObject as MediaStream | null)
        ?.getTracks()
        .forEach(t => t.stop());
      v.srcObject = null;
    });
  }
  // Always clear the injected DOM so html5-qrcode won't complain
  // if the element is reused
  try { scanner.clear(); } catch { /* ignore */ }
}

/* ─── Types ────────────────────────────────────────────────────── */
interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef    = useRef<Html5QrcodeType | null>(null);
  const cooldownRef   = useRef<Map<string, number>>(new Map());
  const onDetectedRef = useRef(onDetected);

  const [status,   setStatus]   = useState<"init" | "scanning" | "error">("init");
  const [lastCode, setLastCode] = useState<string>("");
  const [errMsg,   setErrMsg]   = useState<string>("");
  const [flash,    setFlash]    = useState(false);

  // Keep callback ref fresh so the effect never needs to re-run
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    const ELEM_ID = "html5qr-scanner-elem";
    let mounted   = true;   // set false when cleanup fires

    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      // Component may already be unmounted by the time the dynamic import resolves
      if (!mounted) return;

      const scanner = new Html5Qrcode(ELEM_ID, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 300, height: 120 }, aspectRatio: 1.6 },

          /* ── onScanSuccess ── */
          (decodedText) => {
            if (!mounted) return;
            const now      = Date.now();
            const lastTime = cooldownRef.current.get(decodedText) ?? 0;
            if (now - lastTime < 2000) return;   // 2-second same-code cooldown
            cooldownRef.current.set(decodedText, now);
            setLastCode(decodedText);
            setFlash(true);
            setTimeout(() => setFlash(false), 500);
            onDetectedRef.current(decodedText);
          },

          /* ── onScanFailure (per-frame, silent) ── */
          () => {}
        );

        // start() succeeded — but maybe component was closed while it was starting
        if (!mounted) {
          await releaseScanner(scanner, ELEM_ID);
          return;
        }

        setStatus("scanning");

      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrMsg(
          /permission/i.test(msg)
            ? "ກະລຸນາອະນຸຍາດໃຊ້ກ້ອງ ແລ້ວລອງໃໝ່"
            : "ບໍ່ສາມາດເປີດກ້ອງໄດ້"
        );
        setStatus("error");
      }
    })();

    /* ── Cleanup ── */
    return () => {
      mounted = false;

      const scanner = scannerRef.current;
      if (scanner) {
        scannerRef.current = null;
        // releaseScanner is async but that's fine — fire-and-forget
        // so the camera light turns off even after the React tree is gone
        releaseScanner(scanner, ELEM_ID);
      }
    };
  }, []); // intentionally empty — run once on mount

  /* ─── JSX ──────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        #html5qr-scanner-elem video {
          border-radius: 0 !important;
          object-fit: cover !important;
          display: block !important;
          width: 100% !important;
        }
        /* hide the library's own header / select / buttons */
        #html5qr-scanner-elem > div:not(:first-child),
        #html5qr-scanner-elem img,
        #html5qr-scanner-elem span[id*="header"],
        #html5qr-scanner-elem select,
        #html5qr-scanner-elem button {
          display: none !important;
        }
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 82%; }
          100% { top: 10%; }
        }
        @keyframes pulseIcon {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(7,10,14,0.85)",
          backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}
      >
        {/* Card */}
        <div style={{
          background: "#0F172A",
          borderRadius: 22,
          width: "100%", maxWidth: 460,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
          animation: "modalIn 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}>

          {/* ── Header ── */}
          <div style={{
            padding: "18px 22px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(145deg,#FEF3C7,#FDE68A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#D97706",
                animation: status === "scanning" ? "pulseIcon 2s ease-in-out infinite" : "none",
              }}>
                <Scan size={17} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#F9FAFB", letterSpacing: "-0.02em" }}>
                  ສະແກນ Barcode
                </div>
                <div style={{ fontSize: "0.67rem", color: "#6B7280", marginTop: 1 }}>
                  {status === "init"     && "ກຳລັງເປີດກ້ອງ..."}
                  {status === "scanning" && "ຊີ້ Barcode ເຂົ້າໃນກ່ອງ"}
                  {status === "error"    && "ເກີດຂໍ້ຜິດພາດ"}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9CA3AF", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Camera area ── */}
          <div style={{ position: "relative", background: "#000", minHeight: 260, overflow: "hidden" }}>

            {/* html5-qrcode target — always present so the lib has a stable DOM node */}
            <div id="html5qr-scanner-elem" style={{ width: "100%" }} />

            {/* Spinner overlay (init) */}
            {status === "init" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
                background: "#0F172A",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "3px solid rgba(245,158,11,0.15)",
                  borderTopColor: "#F59E0B",
                  animation: "spin 0.8s linear infinite",
                }} />
                <div style={{ color: "#4B5563", fontSize: "0.8rem" }}>ກຳລັງເປີດກ້ອງ...</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Error overlay */}
            {status === "error" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 14,
                background: "#0F172A", padding: 32,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "rgba(239,68,68,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <AlertCircle size={24} color="#EF4444" />
                </div>
                <div style={{ color: "#F9FAFB", fontWeight: 600, fontSize: "0.9rem", textAlign: "center" }}>
                  {errMsg}
                </div>
                <div style={{ color: "#4B5563", fontSize: "0.75rem", textAlign: "center", lineHeight: 1.6 }}>
                  Settings → Privacy → Camera<br />ອະນຸຍາດ Browser ໃຊ້ກ້ອງ ແລ້ວໂຫຼດໃໝ່
                </div>
              </div>
            )}

            {/* Scanning overlay: vignette + corner brackets + sweep line */}
            {status === "scanning" && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {/* Dark vignette */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse 65% 42% at 50% 50%, transparent 52%, rgba(0,0,0,0.65) 100%)",
                }} />

                {/* Scan zone box */}
                <div style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 300, height: 120,
                }}>
                  {/* Corner brackets */}
                  {([
                    { top:   0, left:   0, borderTop: "2.5px solid #F59E0B", borderLeft:   "2.5px solid #F59E0B", borderRadius: "6px 0 0 0" },
                    { top:   0, right:  0, borderTop: "2.5px solid #F59E0B", borderRight:  "2.5px solid #F59E0B", borderRadius: "0 6px 0 0" },
                    { bottom:0, left:   0, borderBottom: "2.5px solid #F59E0B", borderLeft:  "2.5px solid #F59E0B", borderRadius: "0 0 0 6px" },
                    { bottom:0, right:  0, borderBottom: "2.5px solid #F59E0B", borderRight: "2.5px solid #F59E0B", borderRadius: "0 0 6px 0" },
                  ] as React.CSSProperties[]).map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 22, height: 22, ...s }} />
                  ))}

                  {/* Sweep line */}
                  <div style={{
                    position: "absolute", left: 4, right: 4, height: 2,
                    background: "linear-gradient(90deg,transparent,#F59E0B,#FDE68A,#F59E0B,transparent)",
                    animation: "scanLine 1.8s ease-in-out infinite",
                    boxShadow: "0 0 8px rgba(245,158,11,0.8)",
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            )}

            {/* Green flash on successful scan */}
            {flash && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(16,185,129,0.22)",
                pointerEvents: "none",
              }} />
            )}
          </div>

          {/* ── Bottom panel ── */}
          <div style={{ padding: "16px 22px 22px" }}>

            {/* Last scanned code */}
            {lastCode ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(16,185,129,0.09)",
                border: "1px solid rgba(16,185,129,0.22)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              }}>
                <Zap size={14} color="#10B981" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.67rem", color: "#6EE7B7", fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    ສະແກນໄດ້ລ່າສຸດ
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "0.88rem", color: "#F9FAFB", fontWeight: 700 }}>
                    {lastCode}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.09)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 14,
                textAlign: "center",
              }}>
                <div style={{ fontSize: "0.78rem", color: "#374151" }}>ຍັງບໍ່ທັນສະແກນ...</div>
              </div>
            )}

            {/* Format hint */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              <span style={{ fontSize: "0.64rem", color: "#374151", whiteSpace: "nowrap" }}>
                EAN-13 · UPC · Code128 · QR
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "11px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#9CA3AF", fontSize: "0.85rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "rgba(255,255,255,0.1)", color: "#F9FAFB" })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: "rgba(255,255,255,0.05)", color: "#9CA3AF" })}
            >
              ປິດ Scanner
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
