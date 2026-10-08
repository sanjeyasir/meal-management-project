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
  Alert,
  Upload,
  Divider,
  Badge
} from "antd";
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  IdcardOutlined,
  FileExcelOutlined,
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from "@ant-design/icons";
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
  isEmployeeIdUnique
} from "../../services/firebase/employeeService";
import { getCategories, normalizePaymentType } from "../../services/firebase/categoryService";
import { getCompanies } from "../../services/firebase/companyService";
import {
  downloadEmployeeTemplate,
  exportEmployeesToExcel,
  parseEmployeeExcelUpload,
  batchSaveEmployees
} from "../../utils/employeeExcelManager";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  // Excel Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [parsedEmployees, setParsedEmployees] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emps, cats, comps] = await Promise.all([
        getEmployees(),
        getCategories(),
        getCompanies()
      ]);
      setEmployees(emps);
      setCategories(cats);
      setCompanies(comps);
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

  // Sync Form values whenever modal opens or editing record changes
  useEffect(() => {
    if (modalOpen) {
      if (editingEmployee) {
        form.setFieldsValue({
          employee_id: editingEmployee.employee_id || editingEmployee.id || "",
          name: editingEmployee.name || "",
          designation: editingEmployee.designation || "Staff",
          category_employment: editingEmployee.category_employment || editingEmployee.category_name || "Staff",
          company: editingEmployee.company || (companies[0]?.name || "Hayleys Eco Solutions")
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          employee_id: "",
          name: "",
          designation: "Staff",
          category_employment: categories[1]?.category_name || "Staff",
          company: companies[0]?.name || "Hayleys Eco Solutions"
        });
      }
    }
  }, [editingEmployee, modalOpen, form, categories, companies]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingEmployee(record);
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

  // Excel Handlers
  const handleDownloadTemplate = async () => {
    try {
      message.loading({ content: "Preparing Excel template with dropdown lists...", key: "template_dl" });
      await downloadEmployeeTemplate(categories, companies);
      message.success({ content: "Excel Template downloaded successfully!", key: "template_dl" });
    } catch (err) {
      console.error("Template error:", err);
      message.error({ content: `Failed downloading template: ${err.message}`, key: "template_dl" });
    }
  };

  const handleExportDirectory = async () => {
    try {
      message.loading({ content: "Generating employee directory export...", key: "export_dl" });
      await exportEmployeesToExcel(filteredEmployees);
      message.success({ content: "Employee directory exported to Excel!", key: "export_dl" });
    } catch (err) {
      console.error("Export error:", err);
      message.error({ content: `Failed exporting: ${err.message}`, key: "export_dl" });
    }
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    try {
      const { validEmployees, errors } = await parseEmployeeExcelUpload(file);
      setParsedEmployees(validEmployees);
      setImportErrors(errors);
      if (validEmployees.length > 0) {
        message.info(`Parsed ${validEmployees.length} employee row(s) from Excel file.`);
      }
    } catch (err) {
      console.error("Excel parse error:", err);
      message.error(`Error reading Excel: ${err.message}`);
      setParsedEmployees([]);
      setImportErrors([err.message]);
    }
    return false; // Prevent automatic upload post
  };

  const handleConfirmImport = async () => {
    if (!parsedEmployees.length) {
      message.warning("No valid employee rows to import.");
      return;
    }

    setImporting(true);
    try {
      const res = await batchSaveEmployees(parsedEmployees);
      message.success(`Successfully registered and imported ${res.savedCount} employees!`);
      setImportModalOpen(false);
      setParsedEmployees([]);
      setImportErrors([]);
      setSelectedFile(null);
      await loadData();
    } catch (err) {
      console.error("Import save error:", err);
      message.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      (e.name || "").toLowerCase().includes(s) ||
      (e.employee_id || "").toLowerCase().includes(s) ||
      (e.designation || "").toLowerCase().includes(s) ||
      (e.company || "").toLowerCase().includes(s) ||
      (e.category_employment || e.category_name || "").toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 140,
      fixed: "left",
      render: (id) => (
        <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, padding: "2px 8px" }}>
          {id}
        </Tag>
      ),
      sorter: (a, b) => String(a.employee_id).localeCompare(String(b.employee_id))
    },
    {
      title: "Full Name",
      dataIndex: "name",
      key: "name",
      render: (name) => <Text strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{name}</Text>,
      sorter: (a, b) => (a.name || "").localeCompare(b.name || "")
    },
    {
      title: "Designation",
      dataIndex: "designation",
      key: "designation",
      render: (desig) => <span style={{ color: "#334155", fontWeight: 500 }}>{desig || "Staff"}</span>
    },
    {
      title: "Meal Category",
      dataIndex: "category_employment",
      key: "category_employment",
      width: 140,
      render: (cat, r) => {
        const catName = cat || r.category_name || "Staff";
        return <Tag color="cyan" style={{ fontWeight: 600 }}>{catName}</Tag>;
      }
    },
    {
      title: "Payment Plan",
      key: "pay_category",
      width: 140,
      render: (_, r) => {
        const normPay = normalizePaymentType(r.pay_category || r.category_employment);
        const subsidyColor = normPay === "Full Paid" ? "green" : normPay === "Half Paid" ? "orange" : "red";
        return <Tag color={subsidyColor} style={{ fontWeight: 700 }}>{normPay}</Tag>;
      }
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      render: (comp) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{comp || "Hayleys Eco Solutions"}</Tag>
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit Employee">
            <Button
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(r)}
              size="small"
              style={{ fontWeight: 600 }}
            >
              Edit
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete Employee Record"
            description={`Are you sure you want to delete ${r.name} (${r.employee_id || r.id})?`}
            onConfirm={() => handleDelete(r.employee_id || r.id)}
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
            Employees Directory
          </Title>
          <Text type="secondary" style={{ color: "#475569" }}>
            Master Employee Records, Meal Categories, and Operating Companies ({filteredEmployees.length} total)
          </Text>
        </div>

        <Space size="small" wrap>
          <Button
            icon={<FileExcelOutlined style={{ color: "#059669" }} />}
            onClick={handleDownloadTemplate}
            style={{ fontWeight: 600, borderColor: "#059669" }}
          >
            Download Template
          </Button>
          <Button
            icon={<UploadOutlined style={{ color: "#0284c7" }} />}
            onClick={() => setImportModalOpen(true)}
            style={{ fontWeight: 600, borderColor: "#0284c7" }}
          >
            Import Excel
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportDirectory}
            style={{ fontWeight: 600 }}
          >
            Export
          </Button>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={handleOpenAdd}
            style={{ fontWeight: 700, background: "#059669", borderColor: "#059669" }}
          >
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
          placeholder="Search by Employee ID, Name, Designation, or Company..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 480 }}
        />
      </Card>

      {/* Employees Table */}
      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <Table
          bordered
          size="middle"
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="employee_id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Add / Edit Employee Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IdcardOutlined style={{ color: "#059669", fontSize: 20 }} />
            <span style={{ fontWeight: 800, color: "#0f172a" }}>
              {editingEmployee ? `Edit Employee (${editingEmployee.employee_id})` : "Register New Employee Profile"}
            </span>
          </div>
        }
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingEmployee ? "Update Employee" : "Register Employee"}
        confirmLoading={saving}
        width={580}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="employee_id"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Employee ID / Biometric Code</span>}
            rules={[
              { required: true, message: "Please enter an Employee ID" },
              {
                validator: async (_, value) => {
                  if (!value || !value.trim()) return Promise.resolve();
                  const cleanId = value.trim();
                  const origId = editingEmployee?.employee_id;

                  if (origId && cleanId.toLowerCase() === String(origId).trim().toLowerCase()) {
                    return Promise.resolve();
                  }

                  const localCollision = employees.find(
                    (e) =>
                      e.employee_id.toLowerCase() === cleanId.toLowerCase() &&
                      (!origId || e.employee_id.toLowerCase() !== String(origId).trim().toLowerCase())
                  );
                  if (localCollision) {
                    return Promise.reject(
                      new Error(`Employee ID '${cleanId}' is already assigned to ${localCollision.name}.`)
                    );
                  }

                  const isUnique = await isEmployeeIdUnique(cleanId, origId);
                  if (!isUnique) {
                    return Promise.reject(
                      new Error(`Employee ID '${cleanId}' already exists in database.`)
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

          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Full Name</span>}
            rules={[{ required: true, message: "Please specify Employee Full Name" }]}
          >
            <Input placeholder="e.g. Sanjey Asirvatham" />
          </Form.Item>

          <Form.Item
            name="designation"
            label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Designation / Job Role</span>}
            rules={[{ required: true, message: "Please specify Designation" }]}
          >
            <Input placeholder="e.g. Quality Assurance Lead, Production Supervisor" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category_employment"
                label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Meal Category</span>}
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

            <Col xs={24} sm={12}>
              <Form.Item
                name="company"
                label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Company / Plant</span>}
                rules={[{ required: true, message: "Please select company" }]}
              >
                <Select placeholder="Select operating company">
                  {companies.map((comp) => (
                    <Option key={comp.name} value={comp.name}>
                      {comp.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileExcelOutlined style={{ color: "#059669", fontSize: 22 }} />
            <span style={{ fontWeight: 800, color: "#0f172a" }}>Import Employees from Excel</span>
          </div>
        }
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setParsedEmployees([]);
          setImportErrors([]);
          setSelectedFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setImportModalOpen(false);
              setParsedEmployees([]);
              setImportErrors([]);
              setSelectedFile(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importing}
            disabled={parsedEmployees.length === 0}
            onClick={handleConfirmImport}
            style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
          >
            Confirm & Import ({parsedEmployees.length} Employees)
          </Button>
        ]}
        width={750}
        destroyOnClose
      >
        <div style={{ padding: "10px 0" }}>
          <Alert
            type="info"
            showIcon
            message="Excel Format Requirements"
            description={
              <div>
                Columns expected: <b>Employee ID</b>, <b>Full Name</b>, <b>Designation</b>, <b>Meal Category</b>, <b>Company</b>.
                You can download the pre-configured template with dropdown lists below.
              </div>
            }
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Get Template
              </Button>
            }
          />

          <Dragger
            accept=".xlsx, .xls"
            maxCount={1}
            beforeUpload={handleFileSelect}
            showUploadList={false}
            style={{ padding: "20px 0", marginBottom: 16, borderRadius: 12 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: "#059669", fontSize: 40 }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 700, color: "#0f172a" }}>
              Click or drag employee Excel file to this area
            </p>
            <p className="ant-upload-hint" style={{ color: "#64748b" }}>
              Support for standard .xlsx spreadsheets created from the official template
            </p>
          </Dragger>

          {selectedFile && (
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Tag color="green">File: {selectedFile.name}</Tag>
              <Text type="secondary">({Math.round(selectedFile.size / 1024)} KB)</Text>
            </div>
          )}

          {importErrors.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`Validation Notices (${importErrors.length})`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 100, overflowY: "auto" }}>
                  {importErrors.map((err, idx) => (
                    <li key={idx} style={{ fontSize: "0.85rem", color: "#b45309" }}>{err}</li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {parsedEmployees.length > 0 && (
            <div>
              <Title level={5} style={{ margin: "10px 0", color: "#0f172a", fontWeight: 700 }}>
                Parsed Employees Ready for Import ({parsedEmployees.length})
              </Title>
              <Table
                dataSource={parsedEmployees}
                rowKey="employee_id"
                size="small"
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: "ID", dataIndex: "employee_id", width: 110, render: (id) => <Tag color="blue">{id}</Tag> },
                  { title: "Full Name", dataIndex: "name", render: (n) => <Text strong>{n}</Text> },
                  { title: "Designation", dataIndex: "designation" },
                  { title: "Category", dataIndex: "category_employment", render: (c) => <Tag color="cyan">{c}</Tag> },
                  { title: "Company", dataIndex: "company", render: (comp) => <Tag color="geekblue">{comp}</Tag> }
                ]}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
