import { useEffect, useState } from "react";
import { getVendors, createVendor, updateVendor, deleteVendor, getVendorProducts, createVendorProduct, deleteVendorProduct, autocompleteProducts, searchProductsInVendors } from "../api";
import { formatDate } from "../utils";

const isMobile = () => window.innerWidth < 768;

const COUNTRY_CODES = [
  { code: "+91", country: "India" },
  { code: "+1", country: "USA" },
  { code: "+44", country: "UK" },
  { code: "+61", country: "Australia" },
  { code: "+81", country: "Japan" },
  { code: "+86", country: "China" },
  { code: "+33", country: "France" },
  { code: "+49", country: "Germany" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+65", country: "Singapore" },
  { code: "+60", country: "Malaysia" },
  { code: "+66", country: "Thailand" },
  { code: "+92", country: "Pakistan" },
  { code: "+880", country: "Bangladesh" },
];

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
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, vendorId: null, vendorName: "" });
  const [emailList, setEmailList] = useState([]);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sortBy, setSortBy] = useState("CreatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [mobile, setMobile] = useState(isMobile());
  const [vendorNameError, setVendorNameError] = useState("");

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleCreatedByChange(val) {
    setCreatedBy(val);
    localStorage.setItem("createdBy", val);
  }

  useEffect(() => { loadVendors(); }, []);

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }

  function getSortedVendors(vendorList) {
    const sorted = [...vendorList];
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "VendorName":
          aVal = (a.VendorName || "").toLowerCase();
          bVal = (b.VendorName || "").toLowerCase();
          break;
        case "ContactPerson":
          aVal = (a.ContactPerson || "").toLowerCase();
          bVal = (b.ContactPerson || "").toLowerCase();
          break;
        case "Phone":
          aVal = (a.Phone || "").toLowerCase();
          bVal = (b.Phone || "").toLowerCase();
          break;
        case "Email":
          aVal = (a.Email || "").toLowerCase();
          bVal = (b.Email || "").toLowerCase();
          break;
        case "City":
          aVal = (a.City || "").toLowerCase();
          bVal = (b.City || "").toLowerCase();
          break;
        case "Products":
          aVal = searchResults ? (a.MatchingProducts?.length ?? 0) : (a.ProductCount ?? 0);
          bVal = searchResults ? (b.MatchingProducts?.length ?? 0) : (b.ProductCount ?? 0);
          break;
        case "CreatedAt":
          aVal = new Date(a.CreatedAt || 0).getTime();
          bVal = new Date(b.CreatedAt || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  async function loadVendors() {
    const v = await getVendors();
    setVendors(v);
  }

  async function handleProductSearch(e) {
    if (e.key !== "Enter" || !productSearch.trim()) return;

    setSearchLoading(true);
    try {
      const results = await searchProductsInVendors(productSearch);
      setSearchResults({
        query: productSearch,
        vendors: results
      });
    } catch (error) {
      setSearchResults({
        query: productSearch,
        vendors: []
      });
    } finally {
      setSearchLoading(false);
    }
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

  function handleVendorNameChange(value) {
    setModalForm(v => ({ ...v, VendorName: value }));

    if (!value.trim()) {
      setVendorNameError("");
      return;
    }

    const isDuplicate = vendors.some(v =>
      v.VendorName.toLowerCase() === value.toLowerCase() &&
      v.VendorID !== editingId
    );

    if (isDuplicate) {
      setVendorNameError("This vendor name already exists");
    } else {
      setVendorNameError("");
    }
  }

  function openAddModal() {
    setEditingId(null);
    setModalForm({});
    setEmailList([""]);
    setPhoneCountryCode("+91");
    setPhoneNumber("");
    setVendorNameError("");
    setShowModal(true);
  }

  function openEditModal(vendor) {
    setEditingId(vendor.VendorID);
    setModalForm({
      VendorName: vendor.VendorName,
      ContactPerson: vendor.ContactPerson,
      City: vendor.City,
      Region: vendor.Region,
    });
    setVendorNameError("");
    // Parse email list from comma-separated string
    const emails = vendor.Email ? vendor.Email.split(",").map(e => e.trim()).filter(e => e) : [];
    setEmailList(emails.length > 0 ? emails : [""]);

    // Parse phone and country code from existing phone
    if (vendor.Phone) {
      const match = vendor.Phone.match(/^(\+\d+)\s?(.*)$/);
      if (match) {
        setPhoneCountryCode(match[1]);
        setPhoneNumber(match[2]);
      } else {
        setPhoneCountryCode("+91");
        setPhoneNumber(vendor.Phone);
      }
    } else {
      setPhoneCountryCode("+91");
      setPhoneNumber("");
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalForm({});
    setEditingId(null);
    setVendorNameError("");
  }

  async function handleSaveVendor() {
    if (!modalForm.VendorName?.trim()) return;
    // Join emails with comma and filter out empty strings
    const emailString = emailList.filter(e => e.trim()).join(", ");
    // Combine phone country code and number
    const phoneString = phoneNumber.trim() ? `${phoneCountryCode} ${phoneNumber.trim()}` : null;
    const vendorData = { ...modalForm, Email: emailString || null, Phone: phoneString };

    if (editingId) {
      await updateVendor(editingId, vendorData);
      if (selected?.VendorID === editingId) {
        setSelected(v => ({ ...v, ...vendorData }));
      }
    } else {
      await createVendor({ ...vendorData, CreatedBy: createdBy || null });
    }
    closeModal();
    loadVendors();
  }

  async function handleDeleteVendor(id, vendorName) {
    setDeleteConfirm({ show: true, vendorId: id, vendorName });
  }

  async function confirmDelete() {
    if (!deleteConfirm.vendorId) return;
    await deleteVendor(deleteConfirm.vendorId);
    if (selected?.VendorID === deleteConfirm.vendorId) { setSelected(null); setProducts([]); }
    setDeleteConfirm({ show: false, vendorId: null, vendorName: "" });
    loadVendors();
  }

  function cancelDelete() {
    setDeleteConfirm({ show: false, vendorId: null, vendorName: "" });
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexDirection: mobile ? "column" : "row", gap: mobile ? 12 : 0 }}>
        <h2 style={{ margin: 0, color: "#003366", fontSize: mobile ? 20 : 24 }}>Vendors</h2>
        <button onClick={openAddModal}
          style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: mobile ? "10px 14px" : "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, width: mobile ? "100%" : "auto" }}>
          + Add Vendor
        </button>
      </div>

      {/* Search Bar - Vendor Name & Product (Mutually Exclusive) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
        marginBottom: 16
      }}>
          {/* Vendor Search */}
          <div>
            <input
              type="text"
              placeholder="Search by Vendor Name..."
              value={vendorSearch}
              onChange={e => {
                setVendorSearch(e.target.value);
                if (e.target.value.trim()) {
                  setProductSearch("");
                  setSearchResults(null);
                }
              }}
              disabled={searchResults !== null}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: vendorSearch ? "1px solid #003366" : "1px solid #ccc",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
                background: vendorSearch ? "#f0f6ff" : "#fff",
                opacity: searchResults !== null ? 0.6 : 1,
                cursor: searchResults !== null ? "not-allowed" : "text"
              }}
            />
          </div>

          {/* Product Search */}
          <div>
            <input
              placeholder="Search by Product Name (Press Enter)..."
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value);
                if (!e.target.value.trim()) {
                  setSearchResults(null);
                }
              }}
              onKeyPress={handleProductSearch}
              disabled={vendorSearch.trim() !== ""}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: productSearch ? "1px solid #003366" : "1px solid #ccc",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
                background: productSearch ? "#f0f6ff" : "#fff",
                opacity: vendorSearch.trim() ? 0.6 : 1,
                cursor: vendorSearch.trim() ? "not-allowed" : "text"
              }}
            />
          </div>

          {/* Clear Vendor */}
          {vendorSearch && (
            <button
              onClick={() => setVendorSearch("")}
              title="Clear vendor search"
              style={{
                background: "#fee",
                color: "#c00",
                border: "1px solid #fcc",
                borderRadius: 6,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500
              }}
            >
              ✕ Vendor
            </button>
          )}

          {/* Clear Product */}
          {(productSearch || searchResults) && (
            <button
              onClick={() => { setProductSearch(""); setSearchResults(null); }}
              title="Clear product search"
              style={{
                background: "#fee",
                color: "#c00",
                border: "1px solid #fcc",
                borderRadius: 6,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500
              }}
            >
              ✕ Product
            </button>
          )}
        </div>

        {/* Search Status Info */}
        {vendorSearch && (
          <div style={{ background: "#e8f5e9", color: "#1b5e20", padding: 10, borderRadius: 6, marginTop: 10, fontSize: 12 }}>
            🔍 Showing vendors matching "<strong>{vendorSearch}</strong>"
          </div>
        )}
        {searchResults && !vendorSearch && (
          <div style={{ background: "#e8f0fe", color: "#003366", padding: 10, borderRadius: 6, marginTop: 10, fontSize: 12 }}>
            🔍 Found <strong>{searchResults.vendors.length}</strong> vendor{searchResults.vendors.length !== 1 ? "s" : ""} with product "<strong>{searchResults.query}</strong>"
          </div>
        )}

      {/* Vendor Table / Cards */}
      {!mobile ? (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 16, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#003366", color: "#fff" }}>
              <th onClick={() => handleSort("VendorName")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "30%", cursor: "pointer", background: sortBy === "VendorName" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "VendorName" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "VendorName" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Vendor Name</span>{sortBy === "VendorName" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th onClick={() => handleSort("ContactPerson")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "12%", cursor: "pointer", background: sortBy === "ContactPerson" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "ContactPerson" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "ContactPerson" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Contact Person</span>{sortBy === "ContactPerson" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th onClick={() => handleSort("Phone")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "13%", cursor: "pointer", background: sortBy === "Phone" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "Phone" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "Phone" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Phone</span>{sortBy === "Phone" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th onClick={() => handleSort("Email")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "15%", cursor: "pointer", background: sortBy === "Email" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "Email" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "Email" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Email</span>{sortBy === "Email" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th onClick={() => handleSort("City")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "12%", cursor: "pointer", background: sortBy === "City" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "City" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "City" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>City</span>{sortBy === "City" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th onClick={() => handleSort("Products")} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "10%", cursor: "pointer", background: sortBy === "Products" ? "#002847" : "#003366", transition: "background 0.2s" }} onMouseEnter={(e) => sortBy !== "Products" && (e.currentTarget.style.background = "#004080")} onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === "Products" ? "#002847" : "#003366")}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Products</span>{sortBy === "Products" && <span style={{ marginLeft: 6, fontSize: 14 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>}</div></th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, width: "8%", cursor: "default" }}>Actions</th>
            </tr>
            </thead>
          <tbody>
            {(() => {
              let vendorList = searchResults ? searchResults.vendors : vendors;
              // Filter by vendor name search
              if (vendorSearch.trim()) {
                vendorList = vendorList.filter(v => v.VendorName.toLowerCase().includes(vendorSearch.toLowerCase()));
              }
              if (vendorList.length === 0) {
                const message = vendorSearch ? `No vendors found matching "${vendorSearch}".` : searchResults ? "No vendors found with that product." : "No vendors yet.";
                return <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#888" }}>{message}</td></tr>;
              }
              const sortedVendors = getSortedVendors(vendorList);
              return sortedVendors.map((v, i) => (
              <tr key={v.VendorID}
                onClick={() => selectVendor(v)}
                style={{
                  background: selected?.VendorID === v.VendorID ? "#e8f0fe" : i % 2 === 0 ? "#fff" : "#f9f9f9",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13, wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>{v.VendorName}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>{v.ContactPerson || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>{v.Phone || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>{v.Email || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>{v.City || "—"}</td>
                <td style={{ padding: "10px 14px", wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>
                  <span style={{ background: "#e8f0fe", color: "#1a56db", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                    {searchResults ? (v.MatchingProducts?.length ?? 0) : (v.ProductCount ?? 0)} {(searchResults ? (v.MatchingProducts?.length ?? 0) : (v.ProductCount ?? 0)) === 1 ? "product" : "products"}
                  </span>
                  {searchResults && v.MatchingProducts && v.MatchingProducts.length > 0 && (
                    <div style={{ fontSize: 11, color: "#555", marginTop: 6, lineHeight: 1.5 }}>
                      {v.MatchingProducts.map((p, idx) => (
                        <div key={idx} style={{ marginBottom: 4 }}>
                          <div style={{ fontWeight: 500 }}>{p.ProductName}</div>
                          <div style={{ color: "#888", fontSize: 10 }}>
                            {p.LastQuotedPrice ? (
                              <>💰 {p.LastCurrency || "INR"} {p.LastQuotedPrice}{p.LastPriceUnit ? " / " + p.LastPriceUnit : ""}</>
                            ) : (
                              <>No price data</>
                            )}
                            {p.LastQuotedDate && <> · {new Date(p.LastQuotedDate).toLocaleDateString('en-IN')}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: "10px 14px", display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditModal(v)}
                    title="Edit vendor"
                    style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, transition: "all 0.2s", color: "#1a7a4a" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#e8f5e9"; e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.transform = "scale(1)"; }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDeleteVendor(v.VendorID, v.VendorName)}
                    title="Deactivate vendor"
                    style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, transition: "all 0.2s", color: "#c00" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#ffebee"; e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.transform = "scale(1)"; }}>
                    🗑️
                  </button>
                </td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {(() => {
            let vendorList = searchResults ? searchResults.vendors : vendors;
            // Filter by vendor name search
            if (vendorSearch.trim()) {
              vendorList = vendorList.filter(v => v.VendorName.toLowerCase().includes(vendorSearch.toLowerCase()));
            }
            if (vendorList.length === 0) {
              const message = vendorSearch ? `No vendors found matching "${vendorSearch}".` : searchResults ? "No vendors found with that product." : "No vendors yet.";
              return <div style={{ textAlign: "center", color: "#888", padding: 24, background: "#fff", borderRadius: 8 }}>{message}</div>;
            }
            const sortedVendors = getSortedVendors(vendorList);
            return sortedVendors.map(v => (
              <div key={v.VendorID}
                onClick={() => selectVendor(v)}
                style={{ background: selected?.VendorID === v.VendorID ? "#e8f0fe" : "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, cursor: "pointer" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#003366", marginBottom: 8 }}>{v.VendorName}</div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
                  {v.ContactPerson && <div><b>Contact:</b> {v.ContactPerson}</div>}
                  {v.Phone && <div><b>Phone:</b> {v.Phone}</div>}
                  {v.Email && <div><b>Email:</b> {v.Email}</div>}
                  {v.City && <div><b>City:</b> {v.City}</div>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <span style={{ background: "#e8f0fe", color: "#1a56db", borderRadius: 12, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                      {searchResults ? (v.MatchingProducts?.length ?? 0) : (v.ProductCount ?? 0)} product{(searchResults ? (v.MatchingProducts?.length ?? 0) : (v.ProductCount ?? 0)) !== 1 ? "s" : ""}
                    </span>
                    {searchResults && v.MatchingProducts && v.MatchingProducts.length > 0 && (
                      <div style={{ fontSize: 10, color: "#555", marginTop: 6, lineHeight: 1.6 }}>
                        {v.MatchingProducts.map((p, idx) => (
                          <div key={idx} style={{ marginBottom: 6 }}>
                            <div style={{ fontWeight: 500, color: "#333" }}>{p.ProductName}</div>
                            <div style={{ color: "#888", fontSize: 9 }}>
                              {p.LastQuotedPrice ? (
                                <>💰 {p.LastCurrency || "INR"} {p.LastQuotedPrice}{p.LastPriceUnit ? " / " + p.LastPriceUnit : ""}</>
                              ) : (
                                <>No price data</>
                              )}
                              {p.LastQuotedDate && <> · {new Date(p.LastQuotedDate).toLocaleDateString('en-IN')}</>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditModal(v)}
                      title="Edit vendor"
                      style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, transition: "all 0.2s", color: "#1a7a4a" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#e8f5e9"; e.currentTarget.style.transform = "scale(1.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.transform = "scale(1)"; }}>
                      ✏️
                    </button>
                    <button onClick={() => handleDeleteVendor(v.VendorID, v.VendorName)}
                      title="Deactivate vendor"
                      style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, transition: "all 0.2s", color: "#c00" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#ffebee"; e.currentTarget.style.transform = "scale(1.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.transform = "scale(1)"; }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
              ));
            })()}
        </div>
      )}

      {/* Products Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSelected(null); setProducts([]); }}>
          <div style={{ background: "#fff", borderRadius: mobile ? "16px 16px 0 0" : 12, padding: mobile ? 16 : 28, width: mobile ? "100%" : 760, maxHeight: mobile ? "85vh" : "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#003366", fontSize: mobile ? 16 : 18 }}>Products — {selected.VendorName}</h3>
              <button onClick={() => { setSelected(null); setProducts([]); }}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            {/* Add product form */}
            <div style={{ background: "#f0f6ff", borderRadius: 8, padding: mobile ? 10 : 12, marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: "#003366" }}>Add Product</div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 2fr 1fr 2fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
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
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #ccc", borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 100, maxHeight: 150, overflowY: "auto" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                {[["ReferencePrice","Price","number"],["ReferenceCurrency","Currency","text"],["ReferencePriceUnit","Price Unit","text"]].map(([f, label, type]) => (
                  <div key={f}>
                    <label style={{ fontSize: 11, color: "#555" }}>{label}</label>
                    <input type={type} value={productForm[f] || ""} onChange={e => setProductForm(p => ({ ...p, [f]: e.target.value }))}
                      style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: "#555" }}>Price Date</label>
                  <input type="date" value={productForm["ReferencePriceDate"] || ""} onChange={e => setProductForm(p => ({ ...p, ReferencePriceDate: e.target.value }))}
                    style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#555" }}>Created By</label>
                  <input value={createdBy} onChange={e => handleCreatedByChange(e.target.value)}
                    placeholder="Your name…"
                    style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <button onClick={handleAddProduct}
                  style={{ background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, padding: mobile ? "8px 12px" : "6px 14px", cursor: "pointer", fontSize: 13, width: mobile ? "100%" : "auto", marginTop: mobile ? 4 : 0 }}>
                  Add
                </button>
              </div>
            </div>

            {/* Products table (scrollable) / Cards (mobile) */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {!mobile ? (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      {["Product Name", "Grade", "Manufacturer", "Lead Days", "Last Price", "Quoted On", "Notes", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 12, position: "sticky", top: 0, background: "#f5f5f5" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = products.filter(p =>
                        p.ProductName.toLowerCase().includes(productSearch.toLowerCase())
                      );
                      return filtered.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: 20, color: "#888", textAlign: "center" }}>{productSearch ? "No products match your search." : "No products yet."}</td></tr>
                      ) : filtered.map(p => (
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
                      ));
                    })()}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(() => {
                    const filtered = products.filter(p =>
                      p.ProductName.toLowerCase().includes(productSearch.toLowerCase())
                    );
                    return filtered.length === 0 ? (
                      <div style={{ padding: 20, color: "#888", textAlign: "center" }}>{productSearch ? "No products match your search." : "No products yet."}</div>
                    ) : (
                      filtered.map(p => (
                        <div key={p.VendorProductID} style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#003366", marginBottom: 8 }}>{p.ProductName}</div>
                        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
                          {p.Grade && <div><b>Grade:</b> {p.Grade}</div>}
                          {p.Manufacturer && <div><b>Manufacturer:</b> {p.Manufacturer}</div>}
                          {p.LeadTimeDays && <div><b>Lead Days:</b> {p.LeadTimeDays}</div>}
                          {p.LastQuotedPrice && <div><b>Last Price:</b> {p.LastCurrency || "INR"} {p.LastQuotedPrice}{p.LastPriceUnit ? " / " + p.LastPriceUnit : ""}</div>}
                          {p.LastQuotedDate && <div><b>Quoted On:</b> {formatDate(p.LastQuotedDate)}</div>}
                          {p.Notes && <div><b>Notes:</b> {p.Notes}</div>}
                        </div>
                        <button onClick={() => handleDeleteProduct(p.VendorProductID)}
                          style={{ width: "100%", background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: 11 }}>
                          Remove
                        </button>
                      </div>
                      ))
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}
          onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: mobile ? "16px 16px 0 0" : 12, padding: mobile ? 16 : 28, width: mobile ? "100%" : 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#003366", fontSize: mobile ? 16 : 18 }}>{editingId ? "Edit Vendor" : "Add Vendor"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            {VENDOR_FIELDS.map(([f, label, required]) => {
              // Skip Email and Phone - we'll handle them separately
              if (f === "Email" || f === "Phone") return null;

              return (
                <div key={f} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>
                    {label}{required && <span style={{ color: "#c00" }}> *</span>}
                  </label>
                  <input value={modalForm[f] || ""} onChange={e => {
                    if (f === "VendorName") {
                      handleVendorNameChange(e.target.value);
                    } else {
                      setModalForm(v => ({ ...v, [f]: e.target.value }));
                    }
                  }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: vendorNameError && f === "VendorName" ? "1px solid #d32f2f" : "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                  <div style={{ fontSize: 11, color: "#d32f2f", marginTop: 4, height: 16, overflow: "hidden" }}>
                    {vendorNameError && f === "VendorName" ? `⚠️ ${vendorNameError}` : ""}
                  </div>
                </div>
              );
            })}

            {/* Phone with Country Code */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6, fontWeight: 500 }}>Phone</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={phoneCountryCode}
                  onChange={e => setPhoneCountryCode(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box", width: 100 }}
                >
                  {COUNTRY_CODES.map(({ code, country }) => (
                    <option key={code} value={code}>{code} {country}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Multiple Email Inputs */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 8, fontWeight: 500 }}>Email Addresses</label>
              {emailList.map((email, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      const newList = [...emailList];
                      newList[idx] = e.target.value;
                      setEmailList(newList);
                    }}
                    placeholder={idx === 0 ? "primary@example.com" : "additional@example.com"}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                  />
                  {emailList.length > 1 && (
                    <button
                      onClick={() => setEmailList(emailList.filter((_, i) => i !== idx))}
                      title="Remove email"
                      style={{ fontSize: 14, background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontWeight: 600 }}
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setEmailList([...emailList, ""])}
                style={{ fontSize: 12, background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 500, width: "100%" }}
              >
                + Add Email
              </button>
            </div>
            {!editingId && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Created By</label>
                <input value={createdBy} onChange={e => handleCreatedByChange(e.target.value)}
                  placeholder="Your name…"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexDirection: mobile ? "column" : "row" }}>
              <button onClick={handleSaveVendor}
                disabled={!modalForm.VendorName?.trim() || (!editingId && vendorNameError)}
                style={{ flex: 1, background: !modalForm.VendorName?.trim() || (!editingId && vendorNameError) ? "#ccc" : "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: !modalForm.VendorName?.trim() || (!editingId && vendorNameError) ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 }}>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={cancelDelete}>
          <div style={{ background: "#fff", borderRadius: 12, padding: mobile ? 20 : 28, width: mobile ? "90%" : 380, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 28 }}>⚠️</div>
              <h3 style={{ margin: 0, color: "#c00", fontSize: 18 }}>Deactivate Vendor?</h3>
            </div>
            <p style={{ margin: "0 0 20px 0", color: "#555", fontSize: 14, lineHeight: 1.6 }}>
              Are you sure you want to deactivate <strong>{deleteConfirm.vendorName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, flexDirection: mobile ? "column" : "row" }}>
              <button onClick={confirmDelete}
                style={{ flex: 1, background: "#c00", color: "#fff", border: "none", borderRadius: 6, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                Deactivate
              </button>
              <button onClick={cancelDelete}
                style={{ flex: 1, background: "#eee", color: "#333", border: "none", borderRadius: 6, padding: "12px", cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
