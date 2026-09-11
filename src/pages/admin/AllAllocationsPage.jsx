import React, { useState, useEffect } from "react";
import { Card, Table, Typography, Button, Input, Tag, Space, DatePicker, Select, Popconfirm, message, Row, Col } from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  TableOutlined
} from "@ant-design/icons";
import { getMealAllocations, updateMealAllocationStatus, deleteMealAllocation, formatDateKey } from "../../services/firebase/mealService";
import { formatSriLankaDateTime } from "../../utils/timeUtils";
import * as XLSX from "xlsx";

const { Title, Text } = Typography;
const { Option } = Select;

export default function AllAllocationsPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const loadAllocations = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateFilter) filters.date = dateFilter;
      if (statusFilter !== "ALL") filters.status = statusFilter;
      if (mealTypeFilter !== "ALL") filters.meal_type = mealTypeFilter;

      const data = await getMealAllocations(filters);
      setAllocations(data);
    } catch (err) {
      console.error("Error loading allocations:", err);
      message.error("Failed loading all allocations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [dateFilter, statusFilter, mealTypeFilter]);

  const handleToggleStatus = async (record) => {
    const newStatus = record.status === "Ordered" ? "Recieved" : "Ordered";
    try {
      const res = await updateMealAllocationStatus(record.id, newStatus);
      if (res.success) {
        message.success(`Status changed to ${newStatus}`);
        loadAllocations();
      }
    } catch (err) {
      message.error(`Status update error: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteMealAllocation(id);
      if (res.success) {
        message.success("Allocation deleted successfully.");
        loadAllocations();
      }
    } catch (err) {
      message.error(`Delete error: ${err.message}`);
    }
  };

  const exportToExcel = () => {
    if (allocations.length === 0) {
      message.warning("No allocations to export.");
      return;
    }

    const exportRows = filteredAllocations.map(a => ({
      "Allocation ID": a.id,
      "Date": a.date,
      "Employee ID": a.employee_id,
      "Employee Name": a.employee_name,
      "Company": a.company || "Meal Management Project",
      "Section": a.section,
      "Meal Slot": a.meal_type,
      "Payment Category": a.pay_category,
      "Status": a.status,
      "Created By": a.created_by,
      "Created At (Sri Lanka Time)": formatSriLankaDateTime(a.created_at),
      "Received At (Sri Lanka Time)": formatSriLankaDateTime(a.received_at)
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meal Allocations");
    XLSX.writeFile(wb, `Meal_Allocations_${formatDateKey(new Date())}.xlsx`);
    message.success("Excel report exported successfully with Sri Lanka time!");
  };

  const filteredAllocations = allocations.filter((item) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      (item.employee_name || "").toLowerCase().includes(s) ||
      (item.employee_id || "").toLowerCase().includes(s) ||
      (item.section || "").toLowerCase().includes(s) ||
      (item.company || "").toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d) => <Text strong>{d}</Text>,
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: "Employee",
      key: "employee",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.employee_name}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <Tag color="blue" style={{ margin: 0 }}>{r.employee_id}</Tag> • {r.section}
          </div>
        </div>
      )
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 120,
      render: (m) => {
        const icon = m === "Breakfast" ? "☕" : m === "Lunch" ? "🍲" : "🍽";
        return <span>{icon} {m}</span>;
      }
    },
    {
      title: "Category",
      dataIndex: "pay_category",
      key: "pay_category",
      render: (c) => <Tag color="cyan">{c || "Free Meal"}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (s, record) => (
        <Tag
          icon={s === "Recieved" ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={s === "Recieved" ? "success" : "processing"}
          style={{ cursor: "pointer", fontWeight: 700 }}
          onClick={() => handleToggleStatus(record)}
          title="Click to toggle status"
        >
          {s}
        </Tag>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_, r) => (
        <Popconfirm
          title="Delete Allocation"
          description="Are you sure you want to permanently delete this allocation?"
          onConfirm={() => handleDelete(r.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button danger type="text" icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            All Meal Allocations Master
          </Title>
          <Text type="secondary">
            Canteen Supervisor & Management Overview ({filteredAllocations.length} records)
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button icon={<DownloadOutlined />} onClick={exportToExcel} style={{ fontWeight: 600 }}>
            Export Excel
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAllocations} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Filter Toolbar */}
      <Card className="glass-card" style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 14 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search by Employee or ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14
              }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Select
              value={mealTypeFilter}
              onChange={setMealTypeFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Meal Types</Option>
              <Option value="Breakfast">Breakfast</Option>
              <Option value="Lunch">Lunch</Option>
              <Option value="Dinner">Dinner</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="Ordered">Ordered</Option>
              <Option value="Recieved">Recieved</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Button
              onClick={() => {
                setSearchText("");
                setDateFilter("");
                setStatusFilter("ALL");
                setMealTypeFilter("ALL");
              }}
              block
            >
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Master Allocations Table */}
      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Table
          dataSource={filteredAllocations}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
}
