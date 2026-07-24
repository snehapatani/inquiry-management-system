import { useEffect, useState } from "react";
import { getInquiries, bulkSelectItems, deleteInquiry } from "../api";
import { formatDate } from "../utils";

const STATUS_COLORS = {
  New: "#e8f4fd",
  "In Progress": "#fff7e6",
  Quoted: "#e6f7ee",
  Closed: "#f0f0f0",
};

const isMobile = () => window.innerWidth < 768;

export default function InquiryList({ onOpen, onGoToWorkQueue }) {
  const [inquiries, setInquiries] = useState([]);
  const [filter, setFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [createdBySearch, setCreatedBySearch] = useState("");
  const [sortBy, setSortBy] = useState("InquiryDate");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [modal, setModal] = useState(null);
  const [mobile, setMobile] = useState(isMobile());

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const productFilterActive = Boolean(productSearch);

  function fetchInquiries(status, customer, product, createdBy) {
    setLoading(true);
    setSelected(new Set());
    const params = {};
    if (status) params.status = status;
    if (customer) params.customer_name = customer;
    if (product) params.product_name = product;
    if (createdBy) params.created_by = createdBy;
    getInquiries(params)
      .then(data => sortInquiries(data, sortBy, sortDir))
      .then(setInquiries)
      .finally(() => setLoading(false));
  }

  function sortInquiries(data, column, direction) {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (column === "ReceivedDate") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (direction === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    return sorted;
  }

  useEffect(() => {
    fetchInquiries(filter, customerSearch, productSearch, createdBySearch);
  }, [filter, customerSearch, productSearch, createdBySearch]);

  useEffect(() => {
    if (inquiries.length > 0) {
      setInquiries(prev => sortInquiries(prev, sortBy, sortDir));
    }
  }, [sortBy, sortDir, inquiries.length]);

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function handleSearch() {
    fetchInquiries(filter, customerSearch, productSearch, createdBySearch);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  function toggleRow(inqId) {
    setSelected(s => {
      const next = new Set(s);
      next.has(inqId) ? next.delete(inqId) : next.add(inqId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === inquiries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(inquiries.map(i => i.InquiryID)));
    }
  }

  async function handleAddToWorkQueue() {
    const itemIds = inquiries
      .filter(inq => selected.has(inq.InquiryID))
      .flatMap(inq => inq.MatchingItemIDs || []);
    if (!itemIds.length) return;
    setAdding(true);
    await bulkSelectItems(itemIds);
    setAdding(false);
    setSelected(new Set());
    if (onGoToWorkQueue) onGoToWorkQueue();
  }

  function handleDeleteClick(inquiryId) {
    setModal({ type: "confirm", inquiryId });
  }

  async function confirmDelete(inquiryId) {
    setModal(null);
    setDeleting(inquiryId);
    try {
      await deleteInquiry(inquiryId);
      setInquiries(inquiries.filter(inq => inq.InquiryID !== inquiryId));
      setModal({ type: "success", message: "Inquiry deleted successfully" });
      setTimeout(() => setModal(null), 2000);
    } catch (error) {
      setModal({ type: "error", message: `Failed to delete inquiry: ${error.message}` });
    } finally {
      setDeleting(null);
    }
  }

  const allSelected = inquiries.length > 0 && selected.size === inquiries.length;
  const someSelected = selected.size > 0;
  const totalMatchingItems = inquiries
    .filter(inq => selected.has(inq.InquiryID))
    .reduce((n, inq) => n + (inq.MatchingItemIDs?.length || 0), 0);

  return (
    <div style={{ padding: mobile ? "12px 0" : "0" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: mobile ? "flex-start" : "center",
        marginBottom: mobile ? 16 : 12,
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? 12 : 0
      }}>
        <h2 style={{ margin: 0, color: "#003366", fontSize: mobile ? 20 : 24 }}>Inquiries</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{
            padding: mobile ? "10px 10px" : "6px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 13,
            width: mobile ? "100%" : "auto",
            boxSizing: "border-box",
            cursor: "pointer"
          }}>
          <option value="">All Status</option>
          <option>New</option>
          <option>In Progress</option>
          <option>Quoted</option>
          <option>Closed</option>
        </select>
      </div>

      {/* Search Filters */}
      <div style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fit, minmax(150px, 1fr))",
        gap: mobile ? 8 : 8,
        marginBottom: 16
      }}>
        <input
          placeholder="Search by customer…"
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: mobile ? "10px 10px" : "7px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box"
          }}
        />
        <input
          placeholder="Search by product…"
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: mobile ? "10px 10px" : "7px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box"
          }}
        />
        <input
          placeholder="Search by created by…"
          value={createdBySearch}
          onChange={e => setCreatedBySearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: mobile ? "10px 10px" : "7px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box"
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSearch}
            style={{
              flex: 1,
              background: "#003366",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: mobile ? "10px 12px" : "7px 18px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }}>
            Search
          </button>
          {(customerSearch || productSearch || createdBySearch) && (
            <button onClick={() => {
              setCustomerSearch("");
              setProductSearch("");
              setCreatedBySearch("");
              setSortBy("InquiryDate");
              setSortDir("desc");
              fetchInquiries(filter, "", "", "");
            }}
              style={{
                flex: 1,
                background: "#eee",
                color: "#555",
                border: "none",
                borderRadius: 6,
                padding: mobile ? "10px 12px" : "7px 12px",
                cursor: "pointer",
                fontSize: 13
              }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {productFilterActive && someSelected && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#eef4ff",
          border: "1px solid #aac4ee",
          borderRadius: 8,
          padding: mobile ? "10px 12px" : "10px 16px",
          marginBottom: 12,
          flexDirection: mobile ? "column" : "row",
          fontSize: mobile ? 12 : 13
        }}>
          <span style={{ color: "#003366", fontWeight: 600 }}>
            {selected.size} inquiry(s) — {totalMatchingItems} product(s)
          </span>
          <button onClick={handleAddToWorkQueue} disabled={adding || totalMatchingItems === 0}
            style={{
              flex: mobile ? 1 : 0,
              width: mobile ? "100%" : "auto",
              background: "#003366",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: mobile ? "10px 12px" : "6px 16px",
              cursor: "pointer",
              fontSize: mobile ? 12 : 13,
              fontWeight: 600
            }}>
            {adding ? "Adding…" : `+ Add to Queue`}
          </button>
        </div>
      )}

      {loading ? <p style={{ textAlign: "center", color: "#888" }}>Loading...</p> : (
        <>
          {/* Desktop Table View */}
          {!mobile && (
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
            }}>
              <thead>
                <tr style={{ background: "#003366", color: "#fff" }}>
                  {productFilterActive && (
                    <th style={{ padding: "10px 14px", width: 36 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        style={{ cursor: "pointer", width: 15, height: 15 }} />
                    </th>
                  )}
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, cursor: "pointer" }} onClick={() => handleSort("InquiryID")}>
                    # {sortBy === "InquiryID" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, cursor: "pointer" }} onClick={() => handleSort("InquiryDate")}>
                    Date {sortBy === "InquiryDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, cursor: "pointer" }} onClick={() => handleSort("CustomerName")}>
                    Customer {sortBy === "CustomerName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Products</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Source</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Created By</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.length === 0 && (
                  <tr><td colSpan={productFilterActive ? 9 : 8} style={{ padding: 24, textAlign: "center", color: "#888" }}>No inquiries found.</td></tr>
                )}
                {inquiries.map((inq, i) => {
                  const isChecked = selected.has(inq.InquiryID);
                  const matchCount = inq.MatchingItemIDs?.length || 0;
                  return (
                    <tr key={inq.InquiryID} style={{ background: isChecked ? "#f0f4ff" : i % 2 === 0 ? "#fff" : "#f9f9f9", borderBottom: "1px solid #eee" }}>
                      {productFilterActive && (
                        <td style={{ padding: "10px 14px" }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleRow(inq.InquiryID)}
                            style={{ cursor: "pointer", width: 15, height: 15 }} />
                        </td>
                      )}
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>#{inq.InquiryID}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{formatDate(inq.InquiryDate || inq.ReceivedDate)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inq.CustomerName || "—"}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{inq.CustomerCompany || ""}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: "#e8f0fe", color: "#1a56db", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                          {inq.ItemCount} {inq.ItemCount === 1 ? "product" : "products"}
                        </span>
                        {productFilterActive && matchCount > 0 && (
                          <span style={{ marginLeft: 6, background: "#003366", color: "#fff", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                            {matchCount} match{matchCount !== 1 ? "es" : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{inq.Source || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{inq.CreatedBy || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: STATUS_COLORS[inq.Status] || "#eee", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                          {inq.Status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                        <button onClick={() => onOpen(inq.InquiryID)}
                          style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                          Open
                        </button>
                        <button onClick={() => handleDeleteClick(inq.InquiryID)} disabled={deleting === inq.InquiryID}
                          style={{ background: deleting === inq.InquiryID ? "#ccc" : "#d32f2f", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Mobile Card View */}
          {mobile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {inquiries.length === 0 ? (
                <p style={{ textAlign: "center", color: "#888", padding: "24px 12px" }}>No inquiries found.</p>
              ) : (
                inquiries.map((inq) => {
                  const isChecked = selected.has(inq.InquiryID);
                  const matchCount = inq.MatchingItemIDs?.length || 0;
                  return (
                    <div key={inq.InquiryID} style={{
                      background: isChecked ? "#f0f4ff" : "#fff",
                      border: "1px solid #eee",
                      borderRadius: 8,
                      padding: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#003366", marginBottom: 4 }}>
                            #{inq.InquiryID} • {formatDate(inq.InquiryDate || inq.ReceivedDate)}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{inq.CustomerName || "—"}</div>
                          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{inq.CustomerCompany || ""}</div>
                        </div>
                        {productFilterActive && (
                          <input type="checkbox" checked={isChecked} onChange={() => toggleRow(inq.InquiryID)}
                            style={{ cursor: "pointer", width: 18, height: 18, marginTop: 4 }} />
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ background: STATUS_COLORS[inq.Status] || "#eee", padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                          {inq.Status}
                        </span>
                        <span style={{ background: "#e8f0fe", color: "#1a56db", borderRadius: 12, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                          {inq.ItemCount} product{inq.ItemCount !== 1 ? "s" : ""}
                        </span>
                        {matchCount > 0 && (
                          <span style={{ background: "#003366", color: "#fff", borderRadius: 12, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                            {matchCount} match{matchCount !== 1 ? "es" : ""}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#666" }}>{inq.Source || "—"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => onOpen(inq.InquiryID)}
                          style={{ flex: 1, background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Open
                        </button>
                        <button onClick={() => handleDeleteClick(inq.InquiryID)} disabled={deleting === inq.InquiryID}
                          style={{ flex: 1, background: deleting === inq.InquiryID ? "#ccc" : "#d32f2f", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 12 }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {modal?.type === "confirm" && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: mobile ? 16 : 0
        }}
          onClick={() => setModal(null)}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: mobile ? 20 : 28,
            width: "100%",
            maxWidth: 420,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#d32f2f", fontSize: mobile ? 16 : 18 }}>Delete Inquiry?</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 24px", color: "#555", lineHeight: 1.5, fontSize: mobile ? 13 : 14 }}>
              Are you sure you want to delete this inquiry? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, flexDirection: mobile ? "column-reverse" : "row" }}>
              <button onClick={() => confirmDelete(modal.inquiryId)}
                style={{
                  flex: 1,
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: mobile ? "12px 16px" : "10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14
                }}>
                Delete
              </button>
              <button onClick={() => setModal(null)}
                style={{
                  flex: 1,
                  background: "#eee",
                  color: "#333",
                  border: "none",
                  borderRadius: 6,
                  padding: mobile ? "12px 16px" : "10px",
                  cursor: "pointer",
                  fontSize: 14
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
