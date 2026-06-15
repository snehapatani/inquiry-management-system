import { useState } from "react";
import { login } from "../api";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const { access_token } = await login(username.trim(), password);
      onLogin(access_token);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, width: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💊</div>
          <h2 style={{ margin: 0, color: "#003366", fontSize: 22 }}>Inquiry MS</h2>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 13 }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5 }}>Username <span style={{ color: "#c00" }}>*</span></label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5 }}>Password <span style={{ color: "#c00" }}>*</span></label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ background: "#fff3f3", border: "1px solid #fcc", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#c00" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              width: "100%", padding: "11px", borderRadius: 7, border: "none",
              background: loading || !username.trim() || !password ? "#ccc" : "#003366",
              color: "#fff", fontWeight: 700, fontSize: 15,
              cursor: loading || !username.trim() || !password ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
