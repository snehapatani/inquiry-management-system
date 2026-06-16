import { useEffect, useState, useCallback } from "react";
import {
  getWorkItems, getQuotes, matchVendors, createQuote, setBestQuote, createVendor, toggleSelectItem, getVendors, sendResponse, updateInquiryStatus, getInquiry,
} from "../api";
import ProductDetailCard from "../components/ProductDetailCard";

// ── small helpers ─────────────────────────────────────────────
function groupByInquiry(items) {
  const map = {};
  for (const item of items) {
    if (!map[item.InquiryID]) {
      map[item.InquiryID] = {
        InquiryID: item.InquiryID,
        CustomerName: item.CustomerName,
        CustomerCompany: item.CustomerCompany,
        items: [],
      };
    }
    map[item.InquiryID].items.push(item);
  }
  return Object.values(map);
}

const inputStyle = {
  display: "block", width: "100%", padding: "5px 8px",
  borderRadius: 5, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box",
};

// ── main component ─────────────────────────────────────────────
export default function WorkQueue({ onOpenInquiry, user = null }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState({});         // itemId → quotes[]
  const [matches, setMatches] = useState({});       // itemId → vendors[]
  const [matchSearched, setMatchSearched] = useState({});
  const [vendorsOpen, setVendorsOpen] = useState({});
  const [expanded, setExpanded] = useState({});     // itemId → bool
  const [newQuote, setNewQuote] = useState({});     // itemId → form
  const [quoteError, setQuoteError] = useState({});  // itemId → error string
  const [vendors, setVendors] = useState([]);
  const [responseModal, setResponseModal] = useState(null); // { inquiryId, groups }
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [items, vlist] = await Promise.all([getWorkItems(), getVendors()]);
    const grouped = groupByInquiry(items);
    setGroups(grouped);
    setVendors(vlist);
    // load quotes for every item
    const q = {};
    for (const g of grouped) {
      for (const item of g.items) {
        q[item.ItemID] = await getQuotes(item.ItemID);
      }
    }
    setQuotes(q);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── vendor matching ──────────────────────────────────────────
  async function handleMatch(itemId) {
    const result = await matchVendors(itemId);
    setMatches(m => ({ ...m, [itemId]: result }));
    setMatchSearched(s => ({ ...s, [itemId]: true }));
    setVendorsOpen(o => ({ ...o, [itemId]: result.length > 0 }));
    const newStatus = result.length > 0 ? "Matched" : "No Vendor";
    setGroups(gs => gs.map(g => ({
      ...g,
      items: g.items.map(it => it.ItemID === itemId ? { ...it, MatchStatus: newStatus } : it),
    })));
  }

  // ── quotes ───────────────────────────────────────────────────
  function updateNewQuote(itemId, field, value) {
    if (field === "CreatedBy") localStorage.setItem("createdBy", value);
    setNewQuote(n => {
      const existing = n[itemId] || {};
      const base = existing.CreatedBy === undefined
        ? { ...existing, CreatedBy: localStorage.getItem("createdBy") || "" }
        : existing;
      return { ...n, [itemId]: { ...base, [field]: value } };
    });
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

    // Duplicate check: same vendor + same price
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
  }

  // ── remove from queue ────────────────────────────────────────
  async function handleRemove(itemId, inquiryId) {
    await toggleSelectItem(itemId);
    setGroups(gs => gs
      .map(g => g.InquiryID === inquiryId
        ? { ...g, items: g.items.filter(it => it.ItemID !== itemId) }
        : g)
      .filter(g => g.items.length > 0)
    );
  }

  // ── send response & close ────────────────────────────────────
  async function openResponseModal(group) {
    // Refresh quotes before generating response to ensure latest data
    const refreshedQuotes = {};
    for (const item of group.items) {
      refreshedQuotes[item.ItemID] = await getQuotes(item.ItemID);
    }
    setQuotes(q => ({ ...q, ...refreshedQuotes }));

    const lines = [`Dear ${group.CustomerName || "Customer"},`, ""];
    lines.push("Please find our best prices for your inquiry:");
    lines.push("");
    for (const item of group.items) {
      const itemQuotes = refreshedQuotes[item.ItemID] || [];
      // Get best price: first try marked as best, then most recent, then any quote
      const best = itemQuotes.find(q => q.IsBestPrice) || itemQuotes[0];

      lines.push(`• ${item.ProductNameNorm || item.ProductNameRaw} — ${item.Quantity || ""} ${item.Unit || ""}`);

      if (best && best.QuotedPrice) {
        lines.push(`  Price: ${best.Currency || "INR"} ${best.QuotedPrice}${best.PriceUnit ? " / " + best.PriceUnit : ""}  |  Lead Time: ${best.LeadTimeDays || "—"} days${best.Notes ? " | " + best.Notes : ""}`);
      } else if (itemQuotes.length > 0) {
        // If quote exists but no price, still show vendor info
        lines.push(`  Quote received from: ${itemQuotes[0].VendorName || "Vendor"}  |  Awaiting final confirmation`);
      } else {
        lines.push(`  Quote: Pending`);
      }
      lines.push("");
    }
    lines.push("Regards,\nInquiry MS Team");
    setResponseText(lines.join("\n"));
    setResponseModal(group);
  }

  async function handleSendAndClose() {
    if (!responseModal) return;
    setSending(true);
    await sendResponse({
      InquiryID: responseModal.InquiryID,
      Channel: "Email",
      MessageBody: responseText,
      SentBy: localStorage.getItem("createdBy") || "User",
    });
    for (const item of responseModal.items) {
      await toggleSelectItem(item.ItemID);
    }

    // Fetch the FULL inquiry to get ALL items (not just work queue items)
    const fullInquiry = await getInquiry(responseModal.InquiryID);
    const allInquiryItems = fullInquiry.Items || [];

    // Refresh quotes for all items to check current status
    const allQuotes = {};
    for (const item of allInquiryItems) {
      allQuotes[item.ItemID] = await getQuotes(item.ItemID);
    }

    // Check if ALL items in the entire inquiry have best prices quoted
    const allItemsQuoted = allInquiryItems.length > 0 && allInquiryItems.every(item => {
      const itemQuotes = allQuotes[item.ItemID] || [];
      return itemQuotes.some(q => q.IsBestPrice);
    });

    // Status should be "Closed" only if ALL products in inquiry are quoted
    // Otherwise "Quoted" (some products have quotes) or "In Progress" (no quotes yet)
    let newStatus = "Quoted";
    if (allItemsQuoted && allInquiryItems.length > 0) {
      newStatus = "Closed";
    } else if (allInquiryItems.every(item => {
      const itemQuotes = allQuotes[item.ItemID] || [];
      return itemQuotes.length === 0;
    })) {
      newStatus = "In Progress"; // No quotes at all yet
    }

    await updateInquiryStatus(responseModal.InquiryID, newStatus);

    setSending(false);
    setResponseModal(null);
    setResponseText("");
    setGroups(gs => gs.filter(g => g.InquiryID !== responseModal.InquiryID));
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#003366" }}>Work Queue</h2>
        <span style={{ fontSize: 13, color: "#888" }}>
          {groups.reduce((n, g) => n + g.items.length, 0)} product(s) across {groups.length} inquiry(s)
        </span>
      </div>

      {groups.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 10, padding: 40, textAlign: "center", color: "#888", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          No products in the work queue.<br />
          <span style={{ fontSize: 13 }}>Open an inquiry and click <b>+ Work Queue</b> on any product.</span>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.InquiryID} style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 20, overflow: "visible" }}>
            {/* Inquiry group header */}
            <div style={{ background: "#003366", color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => onOpenInquiry(group.InquiryID)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, borderRadius: 5, padding: "3px 10px" }}>
                  Inquiry #{group.InquiryID}
                </button>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{group.CustomerName}</span>
                {group.CustomerCompany && <span style={{ fontSize: 13, opacity: 0.8 }}>· {group.CustomerCompany}</span>}
                <span style={{ fontSize: 12, opacity: 0.7 }}>{group.items.length} product{group.items.length !== 1 ? "s" : ""}</span>
              </div>
              <button onClick={() => openResponseModal(group).catch(e => console.error("Error opening response modal:", e))}
                style={{ background: "#fff", color: "#003366", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                ✉ Send Response
              </button>
            </div>

            {/* Products */}
            {group.items.map(item => (
              <ProductDetailCard
                key={item.ItemID}
                item={item}
                quotes={quotes[item.ItemID]}
                vendors={vendors}
                user={user}
                mode="queue"
                onRemove={(itemId) => handleRemove(itemId, group.InquiryID)}
              />
            ))}
          </div>
        ))
      )}

      {/* Send Response & Close Modal */}
      {responseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setResponseModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 580, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#003366" }}>Send Response — Inquiry #{responseModal.InquiryID}</h3>
              <button onClick={() => setResponseModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
              Sending will update the inquiry to <b>Quoted</b> and remove all its products from the work queue.
            </p>
            <textarea value={responseText} onChange={e => setResponseText(e.target.value)} rows={12}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={handleSendAndClose} disabled={sending || !responseText.trim()}
                style={{ flex: 1, background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {sending ? "Sending…" : "Send Response"}
              </button>
              <button onClick={() => setResponseModal(null)}
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
