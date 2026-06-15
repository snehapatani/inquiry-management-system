import { useState } from "react";
import { parseInquiry, createCustomer, createInquiry } from "../api";

const SOURCES = ["WhatsApp", "Email", "Phone", "Other"];
const CATEGORIES = ["End User", "Trader", "Distributor", "Not Identified"];

const fieldStyle = (err) => ({
  width: "100%", padding: 10, borderRadius: 6, fontSize: 13, resize: "vertical",
  boxSizing: "border-box",
  border: `1px solid ${err ? "#c00" : "#ccc"}`,
});

const inputStyle = (err) => ({
  padding: "7px 12px", borderRadius: 6, fontSize: 13,
  border: `1px solid ${err ? "#c00" : "#ccc"}`,
});

export default function NewInquiry({ onSaved }) {
  const [rawText, setRawText]   = useState("");
  const [source, setSource]     = useState("WhatsApp");
  const [inquiryDate, setInquiryDate] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return localStorage.getItem("inquiryDate") || today;
  });
  const [parsed, setParsed]     = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [saveErrors, setSaveErrors] = useState([]);
  const [touched, setTouched]   = useState({});
  const [createdBy, setCreatedBy] = useState(() => localStorage.getItem("createdBy") || "");

  const textErr    = touched.rawText   && !rawText.trim();
  const createdErr = touched.createdBy && !createdBy.trim();
  const canParse   = rawText.trim() && createdBy.trim();

  function touch(field) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  async function handleParse() {
    setTouched({ rawText: true, createdBy: true });
    if (!canParse) return;
    setParsing(true);
    setParsed(null);
    setError("");
    setSaveErrors([]);
    setSaved(false);
    try {
      const result = await parseInquiry(rawText);
      setParsed(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  function updateItem(idx, field, value) {
    setParsed(p => ({
      ...p,
      items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    }));
  }

  function addItem() {
    setParsed(p => ({
      ...p,
      items: [...p.items, { product_number: p.items.length + 1, product_name: "", quantity: "", unit: "KG", grade: "", manufacturer_pref: "" }],
    }));
  }

  function removeItem(idx) {
    setParsed(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  function handleClear() {
    setRawText("");
    setParsed(null);
    setError("");
    setSaveErrors([]);
    setTouched({});
  }

  function handleCancel() {
    setParsed(null);
    setError("");
    setSaveErrors([]);
  }

  function validateBeforeSave() {
    const errs = [];
    if (!parsed.customer_name?.trim()) errs.push("Customer name is required.");
    const validItems = parsed.items.filter(it => it.product_name?.trim());
    if (validItems.length === 0) errs.push("At least one product with a name is required.");
    return errs;
  }

  async function handleSave() {
    if (!parsed || saving || saved) return;
    const errs = validateBeforeSave();
    if (errs.length) { setSaveErrors(errs); return; }
    setSaving(true);
    setSaveErrors([]);
    setError("");
    try {
      const customer = await createCustomer({
        Name: parsed.customer_name || "Unknown",
        Company: parsed.customer_company,
        Email: parsed.customer_email,
        Phone: parsed.customer_phone,
        SourceChannel: source,
        CustomerCategory: parsed.customer_category || "Not Identified",
        InquiryDate: inquiryDate ? new Date(inquiryDate).toISOString() : null,
      });
      await createInquiry({
        CustomerID: customer.CustomerID,
        Source: source,
        InquiryDate: inquiryDate ? new Date(inquiryDate).toISOString() : null,
        RawText: rawText,
        CreatedBy: createdBy || null,
        Items: parsed.items
          .filter(it => it.product_name?.trim())
          .map(it => ({
            ProductNameRaw: it.product_name,
            Quantity: it.quantity ? parseFloat(it.quantity) : null,
            Unit: it.unit || null,
            Grade: it.grade || null,
            ManufacturerPref: it.manufacturer_pref || null,
          })),
      });
      setSaved(true);
      setTimeout(onSaved, 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#003366" }}>New Inquiry</h2>
      </div>

      {/* Step 1 */}
      <div style={{ marginBottom: 4 }}>
        <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
          Paste Inquiry Text <span style={{ color: "#c00" }}>*</span>
        </label>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          onBlur={() => touch("rawText")}
          rows={5}
          placeholder={"e.g. AZITHROMYCIN 125 KG, AMOXICILLIN 50 KG\nNaveen Khaitan, Apple Formulations"}
          style={fieldStyle(textErr)}
        />
        {textErr && <div style={{ color: "#c00", fontSize: 12, marginTop: 3 }}>Inquiry text is required.</div>}
      </div>

      <div style={{ display: "flex", gap: 12, margin: "14px 0 20px", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Source</label>
          <select value={source} onChange={e => setSource(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Created by <span style={{ color: "#c00" }}>*</span></label>
          <input
            placeholder="Enter your name"
            value={createdBy}
            onChange={e => { setCreatedBy(e.target.value); localStorage.setItem("createdBy", e.target.value); }}
            onBlur={() => touch("createdBy")}
            style={{ ...inputStyle(createdErr), width: 160 }}
          />
          {createdErr && <div style={{ color: "#c00", fontSize: 12, marginTop: 3 }}>Created by is required.</div>}
        </div>

        <button
          onClick={handleParse}
          disabled={parsing || !canParse}
          title={!canParse ? "Fill in the inquiry text and your name first" : ""}
          style={{
            background: canParse ? "#003366" : "#ccc",
            color: "#fff", border: "none", borderRadius: 6,
            padding: "8px 20px", cursor: canParse ? "pointer" : "not-allowed",
            fontWeight: 600, fontSize: 13, transition: "background 0.2s",
          }}>
          {parsing ? "Parsing…" : "Parse Inquiry"}
        </button>
      </div>

      {error && <div style={{ color: "#c00", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Step 2 */}
      {parsed && (
        <>
          <hr style={{ margin: "16px 0", borderColor: "#eee" }} />
          <h3 style={{ color: "#003366", marginTop: 0 }}>Review Parsed Data</h3>

          <div style={{ background: "#f0f6ff", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
              Customer Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[["customer_name","Name"],["customer_company","Company"],["customer_email","Email"],["customer_phone","Phone"]].map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: 12, color: "#555" }}>{label}{k === "customer_name" && <span style={{ color: "#c00" }}> *</span>}</label>
                  <input value={parsed[k] || ""} onChange={e => setParsed(p => ({ ...p, [k]: e.target.value }))}
                    style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, fontSize: 13, boxSizing: "border-box",
                      border: `1px solid ${k === "customer_name" && !parsed[k]?.trim() ? "#ffaa00" : "#ccc"}` }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#555" }}>Category</label>
                <select value={parsed.customer_category || ""} onChange={e => setParsed(p => ({ ...p, customer_category: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, fontSize: 13, boxSizing: "border-box", border: "1px solid #ccc" }}>
                  <option value="">Not Identified</option>
                  {CATEGORIES.filter(c => c !== "Not Identified").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#555" }}>Inquiry Date</label>
                <input type="date" value={inquiryDate} onChange={e => { setInquiryDate(e.target.value); localStorage.setItem("inquiryDate", e.target.value); }}
                  style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, fontSize: 13, boxSizing: "border-box", border: "1px solid #ccc" }} />
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
            Products <span style={{ color: "#666", fontWeight: 400 }}>({parsed.items.length})</span>
          </div>
          {parsed.items.map((item, idx) => (
            <div key={idx} style={{ background: "#f9f9f9", borderRadius: 8, padding: 14, marginBottom: 10, border: "1px solid #e0e0e0" }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>Item #{item.product_number || idx + 1}</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
                {[
                  ["product_name","Product Name","text"],
                  ["quantity","Qty","number"],
                  ["unit","Unit","text"],
                  ["grade","Grade","text"],
                  ["manufacturer_pref","Manufacturer Pref","text"],
                ].map(([f, label, type]) => (
                  <div key={f}>
                    <label style={{ fontSize: 11, color: "#666" }}>{label}{f === "product_name" && <span style={{ color: "#c00" }}> *</span>}</label>
                    <input type={type} value={item[f] || ""} onChange={e => updateItem(idx, f, e.target.value)}
                      style={{ display: "block", width: "100%", padding: "5px 8px", borderRadius: 5, fontSize: 13, boxSizing: "border-box",
                        border: `1px solid ${f === "product_name" && !item[f]?.trim() ? "#ffaa00" : "#ccc"}` }} />
                  </div>
                ))}
                <button onClick={() => removeItem(idx)}
                  style={{ background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}

          <button onClick={addItem}
            style={{ background: "#eef4ff", color: "#003366", border: "1px solid #aac4ee", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, marginBottom: 20 }}>
            + Add Product
          </button>

          {saveErrors.length > 0 && (
            <div style={{ background: "#fff3f3", border: "1px solid #fcc", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
              {saveErrors.map((e, i) => <div key={i} style={{ color: "#c00", fontSize: 13 }}>• {e}</div>)}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                background: saved ? "#1a7a4a" : saving ? "#555" : "#1a7a4a",
                color: "#fff", border: "none", borderRadius: 6,
                padding: "10px 28px", cursor: saving || saved ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 14, opacity: saving || saved ? 0.8 : 1,
              }}>
              {saved ? "✓ Saved! Redirecting…" : saving ? "Saving…" : "Save Inquiry"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving || saved}
              style={{
                background: "#f5f5f5", color: "#333", border: "1px solid #ccc", borderRadius: 6,
                padding: "10px 24px", cursor: "pointer",
                fontWeight: 600, fontSize: 14,
              }}>
              Cancel
            </button>
            <button
              onClick={handleClear}
              disabled={saving || saved}
              style={{
                background: "#fff", color: "#666", border: "1px solid #ddd", borderRadius: 6,
                padding: "10px 24px", cursor: "pointer",
                fontWeight: 600, fontSize: 14,
              }}>
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  );
}
