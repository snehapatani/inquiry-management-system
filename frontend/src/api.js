const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// ── Security check ────────────────────────────────────────────
if (import.meta.env.PROD && BASE.startsWith("http://")) {
  console.warn(
    "🔒 SECURITY WARNING: Using insecure HTTP connection in production. " +
    "Always use HTTPS to encrypt passwords and sensitive data in transit. " +
    "Update VITE_API_BASE to use https:// in production."
  );
}

// ── token helpers ──────────────────────────────────────────────
export function getToken() { return localStorage.getItem("authToken"); }
export function setToken(t) { localStorage.setItem("authToken", t); }
export function clearToken() { localStorage.removeItem("authToken"); localStorage.removeItem("authUser"); }

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    ...options,
  });
  if (res.status === 401) {
    // Token expired or invalid — force re-login
    clearToken();
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────
export async function login(username, password) {
  // Hash password on client side to avoid sending plain text
  const hashedPassword = btoa(username + ":" + password);

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Hash": "1" // Indicate this is a hashed auth attempt
    },
    body: JSON.stringify({ username, password: hashedPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}
export const getMe        = () => req("/auth/me");
export const getUsers     = () => req("/auth/users");
export const createUser   = (data) => req("/auth/users", { method: "POST", body: JSON.stringify(data) });
export const deleteUser   = (id) => req(`/auth/users/${id}`, { method: "DELETE" });

// Parser
export const parseInquiry  = (raw_text) => req("/parse", { method: "POST", body: JSON.stringify({ raw_text }) });
export const getParseMode  = () => req("/parse/mode");

// Customers
export const getCustomers  = () => req("/customers");
export const createCustomer = (data) => req("/customers", { method: "POST", body: JSON.stringify(data) });
export const autocompleteCustomers = (q) => req(`/customers/autocomplete?q=${encodeURIComponent(q)}`);

// Products
export const autocompleteProducts = (q) => req(`/products/autocomplete?q=${encodeURIComponent(q)}`);

// Inquiries
export const getInquiries  = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req(`/inquiries${qs ? "?" + qs : ""}`);
};
export const getInquiry    = (id) => req(`/inquiries/${id}`);
export const createInquiry = (data) => req("/inquiries", { method: "POST", body: JSON.stringify(data) });
export const updateInquiryStatus = (id, status) =>
  req(`/inquiries/${id}/status?status=${encodeURIComponent(status)}`, { method: "PATCH" });
export const deleteInquiry = (id) =>
  req(`/delete-inquiry`, { method: "POST", body: JSON.stringify({ inquiry_id: id }) });

// Items
export const matchVendors  = (itemId) => req(`/items/${itemId}/match-vendors`);
export const setBestQuote    = (itemId, quoteId) =>
  req(`/items/${itemId}/best-quote?quote_id=${quoteId}`, { method: "PATCH" });
export const toggleSelectItem  = (itemId) =>
  req(`/items/${itemId}/toggle-select`, { method: "PATCH" });
export const bulkSelectItems   = (itemIds) =>
  req("/items/bulk-select", { method: "POST", body: JSON.stringify(itemIds) });
export const getWorkItems      = () => req("/work-items");

// Vendors
export const getVendors    = () => req("/vendors");
export const createVendor  = (data) => req("/vendors", { method: "POST", body: JSON.stringify(data) });
export const updateVendor  = (id, data) => req(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteVendor  = (id) => req(`/vendors/${id}`, { method: "DELETE" });

// VendorProducts
export const getVendorProducts    = (vendorId) => req(`/vendors/${vendorId}/products`);
export const createVendorProduct  = (data) => req("/vendor-products", { method: "POST", body: JSON.stringify(data) });
export const deleteVendorProduct  = (id) => req(`/vendor-products/${id}`, { method: "DELETE" });

// Quotes
export const getAllQuotes = () => req("/quotes");
export const getQuotes    = (itemId) => req(`/items/${itemId}/quotes`);
export const createQuote  = (data) => req("/quotes", { method: "POST", body: JSON.stringify(data) });
export const updateQuote  = (id, data) => req(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) });

// Responses
export const sendResponse     = (data) => req("/responses", { method: "POST", body: JSON.stringify(data) });
export const getResponses     = (inquiryId) => req(`/inquiries/${inquiryId}/responses`);
export const getAllResponses   = () => req("/responses");
