"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, Edit2, Trash2, Package, X,
  AlertTriangle, Upload, Image as ImageIcon, ChevronDown,
} from "lucide-react";
import Header from "@/components/Header";
import { productsApi, categoriesApi, BASE_URL_STATIC } from "@/lib/api";
import { Product, ProductFormData } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

interface Category { id: number; name: string; product_count?: number; }

const EMPTY: ProductFormData = {
  name: "", sku: "", price: 0, stock: 0, min_stock: 5,
  category_id: null, description: "",
};

// ─── Image Upload Widget ─────────────────────────────────────
function ImageUploader({
  currentUrl,
  productId,
  onUploaded,
}: {
  currentUrl?: string;
  productId?: number;
  onUploaded: (url: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("ອະນຸຍາດສະເພາະໄຟລ໌ຮູບ", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("ຂະໜາດໄຟລ໌ຕ້ອງບໍ່ເກີນ 5MB", "error");
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // If we have a product ID, upload now; otherwise store for later
    if (productId) {
      setUploading(true);
      try {
        const res = await productsApi.uploadImage(productId, file);
        const serverUrl = res.data.data.image_url;
        onUploaded(serverUrl);
        showToast("ອັບໂຫຼດຮູບສຳເລັດ", "success");
      } catch {
        showToast("ອັບໂຫຼດຮູບຜິດພາດ", "error");
        setPreview(currentUrl || null);
      } finally {
        setUploading(false);
      }
    } else {
      // New product: store file reference via callback with object URL
      // Real upload will happen after product is created
      onUploaded(objectUrl);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>
        ຮູບສິນຄ້າ
      </label>

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        style={{
          border: `2px dashed ${dragOver ? "rgba(245,158,11,0.6)" : "#E2E8F0"}`,
          borderRadius: 10,
          padding: 0,
          cursor: uploading ? "wait" : "pointer",
          transition: "all 0.2s",
          background: dragOver ? "rgba(245,158,11,0.04)" : "#F8FAFC",
          overflow: "hidden",
          position: "relative",
          height: preview ? "auto" : 130,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.startsWith("/uploads") ? `${BASE_URL_STATIC}${preview}` : preview}
              alt="Preview"
              style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
            />
            {/* Overlay on hover */}
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity 0.2s",
              backdropFilter: "blur(2px)",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
            >
              <div style={{ textAlign: "center", color: "#FFFFFF" }}>
                <Upload size={20} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "0.8rem" }}>ປ່ຽນຮູບ</div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: "#475569", padding: "20px" }}>
            {uploading ? (
              <>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "#f59e0b", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
                <div style={{ fontSize: "0.8rem" }}>ກຳລັງອັບໂຫຼດ...</div>
              </>
            ) : (
              <>
                <ImageIcon size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                <div style={{ fontSize: "0.8rem", marginBottom: 4 }}>ກົດ ຫຼື ລາກໄຟລ໌ຮູບມາໃສ່</div>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>JPG, PNG, WEBP · ສູງສຸດ 5MB</div>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {preview && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPreview(null); onUploaded(""); }}
          style={{
            marginTop: 6, background: "none", border: "none",
            color: "#ef4444", fontSize: "0.75rem", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, padding: 0,
          }}
        >
          <X size={12} /> ລຶບຮູບ
        </button>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

// ─── Product Modal ───────────────────────────────────────────
function ProductModal({
  product,
  categories,
  onClose,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name,
          sku: product.sku || "",
          price: product.price,
          stock: product.stock,
          min_stock: product.min_stock,
          category_id: product.category_id ?? null,
          description: product.description || "",
        }
      : EMPTY
  );
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>(product?.image_url || "");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast("ກະລຸນາໃສ່ຊື່ສິນຄ້າ", "error"); return; }
    if (!form.price || form.price <= 0) { showToast("ກະລຸນາໃສ່ລາຄາທີ່ຖືກຕ້ອງ", "error"); return; }

    setSaving(true);
    try {
      let productId = product?.id;

      if (product) {
        await productsApi.update(product.id, form);
        showToast("ອັບເດດສິນຄ້າສຳເລັດ", "success");
      } else {
        const res = await productsApi.create(form);
        productId = res.data.data?.id;
        showToast("ເພີ່ມສິນຄ້າສຳເລັດ", "success");
      }

      // Upload pending image for NEW products
      if (pendingImageFile && productId) {
        try {
          await productsApi.uploadImage(productId, pendingImageFile);
        } catch {
          showToast("ສິນຄ້າຖືກເພີ່ມແລ້ວ ແຕ່ຮູບອັບໂຫຼດຜິດພາດ", "info");
        }
      }

      onSave();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "ເກີດຂໍ້ຜິດພາດ";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ProductFormData, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>
              {product ? "ແກ້ໄຂສິນຄ້າ" : "ເພີ່ມສິນຄ້າໃໝ່"}
            </div>
            {product && (
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: 2 }}>
                ID: #{product.id} · {product.sku}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "6px" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>

            {/* Image uploader — full width */}
            <div style={{ gridColumn: "1/-1" }}>
              <ImageUploader
                currentUrl={imagePreviewUrl || product?.image_url}
                productId={product?.id}
                onUploaded={(url) => {
                  setImagePreviewUrl(url);
                  // Store pending file for new products
                  if (!product && url.startsWith("blob:")) {
                    fetch(url).then(r => r.blob()).then(b => {
                      setPendingImageFile(new File([b], "upload.jpg", { type: b.type }));
                    });
                  }
                }}
              />
            </div>

            {/* Name — full width */}
            <div style={{ gridColumn: "1/-1", marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ຊື່ສິນຄ້າ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. CPU Intel Core i9-13900K"
                className="input-field"
                autoFocus
              />
            </div>

            {/* SKU */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                SKU / ລະຫັດ
              </label>
              <input
                type="text"
                value={form.sku || ""}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="ອັດຕະໂນມັດຖ້າຫວ່າງ"
                className="input-field"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
              />
            </div>

            {/* Category */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ໝວດໝູ່
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.category_id ?? ""}
                  onChange={(e) => set("category_id", e.target.value ? Number(e.target.value) : null)}
                  className="input-field"
                  style={{ appearance: "none", paddingRight: 36 }}
                >
                  <option value="">— ບໍ່ລະບຸ —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
              </div>
            </div>

            {/* Price */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ລາຄາຂາຍ (₭) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                value={form.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="0"
                className="input-field"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
                min="0"
              />
            </div>

            {/* Stock */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ຈຳນວນໃນສາງ
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => set("stock", Number(e.target.value))}
                placeholder="0"
                className="input-field"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
                min="0"
              />
            </div>

            {/* Min stock */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ລະດັບຕ່ຳສຸດ (ແຈ້ງເຕືອນ)
              </label>
              <input
                type="number"
                value={form.min_stock}
                onChange={(e) => set("min_stock", Number(e.target.value))}
                placeholder="5"
                className="input-field"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
                min="0"
              />
            </div>

            {/* Description — full width */}
            <div style={{ gridColumn: "1/-1", marginBottom: 4 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                ລາຍລະອຽດ
              </label>
              <textarea
                value={form.description || ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="ລາຍລະອຽດ, Spec, ໝາຍເຫດ..."
                rows={3}
                className="input-field"
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ຍົກເລີກ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "ກຳລັງບັນທຶກ..." : product ? "ອັບເດດ" : "ເພີ່ມສິນຄ້າ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        productsApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setProducts(pRes.data.data || []);
      setCategories(cRes.data.data || []);
    } catch {
      showToast("ໂຫຼດຂໍ້ມູນຜິດພາດ", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = products;
    if (showLowStock) list = list.filter((p) => p.low_stock);
    if (categoryFilter !== "all") list = list.filter((p) => p.category_id === categoryFilter);
    if (search)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.category_name || "").toLowerCase().includes(search.toLowerCase())
      );
    setFiltered(list);
  }, [products, search, showLowStock, categoryFilter]);

  const handleDelete = async (product: Product) => {
    if (!confirm(`ຕ້ອງການລຶບ "${product.name}" ບໍ່?`)) return;
    try {
      await productsApi.delete(product.id);
      showToast("ລຶບສິນຄ້າສຳເລັດ", "success");
      load();
    } catch {
      showToast("ລຶບສິນຄ້າຜິດພາດ", "error");
    }
  };

  const lowCount = products.filter((p) => p.low_stock).length;

  return (
    <>
      <Header title="ສິນຄ້າ" subtitle="ຄຸ້ມຄອງຂໍ້ມູນສິນຄ້າ ແລະ ສາງ" />

      <main className="page-enter" style={{ flex: 1, padding: "28px" }}>
        {/* Low stock banner */}
        {lowCount > 0 && (
          <div
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}
            onClick={() => setShowLowStock(!showLowStock)}
          >
            <AlertTriangle size={16} color="#f59e0b" />
            <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.875rem" }}>
              {lowCount} ລາຍການ ໃກ້ໝົດສາງ
            </span>
            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
              — {showLowStock ? "ສະແດງທັງໝົດ" : "ກົດເພື່ອກັ່ນຕອງ"}
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ຄົ້ນຫາຊື່, SKU..." className="search-input" />
          </div>

          {/* Category filter */}
          <div style={{ position: "relative" }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="input-field"
              style={{ appearance: "none", paddingRight: 32, paddingLeft: 12, fontSize: "0.82rem", width: "auto", minWidth: 140 }}
            >
              <option value="all">ທຸກໝວດໝູ່</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: "0.8rem" }}>
            <Package size={14} />
            {filtered.length} ລາຍການ
          </div>

          {isAdmin && (
            <button onClick={() => { setSelected(null); setModal("add"); }} className="btn btn-primary" style={{ marginLeft: "auto" }}>
              <Plus size={16} />
              ເພີ່ມສິນຄ້າ
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "#f59e0b", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              ກຳລັງໂຫຼດ...
              <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8" }}>
              <Package size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div>ບໍ່ມີຂໍ້ມູນສິນຄ້າ</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ຮູບ</th>
                  <th>#</th>
                  <th>ຊື່ສິນຄ້າ</th>
                  <th>SKU</th>
                  <th>ໝວດໝູ່</th>
                  <th style={{ textAlign: "right" }}>ລາຄາ</th>
                  <th style={{ textAlign: "center" }}>ສາງ</th>
                  <th style={{ textAlign: "center" }}>ສະຖານະ</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>ຈັດການ</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    {/* Thumbnail */}
                    <td>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${BASE_URL_STATIC}${p.image_url}`}
                          alt={p.name}
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid #E2E8F0", display: "block" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                          <Package size={16} />
                        </div>
                      )}
                    </td>
                    <td className="text-prim"><span className="price">#{p.id}</span></td>
                    <td className="text-prim" style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px 8px", fontSize: "0.72rem", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                        {p.sku || "—"}
                      </span>
                    </td>
                    <td>
                      {p.category_name ? (
                        <span style={{ color: "#22d3ee", fontSize: "0.82rem" }}>{p.category_name}</span>
                      ) : (
                        <span style={{ color: "#CBD5E1" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="price" style={{ color: "#f59e0b", fontWeight: 600 }}>
                        {Number(p.price).toLocaleString()} ₭
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="price" style={{ color: p.low_stock ? "#ef4444" : "#0F172A", fontWeight: 600 }}>
                        {p.stock}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "#94A3B8", display: "block" }}>min: {p.min_stock}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {p.low_stock ? (
                        <span className="low-stock-dot">ໃກ້ໝົດ</span>
                      ) : (
                        <span className="badge" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.7rem" }}>
                          ປົກກະຕິ
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => { setSelected(p); setModal("edit"); }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "6px 10px", color: "#22d3ee" }}
                            title="ແກ້ໄຂ"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "6px 10px", color: "#ef4444" }}
                            title="ລຶບ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {(modal === "add" || modal === "edit") && (
        <ProductModal
          product={modal === "edit" ? selected : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
