import { useEffect, useState } from "react";
import { getVendors, createVendor, updateVendor, deleteVendor, getVendorProducts, createVendorProduct, deleteVendorProduct, autocompleteProducts } from "../api";
import { formatDate } from "../utils";

const VENDOR_FIELDS = [
  ["VendorName", "Vendor Name", true],
  ["ContactPerson", "Contact Person", false],
  ["Email", "Email", false],
  ["Phone", "Phone", false],
  ["City", "City", false],
  ["Region", "Region", false],
];

const PRODUCT_FIELDS = [
  ["ProductName", "Product Name"],
  ["Grade", "Grade"],
  ["Manufacturer", "Manufacturer"],
  ["LeadTimeDays", "Lead Days"],
  ["Notes", "Notes"],
];

export default function VendorMaster() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [createdBy, setCreatedBy] = useState(() => localStorage.getItem("createdBy") || "");
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  function handleCreatedByChange(val) {
    setCreatedBy(val);
    localStorage.setItem("createdBy", val);
  }

  useEffect(() => { loadVendors(); }, []);

  async function loadVendors() {
    const v = await getVendors();
    setVendors(v);
  }

  async function selectVendor(vendor) {
    if (selected?.VendorID === vendor.VendorID) {
      setSelected(null);
      setProducts([]);
      return;
    }
    setSelected(vendor);
    setProductForm({});
    const p = await getVendorProducts(vendor.VendorID);
    setProducts(p);
  }

  function openAddModal() {
    setEditingId(null);
    setModalForm({});
    setShowModal(true);
  }

  function openEditModal(vendor) {
    setEditingId(vendor.VendorID);
    setModalForm({
      VendorName: vendor.VendorName,
      ContactPerson: vendor.ContactPerson,
      Email: vendor.Email,
      Phone: vendor.Phone,
      City: vendor.City,
      Region: vendor.Region,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalForm({});
    setEditingId(null);
  }

  async function handleSaveVendor() {
    if (!modalForm.VendorName?.trim()) return;
    if (editingId) {
      await updateVendor(editingId, modalForm);
      if (selected?.VendorID === editingId) {
        setSelected(v => ({ ...v, ...modalForm }));
      }
    } else {
      await createVendor({ ...modalForm, CreatedBy: createdBy || null });
    }
    closeModal();
    loadVendors();
  }

  async function handleDeleteVendor(id) {
    if (!window.confirm("Deactivate this vendor?")) return;
    await deleteVendor(id);
    if (selected?.VendorID === id) { setSelected(null); setProducts([]); }
    loadVendors();
  }

  async function handleAddProduct() {
    if (!selected || !productForm.ProductName?.trim()) return;
    await createVendorProduct({ VendorID: selected.VendorID, ...productForm, CreatedBy: createdBy || null });
    const p = await getVendorProducts(selected.VendorID);
    setProducts(p);
    setProductForm({});
  }

  async function handleDeleteProduct(id) {
    await deleteVendorProduct(id);
    const p = await getVendorProducts(selected.VendorID);
    setProducts(p);
  }

  async function handleProductNameChange(value) {
    setProductForm(p => ({ ...p, ProductName: value }));
    if (value.trim().length < 2) {
      setProductSuggestions([]);
      setShowProductSuggestions(false);
      return;
    }
    try {
      const results = await autocompleteProducts(value);
      setProductSuggestions(results);
      setShowProductSuggestions(results.length > 0);
    } catch (e) {
      setProductSuggestions([]);
    }
  }

  function selectProductSuggestion(product) {
    setProductForm(p => ({ ...p, ProductName: product.ProductName }));
    setProductSuggestions([]);
    setShowProductSuggestions(false);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#003366" }}>Vendors</h2>
        <button onClick={openAddModal}
          style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          + Add Vendor
        </button>
      </div>

      {/* Vendor Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <thead>
          <tr style={{ background: "#003366", color: "#fff" }}>
            {["#", "Vendor Name", "Contact Person", "Phone", "Email", "City", "Region", "Products", "Actions"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#888" }}>No vendors yet.</td></tr>
          )}
          {vendors.map((v, i) => (
            <tr key={v.VendorID}
              onClick={() => selectVendor(v)}
              style={{
                background: selected?.VendorID === v.VendorID ? "#e8f0fe" : i % 2 === 0 ? "#fff" : "#f9f9f9",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>#{v.VendorID}</td>
              <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{v.VendorName}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.ContactPerson || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.Phone || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.Email || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.City || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.Region || "—"}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ background: "#e8f0fe", color: "#1a56db", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                  {v.ProductCount ?? 0} {(v.ProductCount ?? 0) === 1 ? "product" : "products"}
                </span>
              </td>
              <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => openEditModal(v)}
                  style={{ fontSize: 12, background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 4, padding: "3px 10px", cursor: "pointer", marginRight: 6 }}>
                  Edit
                </button>
                <button onClick={() => handleDeleteVendor(v.VendorID)}
                  style={{ fontSize: 12, background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Products Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSelected(null); setProducts([]); }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 760, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#003366" }}>Products — {selected.VendorName}</h3>
              <button onClick={() => { setSelected(null); setProducts([]); }}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            {/* Add product form */}
            <div style={{ background: "#f0f6ff", borderRadius: 8, padding: 12, marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: "#003366" }}>Add Product</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr 2fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
                {PRODUCT_FIELDS.map(([f, label]) => (
                  <div key={f} style={{ position: "relative" }}>
                    <label style={{ fontSize: 11, color: "#555" }}>{label}</label>
                    <input
                      value={productForm[f] || ""}
                      onChange={e => f === "ProductName" ? handleProductNameChange(e.target.value) : setProductForm(p => ({ ...p, [f]: e.target.value }))}
                      onFocus={() => f === "ProductName" && productSuggestions.length > 0 && setShowProductSuggestions(true)}
                      onBlur={() => f === "ProductName" && setTimeout(() => setShowProductSuggestions(false), 150)}
                      style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                    {f === "ProductName" && showProductSuggestions && productSuggestions.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #ccc", borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 10, maxHeight: 150, overflowY: "auto" }}>
                        {productSuggestions.map((product, idx) => (
                          <div
                            key={idx}
                            onMouseDown={() => selectProductSuggestion(product)}
                            style={{ padding: "6px 10px", cursor: "pointer", borderBottom: idx < productSuggestions.length - 1 ? "1px solid #f0f0f0" : "none", fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                          >
                            <div style={{ color: "#003366" }}>{product.ProductName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                {[["ReferencePrice","Price","number"],["ReferenceCurrency","Currency","text"],["ReferencePriceUnit","Price Unit","text"]].map(([f, label, type]) => (
                  <div key={f}>
                    <label style={{ fontSize: 11, color: "#555" }}>{label}</label>
                    <input type={type} value={productForm[f] || ""} onChange={e => setProductForm(p => ({ ...p, [f]: e.target.value }))}
                      style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: "#555" }}>Price Date</label>
                  <input type="date" value={productForm["ReferencePriceDate"] || ""} onChange={e => setProductForm(p => ({ ...p, ReferencePriceDate: e.target.value }))}
                    style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#555" }}>Created By</label>
                  <input value={createdBy} onChange={e => handleCreatedByChange(e.target.value)}
                    placeholder="Your name…"
                    style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <button onClick={handleAddProduct}
                  style={{ background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
                  Add
                </button>
              </div>
            </div>

            {/* Products table (scrollable) */}
            <div style={{ overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["Product Name", "Grade", "Manufacturer", "Lead Days", "Last Price", "Quoted On", "Notes", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 12, position: "sticky", top: 0, background: "#f5f5f5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 20, color: "#888", textAlign: "center" }}>No products yet.</td></tr>
                  )}
                  {products.map(p => (
                    <tr key={p.VendorProductID} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.ProductName}</td>
                      <td style={{ padding: "8px 10px" }}>{p.Grade || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{p.Manufacturer || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{p.LeadTimeDays || "—"}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1a7a4a" }}>
                        {p.LastQuotedPrice
                          ? `${p.LastCurrency || "INR"} ${p.LastQuotedPrice}${p.LastPriceUnit ? " / " + p.LastPriceUnit : ""}`
                          : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#666" }}>
                        {formatDate(p.LastQuotedDate)}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{p.Notes || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <button onClick={() => handleDeleteProduct(p.VendorProductID)}
                          style={{ background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#003366" }}>{editingId ? "Edit Vendor" : "Add Vendor"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            {VENDOR_FIELDS.map(([f, label, required]) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>
                  {label}{required && <span style={{ color: "#c00" }}> *</span>}
                </label>
                <input value={modalForm[f] || ""} onChange={e => setModalForm(v => ({ ...v, [f]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
            {!editingId && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Created By</label>
                <input value={createdBy} onChange={e => handleCreatedByChange(e.target.value)}
                  placeholder="Your name…"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSaveVendor}
                style={{ flex: 1, background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                {editingId ? "Update" : "Add Vendor"}
              </button>
              <button onClick={closeModal}
                style={{ flex: 1, background: "#eee", color: "#333", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
