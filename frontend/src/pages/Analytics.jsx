import { useEffect, useState } from "react";
import { getInquiries, getQuotes, getResponses, getInquiry, getAllQuotes, getAllResponses } from "../api";
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
  const [responses, setResponses] = useState([]);
  const [createdByList, setCreatedByList] = useState([]);
  const [quotedProductCount, setQuotedProductCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalyticsData(); }, [timePeriod, customStartDate, customEndDate, filterStatus, filterCreatedBy]);

  async function fetchAnalyticsData() {
    setLoading(true);
    try {
      const [inquiriesData, quotesData, responsesData] = await Promise.all([
        getInquiries({}),
        getAllQuotes().catch(() => []),
        getAllResponses().catch(() => []),
      ]);

      // Filter by date range (compare just the date part, ignoring timezone)
      const { startDate, endDate } = getDateRange(timePeriod, customStartDate, customEndDate);
      const filteredInquiries = inquiriesData.filter(inq => {
        // Use InquiryDate if available, fall back to ReceivedDate
        const dateStr = inq.InquiryDate || inq.ReceivedDate;
        const inqDate = new Date(dateStr);
        // Extract just the date part (YYYY-MM-DD) and compare
        const inqDateStr = inqDate.toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        return inqDateStr >= startDateStr && inqDateStr <= endDateStr;
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

      // Filter responses for the final inquiries
      const finalInquiryIds = new Set(finalInquiries.map(i => i.InquiryID));
      const filteredResponses = (responsesData || []).filter(r => finalInquiryIds.has(r.InquiryID));
      setResponses(filteredResponses);

      // Fetch full inquiries to get items count and item IDs
      let totalProductsCount = 0;
      const allItemIds = new Set();
      try {
        const fullInquiriesPromises = finalInquiries.map(inq => getInquiry(inq.InquiryID).catch(() => ({ Items: [] })));
        const fullInquiries = await Promise.all(fullInquiriesPromises);
        fullInquiries.forEach(inq => {
          totalProductsCount += inq.Items?.length || 0;
          (inq.Items || []).forEach(item => allItemIds.add(item.ItemID));
        });
      } catch (error) {
        console.error("Error fetching full inquiries for product count:", error);
      }
      setTotalProducts(totalProductsCount);

      // Count quoted products (items with best quotes from ALL filtered inquiries)
      const quotedCount = new Set(quotesData.filter(q => allItemIds.has(q.ItemID) && q.IsBestPrice).map(q => q.ItemID)).size;
      setQuotedProductCount(quotedCount);

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
  const responseSent = responses.length;

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
      flex: "1 1 auto",
      minWidth: 0,
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
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "nowrap" }}>
            <KPICard label="Total Inquiries" value={totalInquiries} color="#003366" />
            <KPICard label="Total Products" value={totalProducts} color="#1a7a4a" />
            <KPICard label="Products Quoted" value={quotedProductCount} color="#1a56db" />
            <KPICard label="Response Sent" value={responseSent} color="#d97706" />
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
