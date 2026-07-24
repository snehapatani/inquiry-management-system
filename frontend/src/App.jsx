import { useState, useEffect, useCallback } from "react";
import InquiryList from "./pages/InquiryList";
import NewInquiry from "./pages/NewInquiry";
import InquiryDetail from "./pages/InquiryDetail";
import VendorMaster from "./pages/VendorMaster";
import ResponseLog from "./pages/ResponseLog";
import WorkQueue from "./pages/WorkQueue";
import Analytics from "./pages/Analytics";
import LoginPage from "./pages/LoginPage";
import UserManagement from "./pages/UserManagement";
import { getToken, setToken, clearToken, getMe } from "./api";

const TABS = ["Inquiries", "New Inquiry", "Vendors", "Work Queue", "Response Log", "Analytics"];

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export default function App() {
  const [tab, setTab] = useState("Inquiries");
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [user, setUser] = useState(null);        // null = not loaded yet
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Restore session on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      const payload = parseJwt(token);
      if (payload && payload.exp * 1000 > Date.now()) {
        getMe()
          .then(setUser)
          .catch(() => { clearToken(); setUser(null); })
          .finally(() => setAuthReady(true));
      } else {
        clearToken();
        setAuthReady(true);
      }
    } else {
      setAuthReady(true);
    }
  }, []);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Listen for 401 events from api.js
  useEffect(() => {
    const handler = () => { setUser(null); setTab("Inquiries"); };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const handleLogin = useCallback(async (token) => {
    setToken(token);
    const me = await getMe();
    setUser(me);
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
    setTab("Inquiries");
  }

  function openInquiry(id) {
    setSelectedInquiryId(id);
    setTab("Detail");
  }

  function back() {
    setSelectedInquiryId(null);
    setTab("Inquiries");
  }

  if (!authReady) return null;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  const tabs = [...TABS, ...(user.Role === "admin" ? ["Users"] : [])];

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", minHeight: "100vh", background: "#f0f2f5" }}>
      {/* Header */}
      <div style={{ background: "#003366", color: "#fff", padding: isMobile ? "12px 12px" : "12px 24px", display: "flex", alignItems: "center", gap: isMobile ? 8 : 20, flexWrap: "wrap" }}>
        <button onClick={() => { setTab("Inquiries"); setSelectedInquiryId(null); setMenuOpen(false); }}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: isMobile ? 16 : 18, marginRight: 8, padding: 0 }}>
          💊 Inquiry MS
        </button>

        {/* Desktop Navigation */}
        {!isMobile && (
          <>
            {tabs.map(t => (
              <button key={t} onClick={() => { setTab(t); setSelectedInquiryId(null); setMenuOpen(false); }}
                style={{
                  background: tab === t ? "#fff" : "transparent",
                  color: tab === t ? "#003366" : "#cce0ff",
                  border: "none", borderRadius: 6, padding: "6px 14px",
                  cursor: "pointer", fontWeight: tab === t ? 600 : 400, fontSize: 14,
                }}>{t}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#cce0ff" }}>
                {user.FullName || user.Username}
                {user.Role === "admin" && <span style={{ marginLeft: 6, fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 6px" }}>admin</span>}
              </span>
              <button onClick={handleLogout}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 13 }}>
                Sign out
              </button>
            </div>
          </>
        )}

        {/* Mobile Navigation */}
        {isMobile && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: "transparent", color: "#fff", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>
              ☰
            </button>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {isMobile && menuOpen && (
        <div style={{ background: "#002a52", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedInquiryId(null); setMenuOpen(false); }}
              style={{
                background: tab === t ? "rgba(255,255,255,0.2)" : "transparent",
                color: "#cce0ff",
                border: "none", borderRadius: 6, padding: "10px 12px",
                cursor: "pointer", fontWeight: tab === t ? 600 : 400, fontSize: 13, textAlign: "left",
              }}>{t}</button>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#cce0ff", display: "block", marginBottom: 8 }}>
              {user.FullName || user.Username}
              {user.Role === "admin" && <span style={{ marginLeft: 6, fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 6px" }}>admin</span>}
            </span>
            <button onClick={handleLogout}
              style={{ width: "100%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12 }}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: isMobile ? "16px auto" : "24px auto", padding: isMobile ? "0 8px" : "0 16px" }}>
        {tab === "Inquiries"   && <InquiryList onOpen={openInquiry} onGoToWorkQueue={() => setTab("Work Queue")} />}
        {tab === "New Inquiry" && <NewInquiry onSaved={() => setTab("Inquiries")} />}
        {tab === "Detail"      && selectedInquiryId && <InquiryDetail id={selectedInquiryId} onBack={back} user={user} />}
        {tab === "Vendors"     && <VendorMaster />}
        {tab === "Work Queue"  && <WorkQueue onOpenInquiry={openInquiry} user={user} />}
        {tab === "Response Log" && <ResponseLog onOpenInquiry={openInquiry} />}
        {tab === "Analytics"   && <Analytics />}
        {tab === "Users"       && user.Role === "admin" && <UserManagement />}
      </div>
    </div>
  );
}
