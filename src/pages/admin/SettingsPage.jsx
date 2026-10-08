import React, { useState, useEffect } from "react";
import { Card, Tabs, Typography, Table, Button, Form, Input, Select, Space, Tag, Modal, Popconfirm, Alert, message } from "antd";
import {
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  BankOutlined,
  TagOutlined
} from "@ant-design/icons";
import { getCategories, saveCategory, deleteCategory, seedDefaultCategories, ALLOWED_PAYMENT_TYPES } from "../../services/firebase/categoryService";
import { getCompanies, saveCompany, deleteCompany, seedDefaultCompanies } from "../../services/firebase/companyService";
import { seedDefaultEmployees } from "../../services/firebase/employeeService";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function SettingsPage() {
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [savingCat, setSavingCat] = useState(false);
  const [catForm] = Form.useForm();

  // Company Modal State
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState(null);
  const [savingComp, setSavingComp] = useState(false);
  const [compForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, comps] = await Promise.all([getCategories(), getCompanies()]);
      setCategories(c);
      setCompanies(comps);
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

  // Sync Category Form values
  useEffect(() => {
    if (catModalOpen) {
      if (editingCat) {
        catForm.setFieldsValue({
          category_name: editingCat.category_name,
          configuration_detail: editingCat.configuration_detail || "Full Paid",
          description: editingCat.description || ""
        });
      } else {
        catForm.resetFields();
        catForm.setFieldsValue({
          category_name: "",
          configuration_detail: "Full Paid",
          description: ""
        });
      }
    }
  }, [editingCat, catModalOpen, catForm]);

  // Sync Company Form values
  useEffect(() => {
    if (compModalOpen) {
      if (editingComp) {
        compForm.setFieldsValue({
          company_code: editingComp.company_code || "",
          name: editingComp.name || "",
          description: editingComp.description || ""
        });
      } else {
        compForm.resetFields();
        compForm.setFieldsValue({
          company_code: "",
          name: "",
          description: ""
        });
      }
    }
  }, [editingComp, compModalOpen, compForm]);

  // Category Save
  const handleSaveCategory = async () => {
    try {
      const values = await catForm.validateFields();
      setSavingCat(true);
      await saveCategory(
        {
          ...editingCat,
          category_name: values.category_name.trim(),
          configuration_detail: values.configuration_detail,
          description: values.description ? values.description.trim() : ""
        },
        editingCat ? editingCat.category_name : null
      );
      message.success(
        editingCat
          ? `Category '${values.category_name}' updated successfully and synced across employees!`
          : `New category '${values.category_name}' added successfully!`
      );
      setCatModalOpen(false);
      setEditingCat(null);
      await loadData();
    } catch (err) {
      console.error("Category save error:", err);
      message.error(`Save error: ${err.message}`);
    } finally {
      setSavingCat(false);
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

  // Company Save
  const handleSaveCompany = async () => {
    try {
      const values = await compForm.validateFields();
      setSavingComp(true);
      await saveCompany(
        {
          ...editingComp,
          company_code: values.company_code.trim().toUpperCase(),
          name: values.name.trim(),
          description: values.description ? values.description.trim() : ""
        },
        editingComp ? editingComp.name : null
      );
      message.success(
        editingComp
          ? `Company '${values.name}' updated successfully!`
          : `New company '${values.name}' added successfully!`
      );
      setCompModalOpen(false);
      setEditingComp(null);
      await loadData();
    } catch (err) {
      console.error("Company save error:", err);
      message.error(`Failed to save company: ${err.message}`);
    } finally {
      setSavingComp(false);
    }
  };

  const handleDeleteCompany = async (id) => {
    try {
      await deleteCompany(id);
      message.success("Company deleted successfully");
      loadData();
    } catch (err) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  const handleReseed = async () => {
    setLoading(true);
    try {
      await seedDefaultCategories();
      await seedDefaultCompanies();
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
      render: (n) => <Text strong style={{ color: "#0f172a" }}>{n}</Text>
    },
    {
      title: "Subsidy Configuration",
      dataIndex: "configuration_detail",
      key: "configuration_detail",
      render: (d) => {
        const color = d === "Full Paid" ? "green" : d === "Half Paid" ? "orange" : "red";
        return <Tag color={color} style={{ fontWeight: 700, borderRadius: 6, fontSize: "0.85rem" }}>{d}</Tag>;
      }
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (d) => <span style={{ color: "#475569" }}>{d || "-"}</span>
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCat(r);
              setCatModalOpen(true);
            }}
            size="small"
            style={{ fontWeight: 600 }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Category"
            description={`Are you sure you want to delete '${r.category_name}'?`}
            onConfirm={() => handleDeleteCategory(r.id)}
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

  const companyColumns = [
    {
      title: "Company Code",
      dataIndex: "company_code",
      key: "company_code",
      width: 140,
      render: (c) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{c || "HES"}</Tag>
    },
    {
      title: "Company / Plant Name",
      dataIndex: "name",
      key: "name",
      render: (n) => <Text strong style={{ color: "#0f172a" }}>{n}</Text>
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (d) => <span style={{ color: "#475569" }}>{d || "-"}</span>
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => {
              setEditingComp(r);
              setCompModalOpen(true);
            }}
            size="small"
            style={{ fontWeight: 600 }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Company"
            description={`Are you sure you want to delete '${r.name}'?`}
            onConfirm={() => handleDeleteCompany(r.id)}
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
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Master Data & System Settings
          </Title>
          <Text type="secondary" style={{ color: "#475569" }}>
            Configure meal categories (Half Paid, Full Paid, Not Paid), operating companies, and Firestore data
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} style={{ borderRadius: 8, fontWeight: 600 }}>
          Refresh
        </Button>
      </div>

      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Tabs
          defaultActiveKey="categories"
          items={[
            {
              key: "categories",
              label: <span style={{ fontWeight: 700, color: "#0f172a" }}><TagOutlined /> Employee Meal Categories</span>,
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <Paragraph type="secondary" style={{ margin: 0, color: "#475569" }}>
                      Define and update employment categories and their subsidy rule (<b>Half Paid</b>, <b>Full Paid</b>, or <b>Not Paid</b>):
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingCat(null);
                        setCatModalOpen(true);
                      }}
                      style={{ fontWeight: 700 }}
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
                    scroll={{ x: 600 }}
                  />
                </div>
              )
            },
            {
              key: "companies",
              label: <span style={{ fontWeight: 700, color: "#0f172a" }}><BankOutlined /> Operating Companies</span>,
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <Paragraph type="secondary" style={{ margin: 0, color: "#475569" }}>
                      Manage registered plants, subsidiaries, and company operating units:
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingComp(null);
                        setCompModalOpen(true);
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      Add Company
                    </Button>
                  </div>

                  <Table
                    dataSource={companies}
                    columns={companyColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 600 }}
                  />
                </div>
              )
            },
            {
              key: "data",
              label: <span style={{ fontWeight: 700, color: "#0f172a" }}><DatabaseOutlined /> Database Tools</span>,
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%", padding: "12px 0" }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Connected to Firebase Project: meal-management-project"
                    description="All meal allocations, employee lookups, company masters, and category rules are actively synchronized with Google Cloud Firestore and Firebase Storage."
                  />

                  <Card style={{ background: "#f8fafc", borderRadius: 12 }}>
                    <Title level={5} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                      Seed Default System Records
                    </Title>
                    <Paragraph type="secondary" style={{ margin: "8px 0 16px", color: "#475569" }}>
                      Populate initial default employee records, master companies, and standard subsidy categories in Firestore if needed.
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<DatabaseOutlined />}
                      onClick={handleReseed}
                      loading={loading}
                      style={{ background: "#059669", fontWeight: 700 }}
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

      {/* Category Add/Edit Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ color: "#059669" }} />
            <span style={{ fontWeight: 800, color: "#0f172a" }}>
              {editingCat ? `Edit Category: ${editingCat.category_name}` : "Add New Employee Category"}
            </span>
          </div>
        }
        open={catModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => {
          setCatModalOpen(false);
          setEditingCat(null);
        }}
        okText={editingCat ? "Update Category" : "Save Category"}
        confirmLoading={savingCat}
        destroyOnClose
      >
        <Form form={catForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="category_name"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Category Name</span>}
            rules={[{ required: true, message: "Please specify the category name" }]}
          >
            <Input placeholder="e.g. Executive, Staff, Worker, Contractor, Visitor" />
          </Form.Item>

          <Form.Item
            name="configuration_detail"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Payment Subsidy Plan</span>}
            rules={[{ required: true, message: "Please select payment subsidy rule" }]}
          >
            <Select placeholder="Select subsidy type">
              <Option value="Full Paid">Full Paid (100% Company Subsidized)</Option>
              <Option value="Half Paid">Half Paid (50% Subsidized / Co-Pay)</Option>
              <Option value="Not Paid">Not Paid (Unsubsidized / Full Rate)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Description (Optional)</span>}
          >
            <Input.TextArea rows={2} placeholder="Optional notes regarding employment level or terms" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Company Add/Edit Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BankOutlined style={{ color: "#0284c7" }} />
            <span style={{ fontWeight: 800, color: "#0f172a" }}>
              {editingComp ? `Edit Company: ${editingComp.name}` : "Add New Operating Company"}
            </span>
          </div>
        }
        open={compModalOpen}
        onOk={handleSaveCompany}
        onCancel={() => {
          setCompModalOpen(false);
          setEditingComp(null);
        }}
        okText={editingComp ? "Update Company" : "Save Company"}
        confirmLoading={savingComp}
        destroyOnClose
      >
        <Form form={compForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="company_code"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Company Code</span>}
            rules={[{ required: true, message: "Please enter a Company Code (e.g. HES, HFP)" }]}
          >
            <Input placeholder="e.g. HES, HFP, HAG, HLG" />
          </Form.Item>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Company / Plant Name</span>}
            rules={[{ required: true, message: "Please enter company / plant name" }]}
          >
            <Input placeholder="e.g. Hayleys Eco Solutions, Hayleys Fibre Plant 1" />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Description (Optional)</span>}
          >
            <Input.TextArea rows={2} placeholder="Optional location or operational notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
