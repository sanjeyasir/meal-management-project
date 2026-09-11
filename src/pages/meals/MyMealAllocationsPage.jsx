import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Button, Tag, Space, Table, DatePicker, Popconfirm, Spin, message } from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getMealAllocations, deleteMealAllocation, formatDateKey } from "../../services/firebase/mealService";

const { Title, Text } = Typography;

export default function MyMealAllocationsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(null);

  const loadAllocations = async () => {
    if (!currentUser?.employee_id) return;
    setLoading(true);
    try {
      const filters = { employee_id: currentUser.employee_id };
      if (filterDate) {
        filters.date = formatDateKey(filterDate);
      }
      const data = await getMealAllocations(filters);
      setAllocations(data);
    } catch (err) {
      console.error("Error loading allocations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [currentUser, filterDate]);

  const handleDelete = async (id) => {
    try {
      const res = await deleteMealAllocation(id);
      if (res.success) {
        message.success("Allocation deleted successfully.");
        loadAllocations();
      } else {
        message.error(`Delete failed: ${res.message}`);
      }
    } catch (err) {
      message.error(`Delete error: ${err.message}`);
    }
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (d) => <Text strong style={{ fontSize: 14 }}>{d}</Text>,
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      render: (m) => {
        const color = m === "Breakfast" ? "orange" : m === "Lunch" ? "green" : "red";
        const icon = m === "Breakfast" ? "☕" : m === "Lunch" ? "🍲" : "🍽";
        return (
          <Space>
            <span>{icon}</span>
            <Text strong>{m}</Text>
          </Space>
        );
      },
      filters: [
        { text: "Breakfast", value: "Breakfast" },
        { text: "Lunch", value: "Lunch" },
        { text: "Dinner", value: "Dinner" }
      ],
      onFilter: (value, record) => record.meal_type === value
    },
    {
      title: "Payment Category",
      dataIndex: "pay_category",
      key: "pay_category",
      render: (c) => <Tag color="cyan">{c || "Free Meal"}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s) => (
        <Tag
          icon={s === "Recieved" ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={s === "Recieved" ? "success" : "processing"}
          style={{ fontWeight: 700, borderRadius: 6 }}
        >
          {s}
        </Tag>
      ),
      filters: [
        { text: "Ordered", value: "Ordered" },
        { text: "Recieved", value: "Recieved" }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        record.status === "Ordered" ? (
          <Popconfirm
            title="Cancel Meal Allocation"
            description="Are you sure you want to delete this scheduled meal?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
          >
            <Button danger type="text" icon={<DeleteOutlined />} size="small">
              Cancel
            </Button>
          </Popconfirm>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Completed</Text>
        )
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <Space size="middle">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/kiosk")}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Back to Kiosk
          </Button>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            My Meal Allocations
          </Title>
        </Space>

        <Space size="middle">
          <input
            type="date"
            onChange={(e) => setFilterDate(e.target.value ? new Date(e.target.value) : null)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14
            }}
          />
          {filterDate && (
            <Button size="small" onClick={() => setFilterDate(null)}>
              Clear Date
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadAllocations} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Table
          dataSource={allocations}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
}
