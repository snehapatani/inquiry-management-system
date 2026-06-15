import { useEffect, useState } from "react";
import { getInquiries, getQuotes, getResponses } from "../api";
import { formatDate } from "../utils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const TIME_PERIODS = {
  today: { label: "Today", days: 0 },
  week: { label: "This Week", days: 7 },
  month: { label: "This Month", days: 30 },
  days90: { label: "Last 90 Days", days: 90 },
  custom: { label: "Custom", days: null },
};

export default function Analytics() {
  const [timePeriod, setTimePeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCreatedBy, setFilterCreatedBy] = useState("");

  const [inquiries, setInquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [responses, setResponses] = useState([]);
  const [createdByList, setCreatedByList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalyticsData(); }, [timePeriod, customStartDate, customEndDate, filterStatus, filterCreatedBy]);

  async function fetchAnalyticsData() {
    setLoading(true);
    try {
      const [inquiriesData, quotesData, responsesData] = await Promise.all([
        getInquiries({}),
        getQuotes ? getQuotes(null).catch(() => []) : Promise.resolve([]),
        getResponses ? getResponses(null).catch(() => []) : Promise.resolve([]),
      ]);

      // Filter by date range
      const { startDate, endDate } = getDateRange(timePeriod, customStartDate, customEndDate);
      const filteredInquiries = inquiriesData.filter(inq => {
        const inqDate = new Date(inq.ReceivedDate);
        return inqDate >= startDate && inqDate <= endDate;
      });

      // Apply additional filters
      let finalInquiries = filteredInquiries;
      if (filterStatus) {
        finalInquiries = finalInquiries.filter(inq => inq.Status === filterStatus);
      }
      if (filterCreatedBy) {
        finalInquiries = finalInquiries.filter(inq => inq.CreatedBy === filterCreatedBy);
      }

      setInquiries(finalInquiries);
      setQuotes(quotesData || []);
      setResponses(responsesData || []);

      // Extract unique CreatedBy values
      const uniqueCreatedBy = [...new Set(inquiriesData.map(inq => inq.CreatedBy).filter(Boolean))];
      setCreatedByList(uniqueCreatedBy);
    } catch (error) {
      console.error("Failed to fetch analytics data:", error);
    } finally {
      setLoading(false);
    }
  }

  function getDateRange(period, customStart, customEnd) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    let startDate = new Date(now);

    if (period === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      const day = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "days90") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "custom") {
      startDate = customStart ? new Date(customStart) : new Date(0);
      const endDateObj = customEnd ? new Date(customEnd) : now;
      return { startDate, endDate: endDateObj };
    }

    return { startDate, endDate: now };
  }

  const statusCounts = {
    New: inquiries.filter(i => i.Status === "New").length,
    "In Progress": inquiries.filter(i => i.Status === "In Progress").length,
    Quoted: inquiries.filter(i => i.Status === "Quoted").length,
    Closed: inquiries.filter(i => i.Status === "Closed").length,
  };

  const totalInquiries = inquiries.length;
  const totalQuotes = quotes.length;
  const totalResponses = responses.length;
  const responseRate = totalInquiries > 0 ? Math.round((statusCounts.Quoted + statusCounts.Closed) / totalInquiries * 100) : 0;

  // Count products that have been quoted (from inquiries with Quoted or Closed status)
  const quotedProducts = inquiries
    .filter(inq => inq.Status === "Quoted" || inq.Status === "Closed")
    .reduce((count, inq) => count + (inq.ItemCount || 0), 0);

  // Generate chart data
  function getInquiriesByDateData() {
    const dateMap = {};
    inquiries.forEach(inq => {
      const date = new Date(inq.ReceivedDate).toLocaleDateString("en-IN");
      dateMap[date] = (dateMap[date] || 0) + 1;
    });
    return Object.entries(dateMap).map(([date, count]) => ({ date, count })).sort();
  }

  function getStatusChartData() {
    return [
      { name: "New", value: statusCounts.New, fill: "#e8f4fd" },
      { name: "In Progress", value: statusCounts["In Progress"], fill: "#fff7e6" },
      { name: "Quoted", value: statusCounts.Quoted, fill: "#e6f7ee" },
      { name: "Closed", value: statusCounts.Closed, fill: "#f0f0f0" },
    ];
  }

  function getSourceChartData() {
    const sourceMap = {};
    inquiries.forEach(inq => {
      sourceMap[inq.Source || "Unknown"] = (sourceMap[inq.Source || "Unknown"] || 0) + 1;
    });
    return Object.entries(sourceMap).map(([source, count]) => ({ name: source, value: count }));
  }

  function getCreatedByChartData() {
    const createdByMap = {};
    inquiries.forEach(inq => {
      createdByMap[inq.CreatedBy || "Unknown"] = (createdByMap[inq.CreatedBy || "Unknown"] || 0) + 1;
    });
    return Object.entries(createdByMap).map(([user, count]) => ({ user, count })).slice(0, 10);
  }

  const chartColors = ["#003366", "#1a7a4a", "#1a56db", "#d97706", "#e11d48", "#7c3aed", "#06b6d4"];
  const statusChartData = getStatusChartData();
  const sourceChartData = getSourceChartData();
  const createdByChartData = getCreatedByChartData();
  const inquiriesByDateData = getInquiriesByDateData();

  const KPICard = ({ label, value, trend, color }) => (
    <div style={{
      background: "#fff",
      borderRadius: 10,
      padding: 20,
      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
      border: `3px solid ${color}`,
      flex: "1 1 calc(25% - 12px)",
      minWidth: 200,
    }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color, marginBottom: 6 }}>{value}</div>
      {trend && <div style={{ fontSize: 11, color: "#666" }}>{trend}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: "#003366" }}>Analytics Dashboard</h2>
      </div>

      {/* Filters */}
      <div style={{
        background: "#fff",
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
      }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 600 }}>Time Period</label>
            <select value={timePeriod} onChange={e => setTimePeriod(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}>
              {Object.entries(TIME_PERIODS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {timePeriod === "custom" && (
            <>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 600 }}>Start Date</label>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 600 }}>End Date</label>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }} />
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 600 }}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}>
              <option value="">All Status</option>
              <option>New</option>
              <option>In Progress</option>
              <option>Quoted</option>
              <option>Closed</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 600 }}>Created By</label>
            <select value={filterCreatedBy} onChange={e => setFilterCreatedBy(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}>
              <option value="">All Users</option>
              {createdByList.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading analytics data...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <KPICard label="Total Inquiries" value={totalInquiries} color="#003366" />
            <KPICard label="Total Quotes" value={totalQuotes} color="#1a7a4a" />
            <KPICard label="Products Quoted" value={quotedProducts} color="#1a56db" />
            <KPICard label="Response Rate" value={`${responseRate}%`} color="#d97706" />
          </div>

          {/* Status Breakdown */}
          <div style={{
            background: "#fff",
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Inquiries by Status</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "New", value: statusCounts.New, color: "#e8f4fd" },
                { label: "In Progress", value: statusCounts["In Progress"], color: "#fff7e6" },
                { label: "Quoted", value: statusCounts.Quoted, color: "#e6f7ee" },
                { label: "Closed", value: statusCounts.Closed, color: "#f0f0f0" },
              ].map(status => (
                <div key={status.label} style={{
                  background: status.color,
                  padding: 16,
                  borderRadius: 8,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>{status.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#003366" }}>{status.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Table */}
          <div style={{
            background: "#fff",
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Summary</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Total Inquiries</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#003366" }}>{totalInquiries}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Total Quotes</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#1a7a4a" }}>{totalQuotes}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Products Quoted</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#1a56db" }}>{quotedProducts}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Inquiries in Progress</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#ff9800" }}>{statusCounts["In Progress"]}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Inquiries Quoted</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#1a7a4a" }}>{statusCounts.Quoted}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Inquiries Closed</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#4b5563" }}>{statusCounts.Closed}</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 0", fontWeight: 600, color: "#555" }}>Response Rate</td>
                  <td style={{ padding: "12px 0", textAlign: "right", fontSize: 18, fontWeight: 700, color: "#d97706" }}>{responseRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Charts Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Inquiries by Status - Bar Chart */}
            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Inquiries by Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#003366" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Inquiries by Source - Pie Chart */}
            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Inquiries by Source</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={100}
                    fill="#003366"
                    dataKey="value"
                  >
                    {sourceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Inquiries Over Time - Line Chart */}
            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              gridColumn: "1 / -1",
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Inquiries Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={inquiriesByDateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#003366" strokeWidth={2} name="Inquiries" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Creators - Bar Chart */}
            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#003366", fontSize: 16 }}>Top Creators</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={createdByChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="user" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a7a4a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
