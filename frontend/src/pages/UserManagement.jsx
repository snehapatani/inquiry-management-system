import { useEffect, useState } from "react";
import { getUsers, createUser, deleteUser } from "../api";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ Username: "", FullName: "", Password: "", Role: "user" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mobile, setMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function load() {
    setLoading(true);
    getUsers().then(setUsers).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.Username.trim() || !form.Password) return;
    setSaving(true);
    setError("");
    try {
      await createUser(form);
      setShowModal(false);
      setForm({ Username: "", FullName: "", Password: "", Role: "user" });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Deactivate user "${name}"?`)) return;
    await deleteUser(id);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexDirection: mobile ? "column" : "row", gap: mobile ? 12 : 0 }}>
        <h2 style={{ margin: 0, color: "#003366", fontSize: mobile ? 20 : 24 }}>User Management</h2>
        <button onClick={() => setShowModal(true)}
          style={{ background: "#003366", color: "#fff", border: "none", borderRadius: 6, padding: mobile ? "10px 14px" : "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, width: mobile ? "100%" : "auto" }}>
          + Add User
        </button>
      </div>

      {loading ? <p>Loading…</p> : (
        !mobile ? (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#003366", color: "#fff" }}>
                {["Username", "Full Name", "Role", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.UserID} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9f9", borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>{u.Username}</td>
                  <td style={{ padding: "10px 16px" }}>{u.FullName || "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ background: u.Role === "admin" ? "#003366" : "#e8f0fe", color: u.Role === "admin" ? "#fff" : "#1a56db", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                      {u.Role}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ color: "#1a7a4a", fontSize: 12 }}>● Active</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <button onClick={() => handleDelete(u.UserID, u.Username)}
                      style={{ background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((u) => (
              <div key={u.UserID} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#003366", marginBottom: 4 }}>{u.Username}</div>
                    {u.FullName && <div style={{ fontSize: 12, color: "#555" }}>{u.FullName}</div>}
                  </div>
                  <span style={{ background: u.Role === "admin" ? "#003366" : "#e8f0fe", color: u.Role === "admin" ? "#fff" : "#1a56db", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {u.Role}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ color: "#1a7a4a", fontSize: 11 }}>● Active</span>
                </div>
                <button onClick={() => handleDelete(u.UserID, u.Username)}
                  style={{ width: "100%", background: "#fee", color: "#c00", border: "1px solid #fcc", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>
                  Deactivate
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: mobile ? "16px 16px 0 0" : 12, padding: mobile ? 16 : 28, width: mobile ? "100%" : 380, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#003366", fontSize: mobile ? 16 : 18 }}>Add User</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            {[["Username","Username","text",true],["FullName","Full Name","text",false],["Password","Password","password",true]].map(([f,label,type,req]) => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>
                  {label}{req && <span style={{ color: "#c00" }}> *</span>}
                </label>
                <input type={type} value={form[f]} onChange={e => setForm(v => ({ ...v, [f]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Role</label>
              <select value={form.Role} onChange={e => setForm(v => ({ ...v, Role: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, background: "#fff" }}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div style={{ color: "#c00", fontSize: 12, marginBottom: 12, background: "#fff3f3", border: "1px solid #fcc", borderRadius: 5, padding: "6px 10px" }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, flexDirection: mobile ? "column" : "row" }}>
              <button onClick={handleCreate} disabled={saving || !form.Username.trim() || !form.Password}
                style={{ flex: 1, background: saving || !form.Username.trim() || !form.Password ? "#ccc" : "#003366", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: saving || !form.Username.trim() || !form.Password ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
                {saving ? "Creating…" : "Create User"}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, background: "#eee", color: "#333", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
