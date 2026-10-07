import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Typography,
  Button,
  Input,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  Popconfirm,
  message,
  Row,
  Col,
  Tooltip,
  Alert
} from "antd";
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
  isEmployeeIdUnique
} from "../../services/firebase/employeeService";
import { getCategories } from "../../services/firebase/categoryService";
import { getDepartments } from "../../services/firebase/departmentService";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    form.resetFields();
    form.setFieldsValue({
      ...record,
      category_employment: record.category_employment || record.category_name || "Staff"
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const originalId = editingEmployee?.employee_id;
      const cleanNewId = values.employee_id.trim();

      await saveEmployee(
        {
          ...editingEmployee,
          ...values,
          employee_id: cleanNewId
        },
        originalId
      );

      message.success(
        editingEmployee
          ? `Employee ${values.name} (${cleanNewId}) updated successfully!`
          : `New employee ${values.name} (${cleanNewId}) registered!`
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Save employee error:", err);
      message.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (employeeId) => {
    try {
      await deleteEmployee(employeeId);
      message.success(`Employee ${employeeId} removed successfully.`);
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
      (e.section || "").toLowerCase().includes(s) ||
      (e.company || "").toLowerCase().includes(s) ||
      (e.category_employment || "").toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 140,
      render: (id) => (
        <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, padding: "2px 8px" }}>
          {id}
        </Tag>
      ),
      sorter: (a, b) => String(a.employee_id).localeCompare(String(b.employee_id))
    },
    {
      title: "Full Name & Designation",
      key: "name_role",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{r.name}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{r.designation}</div>
          {(r.email || r.phone) && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", gap: 8 }}>
              {r.email && <span>✉️ {r.email}</span>}
              {r.phone && <span>📞 {r.phone}</span>}
            </div>
          )}
        </div>
      )
    },
    {
      title: "Company & Section",
      key: "company_section",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155" }}>{r.company || "Hayleys Eco Solutions"}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{r.section || "General Operations"}</div>
        </div>
      )
    },
    {
      title: "Meal Category",
      dataIndex: "category_employment",
      key: "category_employment",
      width: 140,
      render: (cat) => <Tag color="cyan" style={{ fontWeight: 600 }}>{cat || "Staff"}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (st) => (
        <Tag color={st === "Active" ? "success" : "default"} style={{ fontWeight: 600 }}>
          {st || "Active"}
        </Tag>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit Employee Details & ID">
            <Button
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(r)}
              size="small"
            >
              Edit
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete Employee Record"
            description={`Are you sure you want to delete ${r.name} (${r.employee_id || r.emp_id || r.id})?`}
            onConfirm={() => handleDelete(r.employee_id || r.emp_id || r.id || r.doc_id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
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
            Master Employee Records and Meal Subsidy Profiles ({filteredEmployees.length} total)
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
          placeholder="Search by Employee ID, Name, Role, Company, or Section..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 450 }}
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

      {/* Add / Edit Employee Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IdcardOutlined style={{ color: "#10b981", fontSize: 20 }} />
            <span style={{ fontWeight: 700 }}>
              {editingEmployee ? `Edit Employee Details (${editingEmployee.employee_id})` : "Register New Employee Profile"}
            </span>
          </div>
        }
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingEmployee ? "Update Employee" : "Register Employee"}
        confirmLoading={saving}
        width={650}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Unique Employee ID Required"
          description="Employee ID must be unique across all active profiles."
          style={{ marginTop: 12, marginBottom: 16, borderRadius: 10 }}
        />

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="employee_id"
                label={<span style={{ fontWeight: 600 }}>Employee ID</span>}
                rules={[
                  { required: true, message: "Please enter an Employee ID" },
                  {
                    validator: async (_, value) => {
                      if (!value || !value.trim()) return Promise.resolve();
                      const cleanId = value.trim();
                      const origId = editingEmployee?.employee_id;

                      // If unchanged in edit mode, it's valid
                      if (origId && cleanId.toLowerCase() === String(origId).trim().toLowerCase()) {
                        return Promise.resolve();
                      }

                      // Check local table cache first for instant feedback
                      const localCollision = employees.find(
                        (e) =>
                          e.employee_id.toLowerCase() === cleanId.toLowerCase() &&
                          (!origId || e.employee_id.toLowerCase() !== String(origId).trim().toLowerCase())
                      );
                      if (localCollision) {
                        return Promise.reject(
                          new Error(`Employee ID '${cleanId}' is already assigned to ${localCollision.name}. Please enter a unique ID.`)
                        );
                      }

                      // Check against Firestore
                      const isUnique = await isEmployeeIdUnique(cleanId, origId);
                      if (!isUnique) {
                        return Promise.reject(
                          new Error(`Employee ID '${cleanId}' already exists in the database. Please choose a unique ID.`)
                        );
                      }

                      return Promise.resolve();
                    }
                  }
                ]}
                hasFeedback
              >
                <Input placeholder="e.g. EMP001 or 12345" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Full Name</span>}
                rules={[{ required: true, message: "Please specify Employee Full Name" }]}
              >
                <Input placeholder="e.g. John Silva" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="designation"
                label={<span style={{ fontWeight: 600 }}>Designation / Job Role</span>}
                rules={[{ required: true, message: "Please specify Designation" }]}
              >
                <Input placeholder="e.g. Quality Assurance Lead" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category_employment"
                label={<span style={{ fontWeight: 600 }}>Meal Category / Entitlement</span>}
                rules={[{ required: true, message: "Please select meal category" }]}
              >
                <Select placeholder="Select category">
                  {categories.map((c) => (
                    <Option key={c.category_name} value={c.category_name}>
                      {c.category_name} ({c.configuration_detail})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="company"
                label={<span style={{ fontWeight: 600 }}>Company / Plant</span>}
                rules={[{ required: true, message: "Please specify company" }]}
              >
                <Input placeholder="e.g. Hayleys Eco Solutions" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="section"
                label={<span style={{ fontWeight: 600 }}>Section / Department</span>}
                rules={[{ required: true, message: "Please specify section/department" }]}
              >
                <Input placeholder="e.g. Quality Management" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email Address (Optional)"
                rules={[{ type: "email", message: "Please enter a valid email" }]}
              >
                <Input prefix={<MailOutlined />} placeholder="john.s@hayleys.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Contact Phone (Optional)"
              >
                <Input prefix={<PhoneOutlined />} placeholder="+94 77 123 4567" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="status"
            label={<span style={{ fontWeight: 600 }}>Account Status</span>}
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Active">Active (Eligible for Meal Ordering & Biometric Login)</Option>
              <Option value="Inactive">Inactive (Suspended)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
