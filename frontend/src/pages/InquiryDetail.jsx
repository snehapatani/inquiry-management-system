import { useEffect, useState } from "react";
import { getInquiry, getQuotes, sendResponse, updateInquiryStatus, getVendors, toggleSelectItem } from "../api";
import { formatDate } from "../utils";
import ProductDetailCard from "../components/ProductDetailCard";

export default function InquiryDetail({ id, onBack, user = null }) {
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState({});          // itemId → [quotes]
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [vendors, setVendors] = useState([]);

  useEffect(() => { load(); getVendors().then(setVendors); }, [id]);

  async function load() {
    setLoading(true);
    const data = await getInquiry(id);
    setInquiry(data);
    // load quotes for each item
    const q = {};
    for (const item of data.Items) {
      q[item.ItemID] = await getQuotes(item.ItemID);
    }
    setQuotes(q);
    setLoading(false);
  }

  async function handleToggleSelect(itemId) {
    const { IsSelected } = await toggleSelectItem(itemId);
    setInquiry(inq => ({
      ...inq,
      Items: inq.Items.map(it =>
        it.ItemID === itemId ? { ...it, IsSelected } : it
      ),
    }));

    // Auto-transition to "In Progress" when any product is added to work queue
    if (IsSelected && inquiry.Status === "New") {
      await updateInquiryStatus(id, "In Progress").then(load);
    }
  }

  async function handleMatch(itemId) {
    try {
      const result = await matchVendors(itemId);
      setMatches(m => ({ ...m, [itemId]: result, [itemId + "_open"]: result.length > 0 }));
      setMatchSearched(s => ({ ...s, [itemId]: true }));
      const newStatus = result.length > 0 ? "Matched" : "No Vendor";
      setInquiry(inq => ({
        ...inq,
        Items: inq.Items.map(it =>
          it.ItemID === itemId ? { ...it, MatchStatus: newStatus } : it
        ),
      }));
    } catch (e) {
      alert("Failed to find vendors: " + e.message);
    }
  }

  async function handleAddQuote(itemId) {
    const form = newQuote[itemId] || {};
    const vendorName = form._vendorName?.trim();
    if (!vendorName || !form.QuotedPrice) return;

    let vendorId = form.VendorID;
    if (!vendorId) {
      const created = await createVendor({ VendorName: vendorName });
      vendorId = created.VendorID;
      getVendors().then(setVendors);
    }

    // Duplicate check: same vendor + same price already in list
    const existing = (quotes[itemId] || []).find(q => q.VendorID === Number(vendorId));
    if (existing) {
      const samePrice = parseFloat(existing.QuotedPrice) === parseFloat(form.QuotedPrice);
      if (samePrice) {
        setQuoteError(e => ({ ...e, [itemId]: `Quote from ${vendorName} at ${existing.Currency} ${existing.QuotedPrice} already exists.` }));
        return;
      }
    }

    setQuoteError(e => ({ ...e, [itemId]: "" }));
    try {
      const payload = {
        ItemID: itemId,
        VendorID: vendorId,
        QuotedPrice: form.QuotedPrice || null,
        PriceUnit: form.PriceUnit || null,
        LeadTimeDays: form.LeadTimeDays ? Number(form.LeadTimeDays) : null,
        QuotedDate: form.QuotedDate || null,
        Notes: form.Notes || null,
        CreatedBy: form.CreatedBy || null,
      };
      await createQuote(payload);
      const updated = await getQuotes(itemId);
      setQuotes(q => ({ ...q, [itemId]: updated }));
      setNewQuote(n => ({ ...n, [itemId]: {} }));
    } catch (e) {
      setQuoteError(err => ({ ...err, [itemId]: "Failed to add quote: " + e.message }));
    }
  }

  async function handleSetBest(itemId, quoteId) {
    await setBestQuote(itemId, quoteId);
    const updated = await getQuotes(itemId);
    setQuotes(q => ({ ...q, [itemId]: updated }));
    await load();
  }

  async function handleSendResponse() {
    setSending(true);
    await sendResponse({ InquiryID: id, Channel: "Email", MessageBody: responseText, SentBy: "User" });
    setSending(false);
    setResponseText("");
    setShowResponse(false);
    load();
  }

  function updateNewQuote(itemId, field, value) {
    if (field === "CreatedBy") localStorage.setItem("createdBy", value);
    setNewQuote(n => {
      const existing = n[itemId] || {};
      // Pre-fill CreatedBy from localStorage when form is first touched
      const base = existing.CreatedBy === undefined
        ? { ...existing, CreatedBy: localStorage.getItem("createdBy") || "" }
        : existing;
      return { ...n, [itemId]: { ...base, [field]: value } };
    });
  }

  if (loading) return <p>Loading…</p>;
  if (!inquiry) return <p>Not found.</p>;

  const { Customer, Items, Status, Source, RawText, ReceivedDate } = inquiry;

  // Build response template from best quotes
  function buildResponseTemplate() {
    const lines = [`Dear ${Customer?.Name || "Customer"},`, ""];
    lines.push("Please find our best prices for your inquiry:");
    lines.push("");
    Items.forEach(item => {
      const itemQuotes = quotes[item.ItemID] || [];
      const best = itemQuotes.find(q => q.IsBestPrice) || itemQuotes[0];
      if (best) {
        lines.push(`• ${item.ProductNameNorm || item.ProductNameRaw} — ${item.Quantity} ${item.Unit || ""}`);
        lines.push(`  Price: ${best.Currency} ${best.QuotedPrice} ${best.PriceUnit || ""}  |  Lead Time: ${best.LeadTimeDays || "—"} days`);
        lines.push("");
      } else {
        lines.push(`• ${item.ProductNameNorm || item.ProductNameRaw} — Quote pending`);
        lines.push("");
      }
    });
    lines.push("Regards,\nInquiry MS Team");
    setResponseText(lines.join("\n"));
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#003366", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>
        ← Back to Inquiries
      </button>

      {/* Header */}
      <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", color: "#003366" }}>Inquiry #{id}</h2>
            <div style={{ fontSize: 13, color: "#555" }}>
              <b>{Customer?.Name}</b>{Customer?.Company ? ` · ${Customer.Company}` : ""}
              {Customer?.Phone ? ` · 📞 ${Customer.Phone}` : ""}
              {Customer?.Email ? ` · ✉️ ${Customer.Email}` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              {Source} · {formatDate(ReceivedDate)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowResponse(true)}
              style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              ✉ Send Response
            </button>
            <select value={Status} onChange={e => updateInquiryStatus(id, e.target.value).then(load)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", fontWeight: 600, color: "#003366" }}>
              {["New","In Progress","Quoted","Closed"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {RawText && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>View original message</summary>
            <pre style={{ fontSize: 12, background: "#f5f5f5", padding: 10, borderRadius: 6, marginTop: 6, whiteSpace: "pre-wrap" }}>{RawText}</pre>
          </details>
        )}
      </div>

      {/* Products & Quotes */}
      {Items.map(item => (
        <ProductDetailCard
          key={item.ItemID}
          item={item}
          quotes={quotes[item.ItemID]}
          vendors={vendors}
          user={user}
          mode="detail"
          isSelected={item.IsSelected}
          onAddToQueue={handleToggleSelect}
        />
      ))}

      {/* Send Response Modal */}
      {showResponse && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowResponse(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 560, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#003366" }}>Send Response to Customer</h3>
              <button onClick={() => setShowResponse(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            <button onClick={buildResponseTemplate}
              style={{ background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
              Auto-fill from Best Prices
            </button>
            <textarea value={responseText} onChange={e => setResponseText(e.target.value)} rows={10}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={handleSendResponse} disabled={sending || !responseText.trim()}
                style={{ flex: 1, background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {sending ? "Saving…" : "Log Response as Sent"}
              </button>
              <button onClick={() => setShowResponse(false)}
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
