import { matchVendors, createQuote, setBestQuote, getQuotes, createVendor, getVendors } from "../api";
import { formatDate } from "../utils";
import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function ProductDetailCard({ item, quotes: initialQuotes = [], vendors = [], user = null, mode = "detail", onRemove, onAddToQueue, isSelected }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quotes, setQuotes] = useState(initialQuotes || []);
  const [matches, setMatches] = useState([]);
  const [matchSearched, setMatchSearched] = useState(false);
  const [newQuote, setNewQuote] = useState({});
  const [quoteError, setQuoteError] = useState("");
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [showCalendarByItem, setShowCalendarByItem] = useState({});
  const [mobile, setMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  function formatDateStorage(displayStr) {
    if (!displayStr) return "";
    const parts = displayStr.split('/');
    if (parts.length !== 3) return "";
    const [day, month, year] = parts;
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return "";
    return `${year}-${month}-${day}`;
  }

  async function handleMatch() {
    try {
      const result = await matchVendors(item.ItemID);
      setMatches(result);
      setVendorsOpen(result.length > 0);
      setMatchSearched(true);
    } catch (e) {
      alert("Failed to find vendors: " + e.message);
    }
  }

  function updateNewQuote(field, value) {
    setNewQuote(n => ({ ...n, [field]: value }));
  }

  async function handleAddQuote() {
    const vendorName = newQuote._vendorName?.trim();
    if (!vendorName || !newQuote.QuotedPrice) return;

    let vendorId = newQuote.VendorID;
    if (!vendorId) {
      const created = await createVendor({ VendorName: vendorName });
      vendorId = created.VendorID;
      getVendors().then(() => {});
    }

    const existing = quotes.find(q => q.VendorID === Number(vendorId));
    if (existing) {
      const samePrice = parseFloat(existing.QuotedPrice) === parseFloat(newQuote.QuotedPrice);
      if (samePrice) {
        setQuoteError(`Quote from ${vendorName} at ${existing.Currency} ${existing.QuotedPrice} already exists.`);
        return;
      }
    }

    setQuoteError("");
    try {
      const createdByName = localStorage.getItem("createdBy") || "Unknown";
      const payload = {
        ItemID: item.ItemID,
        VendorID: vendorId,
        QuotedPrice: newQuote.QuotedPrice || null,
        PriceUnit: newQuote.PriceUnit || null,
        LeadTimeDays: newQuote.LeadTimeDays ? Number(newQuote.LeadTimeDays) : null,
        QuotedDate: newQuote.QuotedDate || null,
        Notes: newQuote.Notes || null,
        CreatedBy: createdByName,
      };
      await createQuote(payload);
      const updated = await getQuotes(item.ItemID);
      setQuotes(updated);
      setNewQuote({});
    } catch (e) {
      setQuoteError("Failed to add quote: " + e.message);
    }
  }

  async function handleSetBest(quoteId) {
    try {
      await setBestQuote(item.ItemID, quoteId);
      const updated = await getQuotes(item.ItemID);
      setQuotes(updated);
    } catch (e) {
      alert("Failed to set best quote: " + e.message);
    }
  }

  const itemQuotes = quotes || [];
  const bestQuote = itemQuotes.find(q => q.IsBestPrice);
  const form = newQuote || {};

  return (
    <div key={item.ItemID} style={{ background: mode === "detail" ? "#fff" : "transparent", borderRadius: mode === "detail" ? 10 : 0, boxShadow: mode === "detail" ? "0 1px 4px rgba(0,0,0,0.1)" : "none", marginBottom: mode === "detail" ? 10 : 0, overflow: "visible", borderBottom: mode === "queue" ? "1px solid #eef0f5" : "none" }}>

      {/* Product Header */}
      <div onClick={() => setIsExpanded(!isExpanded)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: mode === "detail" ? "14px 20px" : "12px 20px", cursor: "pointer", userSelect: "none", background: isExpanded ? "#f5f8ff" : "#fff" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#003366", fontWeight: 600 }}>{isExpanded ? "▾" : "▸"}</span>
          <span style={{ fontWeight: 700, fontSize: mode === "detail" ? 15 : 14, color: "#003366", userSelect: "text" }}>{item.ProductNameNorm || item.ProductNameRaw}</span>

          {mode === "detail" && item.ProductNameNorm && item.ProductNameNorm !== item.ProductNameRaw && (
            <span style={{ fontSize: 11, color: "#aaa" }}>({item.ProductNameRaw})</span>
          )}

          <span style={{ fontSize: 13, color: "#555" }}>{item.Quantity} {item.Unit}</span>

          {item.Grade && <span style={{ fontSize: 12, background: "#e8f4fd", padding: "2px 8px", borderRadius: 10 }}>{item.Grade}</span>}

          {mode === "queue" && bestQuote && (
            <span style={{ fontSize: 12, background: "#e6f7ee", color: "#1a7a4a", padding: "2px 10px", borderRadius: 10, fontWeight: 600 }}>
              Best: {bestQuote.Currency} {bestQuote.QuotedPrice}{bestQuote.PriceUnit ? " / " + bestQuote.PriceUnit : ""}
            </span>
          )}

          {itemQuotes.length > 0 && (
            <span style={{ fontSize: 12, background: "#eef4ff", color: "#003366", padding: "2px 8px", borderRadius: 10 }}>
              {itemQuotes.length} quote{itemQuotes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 12, color: item.MatchStatus === "Matched" ? "#1a7a4a" : "#888", whiteSpace: "nowrap" }}>
            {item.MatchStatus}
          </span>

          {mode === "detail" && (
            <button onClick={() => onAddToQueue?.(item.ItemID)}
              title={isSelected ? "Remove from Work Queue" : "Add to Work Queue"}
              style={{ background: isSelected ? "#003366" : "#eef4ff", color: isSelected ? "#fff" : "#003366", border: "1px solid #aac4ee", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              {isSelected ? "✓ In Queue" : "+ Work Queue"}
            </button>
          )}

          {mode === "queue" && (
            <button onClick={() => onRemove?.(item.ItemID)}
              title="Remove from queue"
              style={{ background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div style={{ padding: "0 20px 16px", borderTop: "1px solid #eee" }}>

          {/* Find/Refresh Vendors Section */}
          <div style={{ marginBottom: 16, paddingTop: 12 }}>
            <button onClick={handleMatch}
              style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {matches.length > 0 ? "🔄 Refresh Vendors" : "🔍 Find Matching Vendors"}
            </button>
          </div>

          {/* Matched Vendors */}
          {matchSearched && matches.length === 0 && (
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>No matching vendors found.</div>
          )}

          {matches.length > 0 && (
            <div style={{ background: "#f5f8ff", borderRadius: 8, padding: 12, marginBottom: 12, border: "1px solid #d0e0ff" }}>
              <div onClick={() => setVendorsOpen(!vendorsOpen)}
                style={{ fontWeight: 600, fontSize: 12, cursor: "pointer", color: "#003366", userSelect: "none", marginBottom: 8 }}>
                {vendorsOpen ? "▾" : "▸"} Matched Vendors ({matches.length})
              </div>
              {vendorsOpen && matches.length > 0 && (
                mobile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    {matches.map(m => (
                      <div key={m.VendorProductID} style={{ background: "#fff", border: "1px solid #d0e0ff", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#003366", marginBottom: 8 }}>{m.VendorName || "—"}</div>
                        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>
                          <div><b>Contact:</b> {m.ContactPerson || "—"}</div>
                          <div><b>Phone:</b> {m.Phone || "—"}</div>
                          <div><b>Product:</b> {m.ProductName || "—"}</div>
                          <div><b>Grade:</b> {m.Grade || "—"}</div>
                          <div><b>Lead Days:</b> {m.LeadTimeDays || "—"}</div>
                          <div><b>Price:</b> {m.LastCurrency} {m.LastQuotedPrice || "—"}</div>
                          <div><b>Date:</b> {formatDate(m.LastQuotedDate)}</div>
                        </div>
                        <button onClick={() => {
                          updateNewQuote("_vendorName", m.VendorName);
                          updateNewQuote("VendorID", m.VendorID);
                          updateNewQuote("QuotedPrice", m.LastQuotedPrice || "");
                          updateNewQuote("PriceUnit", m.LastPriceUnit || "");
                          updateNewQuote("LeadTimeDays", m.LeadTimeDays || "");
                          updateNewQuote("QuotedDate", m.LastQuotedDate ? m.LastQuotedDate.split('T')[0] : "");
                        }}
                          style={{ width: "100%", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 4, padding: "6px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          + Add to Quote
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: "#e0ebff", borderBottom: "1px solid #d0e0ff" }}>
                        {["Vendor", "Contact", "Phone", "Product", "Grade", "Lead Days", "Previous Price", "Quoted Date", "Action"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map(m => (
                        <tr key={m.VendorProductID} style={{ borderBottom: "1px solid #e0e8ff" }}>
                          <td style={{ padding: "6px 8px", fontWeight: 500 }}>{m.VendorName || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{m.ContactPerson || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{m.Phone || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{m.ProductName || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{m.Grade || "—"}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>{m.LeadTimeDays || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{m.LastCurrency} {m.LastQuotedPrice || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{formatDate(m.LastQuotedDate)}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <button onClick={() => {
                              updateNewQuote("_vendorName", m.VendorName);
                              updateNewQuote("VendorID", m.VendorID);
                              updateNewQuote("QuotedPrice", m.LastQuotedPrice || "");
                              updateNewQuote("PriceUnit", m.LastPriceUnit || "");
                              updateNewQuote("LeadTimeDays", m.LeadTimeDays || "");
                              updateNewQuote("QuotedDate", m.LastQuotedDate ? m.LastQuotedDate.split('T')[0] : "");
                            }}
                              style={{ background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                              + Add to Quote
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}

          {/* Add Quote Form */}
          <div style={{ background: "#fffbf0", borderRadius: 8, padding: 12, marginBottom: 12, border: "1px solid #ffe0a0" }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Add Quote (after contacting vendor offline)</div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 11, color: "#666" }}>Vendor <span style={{ color: "#c00" }}>*</span></label>
                <input list={`vendor-list-${item.ItemID}`} placeholder="Type or select vendor…" value={form["_vendorName"] || ""}
                  onChange={e => {
                    const name = e.target.value;
                    const match = vendors.find(v => v.VendorName.toLowerCase() === name.toLowerCase());
                    updateNewQuote("_vendorName", name);
                    updateNewQuote("VendorID", match ? match.VendorID : "");
                  }}
                  style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                <datalist id={`vendor-list-${item.ItemID}`}>
                  {vendors.map(v => <option key={v.VendorID} value={v.VendorName} />)}
                </datalist>
              </div>
              {[["QuotedPrice","Price","number"],["PriceUnit","Unit","text"],["LeadTimeDays","Lead Days","number"],["Notes","Notes","text"]].map(([f,label,type]) => (
                <div key={f}>
                  <label style={{ fontSize: 11, color: "#666" }}>{label}{f === "QuotedPrice" && <span style={{ color: "#c00" }}> *</span>}</label>
                  <input type={type} value={form[f] || ""} onChange={e => updateNewQuote(f, e.target.value)}
                    style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ position: "relative", zIndex: 50 }}>
                <label style={{ fontSize: 11, color: "#666" }}>Quote Date</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={form["QuotedDate"] ? formatDateDisplay(form["QuotedDate"]) : formatDateDisplay(new Date().toISOString().split('T')[0])}
                    onClick={() => setShowCalendarByItem(c => ({ ...c, [item.ItemID]: !c[item.ItemID] }))}
                    readOnly
                    style={{ display: "block", width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box", cursor: "pointer", background: "#fafafa" }} />
                  {showCalendarByItem[item.ItemID] && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 9999, background: "white", border: "1px solid #ccc", borderRadius: 5, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                      <Calendar
                        value={form["QuotedDate"] ? new Date(form["QuotedDate"]) : new Date()}
                        onChange={(date) => {
                          const displayValue = formatDateDisplay(date.toISOString().split('T')[0]);
                          const storageValue = formatDateStorage(displayValue);
                          updateNewQuote("QuotedDate", storageValue);
                          setShowCalendarByItem(c => ({ ...c, [item.ItemID]: false }));
                        }}
                        maxDate={new Date()}
                      />
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleAddQuote}
                disabled={!form._vendorName?.trim() || !form.QuotedPrice}
                title={!form._vendorName?.trim() ? "Enter a vendor name" : !form.QuotedPrice ? "Enter a quoted price" : ""}
                style={{ background: (!form._vendorName?.trim() || !form.QuotedPrice) ? "#ccc" : "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, padding: mobile ? "8px 12px" : "6px 12px", cursor: (!form._vendorName?.trim() || !form.QuotedPrice) ? "not-allowed" : "pointer", fontSize: 13, width: mobile ? "100%" : "auto", marginTop: mobile ? 8 : 0 }}>
                Add
              </button>
            </div>
            {quoteError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#c00", background: "#fff3f3", border: "1px solid #fcc", borderRadius: 5, padding: "5px 10px" }}>
                ⚠ {quoteError}
              </div>
            )}
          </div>

          {/* Quotes Table */}
          {itemQuotes.length > 0 && (
            mobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {itemQuotes.map(q => (
                  <div key={q.QuoteID} style={{ background: q.IsBestPrice ? "#e6f7ee" : "#fff", border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#003366", marginBottom: 8 }}>
                      {vendors.find(v => v.VendorID === q.VendorID)?.VendorName || `#${q.VendorID}`}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
                      <div><b>Price:</b> {q.Currency} {q.QuotedPrice}</div>
                      <div><b>Unit:</b> {q.PriceUnit || "—"}</div>
                      <div><b>Lead Days:</b> {q.LeadTimeDays || "—"}</div>
                      <div><b>Notes:</b> {q.Notes || "—"}</div>
                      <div><b>Created By:</b> {q.CreatedBy || "—"}</div>
                      <div><b>Date:</b> {formatDate(q.QuotedDate)}</div>
                    </div>
                    <div>
                      {q.IsBestPrice
                        ? <span style={{ color: "#1a7a4a", fontWeight: 700, fontSize: 12 }}>✓ Best Price</span>
                        : <button onClick={() => handleSetBest(q.QuoteID)}
                            style={{ width: "100%", background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            Set as Best Price
                          </button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["Vendor","Price","Unit","Lead Days","Notes","Created By","Date","Best Price"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemQuotes.map(q => (
                    <tr key={q.QuoteID} style={{ background: q.IsBestPrice ? "#e6f7ee" : "transparent", borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 10px" }}>
                        {vendors.find(v => v.VendorID === q.VendorID)?.VendorName || `#${q.VendorID}`}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{q.Currency} {q.QuotedPrice}</td>
                      <td style={{ padding: "6px 10px" }}>{q.PriceUnit || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>{q.LeadTimeDays || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>{q.Notes || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>{q.CreatedBy || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>{formatDate(q.QuotedDate)}</td>
                      <td style={{ padding: "6px 10px" }}>
                        {q.IsBestPrice
                          ? <span style={{ color: "#1a7a4a", fontWeight: 700 }}>✓ Best</span>
                          : <button onClick={() => handleSetBest(q.QuoteID)}
                              style={{ background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>
                              Set Best
                            </button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
