import React, { useState, useEffect, useMemo } from "react";
import { Card, Row, Col, Typography, Button, Tag, Space, Progress, Select, Table, Divider, Statistic, message } from "antd";
import {
  PieChartOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  FireOutlined,
  SmileOutlined,
  DownloadOutlined,
  TeamOutlined,
  TableOutlined,
  ReloadOutlined,
  ShoppingOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getMealAllocations, formatDateKey } from "../../services/firebase/mealService";
import { getEmployees } from "../../services/firebase/employeeService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("TODAY"); // "TODAY" | "WEEK" | "MONTH" | "ALL"
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAlloc, emps] = await Promise.all([
        getMealAllocations(),
        getEmployees()
      ]);
      setAllocations(allAlloc);
      setEmployees(emps);
    } catch (err) {
      console.error("Error loading analytics data:", err);
      message.error("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter allocations based on selected timeframe
  const filteredAllocations = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateKey(today);

    if (timeFilter === "TODAY") {
      return allocations.filter(a => a.date === todayStr);
    }
    if (timeFilter === "WEEK") {
      const weekFromNow = new Date();
      weekFromNow.setDate(today.getDate() + 7);
      const weekStr = formatDateKey(weekFromNow);
      return allocations.filter(a => a.date >= todayStr && a.date <= weekStr);
    }
    if (timeFilter === "MONTH") {
      const monthPrefix = todayStr.substring(0, 7); // YYYY-MM
      return allocations.filter(a => a.date && a.date.startsWith(monthPrefix));
    }
    return allocations;
  }, [allocations, timeFilter]);

  // Aggregated KPIs
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(a => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received").length;
  const pendingCount = totalCount - receivedCount;
  const completionRate = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0;

  const breakfastCount = filteredAllocations.filter(a => a.meal_type === "Breakfast").length;
  const lunchCount = filteredAllocations.filter(a => a.meal_type === "Lunch").length;
  const dinnerCount = filteredAllocations.filter(a => a.meal_type === "Dinner").length;

  const freeCount = filteredAllocations.filter(a => (a.pay_category || "").toLowerCase().includes("free")).length;
  const halfPaidCount = filteredAllocations.filter(a => (a.pay_category || "").toLowerCase().includes("half")).length;
  const notPaidCount = filteredAllocations.filter(a => (a.pay_category || "").toLowerCase().includes("not")).length;

  // Department Leaderboard
  const departmentBreakdown = useMemo(() => {
    const map = {};
    filteredAllocations.forEach(a => {
      const sec = a.section || "General Operations";
      if (!map[sec]) {
        map[sec] = { name: sec, count: 0, received: 0 };
      }
      map[sec].count += 1;
      if ((a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received") {
        map[sec].received += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredAllocations]);

  // Handle Export Excel Report
  const handleExport = async () => {
    setExporting(true);
    try {
      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: "MEAL MANAGEMENT PROJECT - ANALYTICS & CONSUMPTION REPORT",
        dateRangeStr: timeFilter,
        generatedBy: "Canteen Management"
      });
      message.success("Formatted Excel report generated and downloaded!");
    } catch (err) {
      message.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", width: "100%" }}>
      {/* Top Header & Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Canteen Operations Visualisation
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Live catering analytics, portion demand breakdown, and department consumption
          </Text>
        </div>

        <Space size="middle" wrap>
          <Select
            value={timeFilter}
            onChange={setTimeFilter}
            style={{ width: 160, fontWeight: 600 }}
            size="large"
          >
            <Option value="TODAY">📅 Today's Meals</Option>
            <Option value="WEEK">🗓 Next 7 Days</Option>
            <Option value="MONTH">📆 Current Month</Option>
            <Option value="ALL">🌐 All Time Records</Option>
          </Select>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            loading={exporting}
            onClick={handleExport}
            style={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              boxShadow: "0 4px 14px -2px rgba(16, 185, 129, 0.4)"
            }}
          >
            Download Formatted Excel
          </Button>

          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="large" />
        </Space>
      </div>

      {/* Top Stat Cards Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #3b82f6" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Total Meals Scheduled</span>}
              value={totalCount}
              prefix={<ShoppingOutlined style={{ color: "#3b82f6", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#1e3a8a" }}
            />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Active in selected filter
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #10b981" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Dispensed (Received)</span>}
              value={receivedCount}
              prefix={<CheckCircleOutlined style={{ color: "#10b981", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#065f46" }}
              suffix={<span style={{ fontSize: 13, color: "#10b981" }}>({completionRate}%)</span>}
            />
            <Progress percent={completionRate} size="small" strokeColor="#10b981" showInfo={false} />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #f59e0b" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Pending Dispensing</span>}
              value={pendingCount}
              prefix={<ClockCircleOutlined style={{ color: "#f59e0b", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#92400e" }}
            />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Awaiting employee touch collection
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Registered Workforce</span>}
              value={employees.length}
              prefix={<TeamOutlined style={{ color: "#8b5cf6", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#4c1d95" }}
            />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Biometric registered profiles
            </div>
          </Card>
        </Col>
      </Row>

      {/* Visual Analytics Sections */}
      <Row gutter={[24, 24]}>
        {/* Left Column: Meal Slot Distribution & Subsidy Distribution */}
        <Col xs={24} lg={12}>
          {/* Meal Slot Distribution */}
          <Card
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>Meal Portion Breakdown</span>
                <Tag color="cyan">Total: {totalCount}</Tag>
              </div>
            }
            className="glass-card"
            style={{ marginBottom: 24, borderRadius: 16 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Breakfast */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "#92400e" }}>☕ Breakfast (06:00 - 09:00 AM)</span>
                  <span style={{ fontWeight: 800 }}>{breakfastCount} portions ({totalCount > 0 ? Math.round((breakfastCount / totalCount) * 100) : 0}%)</span>
                </div>
                <Progress
                  percent={totalCount > 0 ? Math.round((breakfastCount / totalCount) * 100) : 0}
                  strokeColor="#d97706"
                  trailColor="#fef3c7"
                />
              </div>

              {/* Lunch */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "#065f46" }}>🍲 Lunch (11:00 AM - 01:00 PM)</span>
                  <span style={{ fontWeight: 800 }}>{lunchCount} portions ({totalCount > 0 ? Math.round((lunchCount / totalCount) * 100) : 0}%)</span>
                </div>
                <Progress
                  percent={totalCount > 0 ? Math.round((lunchCount / totalCount) * 100) : 0}
                  strokeColor="#059669"
                  trailColor="#d1fae5"
                />
              </div>

              {/* Dinner */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "#991b1b" }}>🍽 Dinner (04:00 - 09:00 PM)</span>
                  <span style={{ fontWeight: 800 }}>{dinnerCount} portions ({totalCount > 0 ? Math.round((dinnerCount / totalCount) * 100) : 0}%)</span>
                </div>
                <Progress
                  percent={totalCount > 0 ? Math.round((dinnerCount / totalCount) * 100) : 0}
                  strokeColor="#dc2626"
                  trailColor="#fee2e2"
                />
              </div>
            </div>
          </Card>

          {/* Subsidy Allocation Breakdown */}
          <Card
            title={<span style={{ fontWeight: 800, fontSize: 16 }}>Subsidy & Payment Category Share</span>}
            className="glass-card"
            style={{ borderRadius: 16 }}
          >
            <Row gutter={[16, 16]} style={{ textAlign: "center" }}>
              <Col span={8}>
                <div style={{ padding: 16, background: "#ecfdf5", borderRadius: 12, border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#065f46" }}>{freeCount}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#047857" }}>Free Meals</div>
                  <div style={{ fontSize: 11, color: "#065f46" }}>
                    {totalCount > 0 ? Math.round((freeCount / totalCount) * 100) : 0}% of demand
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 16, background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#92400e" }}>{halfPaidCount}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#b45309" }}>Half Paid</div>
                  <div style={{ fontSize: 11, color: "#92400e" }}>
                    {totalCount > 0 ? Math.round((halfPaidCount / totalCount) * 100) : 0}% of demand
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 16, background: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#991b1b" }}>{notPaidCount}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#b91c1c" }}>Not Paid</div>
                  <div style={{ fontSize: 11, color: "#991b1b" }}>
                    {totalCount > 0 ? Math.round((notPaidCount / totalCount) * 100) : 0}% of demand
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Column: Department Leaderboard & Catering Overview */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>Department Consumption Leaderboard</span>
                <Button type="link" onClick={() => navigate("/admin/all-allocations")}>
                  View All Allocations
                </Button>
              </div>
            }
            className="glass-card"
            style={{ borderRadius: 16, height: "100%" }}
          >
            {departmentBreakdown.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                No meal records in the selected timeframe.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {departmentBreakdown.map((dept, idx) => {
                  const share = totalCount > 0 ? Math.round((dept.count / totalCount) * 100) : 0;
                  const recvRate = dept.count > 0 ? Math.round((dept.received / dept.count) * 100) : 0;

                  return (
                    <div
                      key={dept.name}
                      style={{
                        padding: "12px 16px",
                        background: idx === 0 ? "#f0fdf4" : "#f8fafc",
                        borderRadius: 12,
                        border: idx === 0 ? "1.5px solid #86efac" : "1px solid #e2e8f0"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Tag color={idx === 0 ? "green" : "blue"} style={{ fontWeight: 800 }}>
                            #{idx + 1}
                          </Tag>
                          <Text strong style={{ fontSize: 14 }}>{dept.name}</Text>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{dept.count} Meals</span>
                          <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>({share}%)</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        <span>Dispensed: <b>{dept.received}</b> / {dept.count}</span>
                        <span>Dispense Rate: <b>{recvRate}%</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
