import { useEffect, useState } from "react";
import { getAllResponses } from "../api";
import { formatDateTime } from "../utils";

export default function ResponseLog({ onOpenInquiry }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [mobile, setMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    getAllResponses()
      .then(setResponses)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: mobile ? "flex-start" : "center", marginBottom: 16, flexDirection: mobile ? "column" : "row", gap: mobile ? 8 : 0 }}>
        <h2 style={{ margin: 0, color: "#003366", fontSize: mobile ? 20 : 24 }}>Response Log</h2>
        <span style={{ fontSize: mobile ? 12 : 13, color: "#888" }}>{responses.length} response{responses.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <p>Loading…</p> : (
        !mobile ? (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#003366", color: "#fff" }}>
                {["#", "Inquiry", "Customer", "Sent Date", "Channel", "Sent By", "Message", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responses.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#888" }}>No responses logged yet.</td></tr>
              )}
              {responses.map((r, i) => {
                const isOpen = expanded[r.ResponseID] ?? false;
                return (
                  <tr key={r.ResponseID} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9f9", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>#{r.ResponseID}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => onOpenInquiry(r.InquiryID)}
                        style={{ background: "none", border: "none", color: "#003366", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" }}>
                        #{r.InquiryID}
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.CustomerName || "—"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{r.CustomerCompany || ""}</div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap" }}>
                      {formatDateTime(r.SentDate)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{r.Channel || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{r.SentBy || "—"}</td>
                    <td style={{ padding: "10px 14px", maxWidth: 320 }}>
                      <div style={{ fontSize: 12, color: "#444", whiteSpace: "pre-wrap", overflow: "hidden", maxHeight: isOpen ? "none" : 48 }}>
                        {r.MessageBody || "—"}
                      </div>
                      {r.MessageBody && r.MessageBody.length > 120 && (
                        <button onClick={() => setExpanded(e => ({ ...e, [r.ResponseID]: !isOpen }))}
                          style={{ background: "none", border: "none", color: "#003366", cursor: "pointer", fontSize: 11, padding: "2px 0" }}>
                          {isOpen ? "Show less" : "Show more"}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#e6f7ee", color: "#1a7a4a", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                        {r.Status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {responses.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#888", background: "#fff", borderRadius: 8 }}>No responses logged yet.</div>
            ) : (
              responses.map((r) => {
                const isOpen = expanded[r.ResponseID] ?? false;
                return (
                  <div key={r.ResponseID} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#003366", marginBottom: 4 }}>
                          Response #{r.ResponseID}
                        </div>
                        <button onClick={() => onOpenInquiry(r.InquiryID)}
                          style={{ background: "none", border: "none", color: "#003366", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0, textDecoration: "underline" }}>
                          Inquiry #{r.InquiryID}
                        </button>
                      </div>
                      <span style={{ background: "#e6f7ee", color: "#1a7a4a", borderRadius: 12, padding: "3px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {r.Status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
                      <div><b>Customer:</b> {r.CustomerName || "—"}</div>
                      {r.CustomerCompany && <div><b>Company:</b> {r.CustomerCompany}</div>}
                      <div><b>Sent:</b> {formatDateTime(r.SentDate)}</div>
                      <div><b>Channel:</b> {r.Channel || "—"}</div>
                      <div><b>Sent By:</b> {r.SentBy || "—"}</div>
                    </div>
                    <div style={{ background: "#f5f5f5", borderRadius: 5, padding: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#444", whiteSpace: "pre-wrap", overflow: "hidden", maxHeight: isOpen ? "none" : 80 }}>
                        {r.MessageBody || "—"}
                      </div>
                      {r.MessageBody && r.MessageBody.length > 120 && (
                        <button onClick={() => setExpanded(e => ({ ...e, [r.ResponseID]: !isOpen }))}
                          style={{ background: "none", border: "none", color: "#003366", cursor: "pointer", fontSize: 11, padding: "4px 0", fontWeight: 500 }}>
                          {isOpen ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
}
