import { useEffect, useState } from "react";
import { getInquiries, bulkSelectItems } from "../api";
import { formatDate } from "../utils";

const STATUS_COLORS = {
  New: "#e8f4fd",
  "In Progress": "#fff7e6",
  Quoted: "#e6f7ee",
  Closed: "#f0f0f0",
};

export default function InquiryList({ onOpen, onGoToWorkQueue }) {
  const [inquiries, setInquiries] = useState([]);
  const [filter, setFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [createdBySearch, setCreatedBySearch] = useState("");
  const [sortBy, setSortBy] = useState("ReceivedDate");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set()); // set of InquiryIDs
  const [adding, setAdding] = useState(false);

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

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Handle date strings
      if (column === "ReceivedDate") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      // Handle numbers
      else if (typeof aVal === "number" && typeof bVal === "number") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      // Handle strings
      else {
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

  useEffect(() => { fetchInquiries(filter, customerSearch, productSearch, createdBySearch); }, [filter]);

  useEffect(() => {
    if (inquiries.length > 0) {
      setInquiries(prev => sortInquiries(prev, sortBy, sortDir));
    }
  }, [sortBy, sortDir]);

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function handleSearch() { fetchInquiries(filter, customerSearch, productSearch, createdBySearch, sortBy, sortDir); }
  function handleKeyDown(e) { if (e.key === "Enter") handleSearch(); }

  useEffect(() => { fetchInquiries(filter, customerSearch, productSearch, createdBySearch, sortBy, sortDir); }, [sortBy, sortDir]);

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
    // Collect all matching item IDs from selected inquiries
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

  const allSelected = inquiries.length > 0 && selected.size === inquiries.length;
  const someSelected = selected.size > 0;
  const totalMatchingItems = inquiries
    .filter(inq => selected.has(inq.InquiryID))
    .reduce((n, inq) => n + (inq.MatchingItemIDs?.length || 0), 0);

  const sortableColumns = {
    "#": "InquiryID",
    "Date": "ReceivedDate",
    "Customer": "CustomerName",
    "Source": "Source",
    "Created By": "CreatedBy",
    "Status": "Status",
  };

  function renderSortHeader(label) {
    const colName = sortableColumns[label];
    const isSorted = sortBy === colName;
    const indicator = isSorted ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th key={label}
        onClick={() => handleSort(colName)}
        style={{
          padding: "10px 14px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          background: isSorted ? "#003366" : "transparent",
          color: isSorted ? "#fff" : "inherit",
          userSelect: "none",
        }}>
        {label}{indicator}
      </th>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#003366" }}>Inquiries</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
          <option value="">All Status</option>
          <option>New</option>
          <option>In Progress</option>
          <option>Quoted</option>
          <option>Closed</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search by customer name…"
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
        />
        <input
          placeholder="Search by product name…"
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
        />
        <input
          placeholder="Search by created by…"
          value={createdBySearch}
          onChange={e => setCreatedBySearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
        />
        <button onClick={handleSearch}
          style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Search
        </button>
        {(customerSearch || productSearch || createdBySearch) && (
          <button onClick={() => { setCustomerSearch(""); setProductSearch(""); setCreatedBySearch(""); setSortBy("ReceivedDate"); setSortDir("desc"); fetchInquiries(filter, "", "", "", "ReceivedDate", "desc"); }}
            style={{ background: "#eee", color: "#555", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 13 }}>
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar — only when product search is active and rows are selected */}
      {productFilterActive && someSelected && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#eef4ff", border: "1px solid #aac4ee", borderRadius: 8, padding: "10px 16px", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#003366", fontWeight: 600 }}>
            {selected.size} inquiry(s) selected — {totalMatchingItems} matching product(s)
          </span>
          <button onClick={handleAddToWorkQueue} disabled={adding || totalMatchingItems === 0}
            style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {adding ? "Adding…" : `+ Add ${totalMatchingItems} to Work Queue`}
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 13 }}>
            Deselect all
          </button>
        </div>
      )}

      {loading ? <p>Loading...</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <thead>
            <tr style={{ background: "#003366", color: "#fff" }}>
              {productFilterActive && (
                <th style={{ padding: "10px 14px", width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    style={{ cursor: "pointer", width: 15, height: 15 }} />
                </th>
              )}
              {renderSortHeader("#")}
              {renderSortHeader("Date")}
              {renderSortHeader("Customer")}
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Products</th>
              {renderSortHeader("Source")}
              {renderSortHeader("Created By")}
              {renderSortHeader("Status")}
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>Action</th>
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
                <tr key={inq.InquiryID}
                  style={{ background: isChecked ? "#f0f4ff" : i % 2 === 0 ? "#fff" : "#f9f9f9", borderBottom: "1px solid #eee" }}>
                  {productFilterActive && (
                    <td style={{ padding: "10px 14px" }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleRow(inq.InquiryID)}
                        style={{ cursor: "pointer", width: 15, height: 15 }} />
                    </td>
                  )}
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>#{inq.InquiryID}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{formatDate(inq.ReceivedDate)}</td>
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
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => onOpen(inq.InquiryID)}
                      style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
