import React, { useState, useEffect } from "react";
import { Card, Tabs, Typography, Table, Button, Form, Input, Select, Space, Tag, Modal, Popconfirm, Alert, message } from "antd";
import {
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import { getCategories, saveCategory, deleteCategory, seedDefaultCategories } from "../../services/firebase/categoryService";
import { getDepartments, addDepartment, deleteDepartment } from "../../services/firebase/departmentService";
import { seedDefaultEmployees } from "../../services/firebase/employeeService";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function SettingsPage() {
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm] = Form.useForm();

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, d] = await Promise.all([getCategories(), getDepartments()]);
      setCategories(c);
      setDepartments(d);
    } catch (err) {
      console.error("Error loading settings data:", err);
      message.error("Failed to load settings data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Category Save
  const handleSaveCategory = async () => {
    try {
      const values = await catForm.validateFields();
      await saveCategory({
        ...editingCat,
        ...values
      });
      message.success(editingCat ? "Category updated" : "New category added");
      setCatModalOpen(false);
      loadData();
    } catch (err) {
      message.error(`Save error: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      message.success("Category deleted");
      loadData();
    } catch (err) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  // Department Save
  const handleSaveDepartment = async () => {
    try {
      const values = await deptForm.validateFields();
      await addDepartment(values.dept_id, values.name);
      message.success("Department added");
      setDeptModalOpen(false);
      deptForm.resetFields();
      loadData();
    } catch (err) {
      message.error(`Failed: ${err.message}`);
    }
  };

  const handleDeleteDepartment = async (id) => {
    try {
      await deleteDepartment(id);
      message.success("Department deleted");
      loadData();
    } catch (err) {
      message.error(`Failed: ${err.message}`);
    }
  };

  const handleReseed = async () => {
    setLoading(true);
    try {
      await seedDefaultCategories();
      await seedDefaultEmployees();
      message.success("Initial Firestore database seed applied successfully!");
      loadData();
    } catch (err) {
      message.error(`Reseed error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const categoryColumns = [
    {
      title: "Category Name",
      dataIndex: "category_name",
      key: "category_name",
      render: (n) => <Text strong>{n}</Text>
    },
    {
      title: "Subsidy Configuration",
      dataIndex: "configuration_detail",
      key: "configuration_detail",
      render: (d) => {
        const color = d === "Free Meal" ? "green" : d === "Half Paid" ? "orange" : "red";
        return <Tag color={color} style={{ fontWeight: 700 }}>{d}</Tag>;
      }
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (d) => <span style={{ color: "#64748b" }}>{d || "-"}</span>
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCat(r);
              catForm.setFieldsValue(r);
              setCatModalOpen(true);
            }}
            size="small"
          />
          <Popconfirm
            title="Delete Category"
            description="Are you sure?"
            onConfirm={() => handleDeleteCategory(r.id)}
          >
            <Button danger type="text" icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const deptColumns = [
    {
      title: "Dept ID",
      dataIndex: "dept_id",
      key: "dept_id",
      render: (d) => <Tag color="blue">{d}</Tag>
    },
    {
      title: "Department / Section Name",
      dataIndex: "name",
      key: "name",
      render: (n) => <Text strong>{n}</Text>
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_, r) => (
        <Popconfirm
          title="Delete Department"
          description="Are you sure?"
          onConfirm={() => handleDeleteDepartment(r.id)}
        >
          <Button danger type="text" icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            Master Data & System Settings
          </Title>
          <Text type="secondary">
            Configure meal categories, plant departments, and Firebase Firestore seedings
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Tabs
          defaultActiveKey="categories"
          items={[
            {
              key: "categories",
              label: "🏷 Employee Meal Categories",
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      Define how each employment category maps to meal pricing (<b>Free Meal</b>, <b>Half Paid</b>, or <b>Not Paid</b>):
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingCat(null);
                        catForm.resetFields();
                        setCatModalOpen(true);
                      }}
                    >
                      Add Category
                    </Button>
                  </div>

                  <Table
                    dataSource={categories}
                    columns={categoryColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                  />
                </div>
              )
            },
            {
              key: "departments",
              label: "🏢 Plant Departments",
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      Manage plant sections and operational departments:
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setDeptModalOpen(true)}
                    >
                      Add Department
                    </Button>
                  </div>

                  <Table
                    dataSource={departments}
                    columns={deptColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                  />
                </div>
              )
            },
            {
              key: "data",
              label: "⚡ Database & Middleware Tools",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%", padding: "12px 0" }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Connected to Firebase Project: meal-management-project"
                    description="All meal allocations, employee lookups, and category rules are actively synchronized with Google Cloud Firestore."
                  />

                  <Card style={{ background: "#f8fafc", borderRadius: 12 }}>
                    <Title level={5} style={{ margin: 0, fontWeight: 700 }}>
                      Seed Default System Records
                    </Title>
                    <Paragraph type="secondary" style={{ margin: "8px 0 16px" }}>
                      Populate initial default employee records (EMP001 - EMP005, Admin) and standard subsidy categories in Firestore if needed.
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<DatabaseOutlined />}
                      onClick={handleReseed}
                      loading={loading}
                      style={{ background: "#059669" }}
                    >
                      Reseed Master Data in Firestore
                    </Button>
                  </Card>
                </Space>
              )
            }
          ]}
        />
      </Card>

      {/* Category Modal */}
      <Modal
        title={editingCat ? "Edit Category" : "Add Employee Category"}
        open={catModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => setCatModalOpen(false)}
      >
        <Form form={catForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="category_name" label="Category Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Executive, Staff, Worker, Contractor" />
          </Form.Item>
          <Form.Item name="configuration_detail" label="Payment Subsidy Plan" rules={[{ required: true }]}>
            <Select placeholder="Select subsidy type">
              <Option value="Free Meal">Free Meal</Option>
              <Option value="Half Paid">Half Paid</Option>
              <Option value="Not Paid">Not Paid</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Department Modal */}
      <Modal
        title="Add Department"
        open={deptModalOpen}
        onOk={handleSaveDepartment}
        onCancel={() => setDeptModalOpen(false)}
      >
        <Form form={deptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="dept_id" label="Department ID" rules={[{ required: true }]}>
            <Input placeholder="e.g. QA-01, PR-01" />
          </Form.Item>
          <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Quality Assurance" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
