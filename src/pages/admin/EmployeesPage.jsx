import React, { useState, useEffect } from "react";
import { Card, Table, Typography, Button, Input, Tag, Space, Modal, Form, Select, Popconfirm, message, Row, Col } from "antd";
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { getEmployees, saveEmployee, deleteEmployee } from "../../services/firebase/employeeService";
import { getCategories } from "../../services/firebase/categoryService";
import { getDepartments } from "../../services/firebase/departmentService";

const { Title, Text } = Typography;
const { Option } = Select;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [emps, cats, depts] = await Promise.all([
        getEmployees(),
        getCategories(),
        getDepartments()
      ]);
      setEmployees(emps);
      setCategories(cats);
      setDepartments(depts);
    } catch (err) {
      console.error("Error loading employees data:", err);
      message.error("Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    form.resetFields();
    form.setFieldsValue({
      company: "Hayleys Eco Solutions",
      section: "Quality Management",
      category_employment: "Staff",
      status: "Active"
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingEmployee(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await saveEmployee({
        ...editingEmployee,
        ...values,
        employee_id: editingEmployee ? editingEmployee.employee_id : values.employee_id
      });
      message.success(editingEmployee ? "Employee updated successfully" : "New employee registered");
      setModalOpen(false);
      loadData();
    } catch (err) {
      message.error(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (employeeId) => {
    try {
      await deleteEmployee(employeeId);
      message.success("Employee removed successfully");
      loadData();
    } catch (err) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      (e.name || "").toLowerCase().includes(s) ||
      (e.employee_id || "").toLowerCase().includes(s) ||
      (e.designation || "").toLowerCase().includes(s) ||
      (e.section || "").toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 130,
      render: (id) => <Tag color="blue" style={{ fontWeight: 700 }}>{id}</Tag>,
      sorter: (a, b) => a.employee_id.localeCompare(b.employee_id)
    },
    {
      title: "Name & Role",
      key: "name_role",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{r.designation}</div>
        </div>
      )
    },
    {
      title: "Company & Section",
      key: "company_section",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.company}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{r.section}</div>
        </div>
      )
    },
    {
      title: "Category",
      dataIndex: "category_employment",
      key: "category_employment",
      render: (cat) => <Tag color="emerald" style={{ fontWeight: 600 }}>{cat || "Worker"}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (st) => <Tag color={st === "Active" ? "success" : "default"}>{st || "Active"}</Tag>
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenEdit(r)} size="small" />
          <Popconfirm
            title="Delete Employee"
            description="Are you sure you want to delete this employee record?"
            onConfirm={() => handleDelete(r.employee_id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger type="text" icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            Employees Directory
          </Title>
          <Text type="secondary">
            Master Employee Records for Biometric Authentication & Meal Subsidies ({filteredEmployees.length} total)
          </Text>
        </div>

        <Space size="middle">
          <Button type="primary" icon={<UserAddOutlined />} onClick={handleOpenAdd} style={{ fontWeight: 600 }}>
            Add Employee
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Search Toolbar */}
      <Card className="glass-card" style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 14 }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          placeholder="Search by Employee ID, Name, Role, or Department..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />
      </Card>

      {/* Employees Table */}
      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Table
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="employee_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingEmployee ? "Edit Employee Record" : "Register New Employee"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save Employee"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="employee_id"
            label="Employee ID (Biometric ID)"
            rules={[{ required: true, message: "Please specify Employee ID" }]}
          >
            <Input disabled={!!editingEmployee} placeholder="e.g. EMP010" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: "Please specify Employee Name" }]}
          >
            <Input placeholder="e.g. John Silva" />
          </Form.Item>

          <Form.Item
            name="designation"
            label="Designation / Role"
            rules={[{ required: true, message: "Please specify Designation" }]}
          >
            <Input placeholder="e.g. Quality Inspector" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company" label="Company" rules={[{ required: true }]}>
                <Input placeholder="e.g. Hayleys Eco Solutions" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="section" label="Section / Department" rules={[{ required: true }]}>
                <Input placeholder="e.g. Quality Management" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category_employment" label="Category (Meal Plan)" rules={[{ required: true }]}>
                <Select placeholder="Select category">
                  {categories.map((c) => (
                    <Option key={c.category_name} value={c.category_name}>
                      {c.category_name} ({c.configuration_detail})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select>
                  <Option value="Active">Active</Option>
                  <Option value="Inactive">Inactive</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
