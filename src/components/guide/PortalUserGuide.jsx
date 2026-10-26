import React, { useState } from "react";
import {
  Card,
  Typography,
  Tabs,
  Button,
  Tag,
  Row,
  Col,
  Space,
  Divider,
  Image,
  Alert,
  Timeline,
  Table
} from "antd";
import {
  FilePdfOutlined,
  CompassOutlined,
  DashboardOutlined,
  TableOutlined,
  HistoryOutlined,
  CloudServerOutlined,
  TeamOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function PortalUserGuide({ onDownloadPdf }) {
  const [activeTab, setActiveTab] = useState("overview");

  const pdfUrl = "/docs/Meal_Management_Web_Portal_User_Manual.pdf";

  const handleDownload = () => {
    if (onDownloadPdf) {
      onDownloadPdf();
    } else {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = "Meal_Management_Web_Portal_User_Manual.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const modules = [
    {
      key: "overview",
      tab: (
        <span>
          <CompassOutlined /> Overview & SOP
        </span>
      ),
      content: (
        <div>
          <Alert
            message="Hayleys Eco Solutions • Official Web Portal User Documentation"
            description="Complete operational guide and standard operating procedure (SOP) for system administrators, HR executives, and catering management teams. Also available as an executive PDF document."
            type="success"
            showIcon
            action={
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                style={{ background: "#15803d", borderColor: "#15803d" }}
                onClick={handleDownload}
              >
                Download PDF Manual (4 MB)
              </Button>
            }
            style={{ marginBottom: 20, borderRadius: 12 }}
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: "#16a34a" }} />
                    <span style={{ fontWeight: 700 }}>System Roles & Core Objectives</span>
                  </Space>
                }
                bordered={false}
                style={{ background: "#f8fafc", borderRadius: 14 }}
              >
                <Paragraph style={{ fontSize: 13, color: "#334155" }}>
                  The Hayleys Eco Solutions Meal Management System digitizes the complete employee meal cycle: from employee kiosk touchless bookings to real-time catering summaries and HR payroll reconciliation.
                </Paragraph>
                <ul style={{ paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
                  <li><strong>Zero Food Waste:</strong> Accurate meal forecasts sent directly to central kitchens.</li>
                  <li><strong>Automated Subsidy Policies:</strong> Worker (Full Paid), Staff (Half Paid), Contractor (Not Paid).</li>
                  <li><strong>Multi-Day Cloud Archives:</strong> Automated 3-day consolidated Excel workbooks uploaded to Firebase Cloud Storage.</li>
                </ul>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: "#ea580c" }} />
                    <span style={{ fontWeight: 700 }}>Meal Slots & Kitchen Cutoff Timetable</span>
                  </Space>
                }
                bordered={false}
                style={{ background: "#fff7ed", borderRadius: 14 }}
              >
                <Timeline
                  style={{ marginTop: 8 }}
                  items={[
                    {
                      color: "#16a34a",
                      children: (
                        <div>
                          <strong>Breakfast (06:00 AM – 09:00 AM)</strong>
                          <div style={{ fontSize: 12, color: "#64748b" }}>Order Cutoff: 09:00 AM sharp</div>
                        </div>
                      )
                    },
                    {
                      color: "#2563eb",
                      children: (
                        <div>
                          <strong>Lunch (11:00 AM – 01:00 PM)</strong>
                          <div style={{ fontSize: 12, color: "#64748b" }}>Order Cutoff: 11:00 AM sharp</div>
                        </div>
                      )
                    },
                    {
                      color: "#dc2626",
                      children: (
                        <div>
                          <strong>Dinner (04:00 PM – 09:00 PM)</strong>
                          <div style={{ fontSize: 12, color: "#64748b" }}>Order Cutoff: 04:00 PM sharp</div>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: "24px 0 16px" }} />

          <Title level={4} style={{ color: "#065f46", marginBottom: 12 }}>
            📚 System Modules Directory
          </Title>
          <Row gutter={[12, 12]}>
            {[
              { id: "mod1", title: "1. Secure Login", desc: "Admin credentials & role-based authentication", route: "#/admin/login" },
              { id: "mod2", title: "2. Operations Dashboard", desc: "Live KPI metrics, portion breakdown & designation consumption", route: "#/admin/dashboard" },
              { id: "mod3", title: "3. Today's Allocations", desc: "Real-time table, search filters & Formatted Excel export", route: "#/admin/reports" },
              { id: "mod4", title: "4. Previous Day Allocations", desc: "Historical query, custom date ranges & audit export", route: "#/admin/all-allocations" },
              { id: "mod5", title: "5. Daily Archived Reports", desc: "3-day consolidated archives & 1:00 AM storage maintenance", route: "#/admin/daily-archive" },
              { id: "mod6", title: "6. Employees Directory", desc: "579+ workforce records, Excel template & bulk import/export", route: "#/admin/employees" },
              { id: "mod7", title: "7. System Master Data", desc: "Subsidy matrix (Full/Half/None) & company entities", route: "#/admin/settings" }
            ].map((m) => (
              <Col xs={24} sm={12} md={8} key={m.id}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => setActiveTab(m.id)}
                  style={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
                >
                  <Text strong style={{ color: "#0f172a", fontSize: 13 }}>{m.title}</Text>
                  <Paragraph type="secondary" style={{ fontSize: 12, margin: "4px 0 6px" }}>{m.desc}</Paragraph>
                  <Tag color="green" style={{ fontSize: 11 }}>{m.route}</Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )
    },
    {
      key: "mod1",
      tab: (
        <span>
          <SafetyCertificateOutlined /> 1. Login
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 01 • Route: #/admin/login</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Secure Portal Authentication
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                ආරක්ෂිත පරිපාලක පිවිසුම • பாதுகாப்பான நிர்வாக நுழைவு
              </Text>

              <Paragraph style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                Access to the management portal is strictly restricted to designated administrative and supervisory staff. The system is protected with role-based route guards and encrypted session tokens.
              </Paragraph>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <Text strong style={{ color: "#166534" }}>Key Operations:</Text>
                <ol style={{ paddingLeft: 18, marginTop: 6, fontSize: 13, color: "#334155" }}>
                  <li>Enter your registered Admin Email or ID.</li>
                  <li>Provide your secure management password.</li>
                  <li>Click <strong>"Sign In to Management Portal"</strong> to immediately access the live Operations Dashboard.</li>
                </ol>
              </div>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web1.png"
                  alt="Admin Login Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 1.1: Web Management Portal Login Screen (web1.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod2",
      tab: (
        <span>
          <DashboardOutlined /> 2. Dashboard
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 02 • Route: #/admin/dashboard</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Operations & Consumption Dashboard
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                සජීවී මෙහෙයුම් සහ පරිභෝජන උපකරණ පුවරුව • நேரடி செயல்பாடுகள் & நுகர்வு டாஷ்போர்டு
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                The central nerve center providing instant catering visibility across all plant shifts:
              </Paragraph>

              <ul style={{ paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                <li><strong>Total Meals Scheduled:</strong> Total ordered portions in the selected timeframe.</li>
                <li><strong>Dispensed (Received):</strong> Real-time meal counter verified at the catering point.</li>
                <li><strong>Pending Dispensing:</strong> Count of meals awaiting pickup by employees.</li>
                <li><strong>Registered Workforce:</strong> 579+ active enrolled employee profiles.</li>
                <li><strong>Portion Demand Breakdown:</strong> Real-time progress bars for Breakfast, Lunch, and Dinner.</li>
                <li><strong>Department & Subsidy Distribution:</strong> Breakdown across Full Paid, Half Paid, and Not Paid.</li>
                <li><strong>Excel Export:</strong> One-click <em>"Download Excel Report"</em> button.</li>
              </ul>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web2.png"
                  alt="Operations Dashboard Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 2.1: Live Operations & Consumption Dashboard (web2.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod3",
      tab: (
        <span>
          <TableOutlined /> 3. Today's Reports
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 03 • Route: #/admin/reports</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Today's Allocations & Formatted Excel
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                අද දින ආහාර වෙන්කිරීම් සහ එක්සෙල් වාර්තා • இன்றைய உணவு ஒதுக்கீடுகள் & எக்செல் அறிக்கைகள்
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                Real-time active order monitoring and kitchen dispatch handoff:
              </Paragraph>

              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <Text strong style={{ color: "#065f46" }}>Operational Capabilities:</Text>
                <ul style={{ paddingLeft: 16, marginTop: 4, fontSize: 12.5, color: "#334155", lineHeight: 1.6 }}>
                  <li><strong>Search & Filter:</strong> Instantly filter by Employee Name, ID, Company, Meal Slot, Status (Ordered/Dispensed), and Subsidy.</li>
                  <li><strong>Export Formatted Excel:</strong> Produces a structured <code>.xlsx</code> roster for catering kitchen preparation and physical signature verification.</li>
                  <li><strong>Administrative Order Removal:</strong> Direct "Delete" action button to cancel duplicate or erroneous meal bookings.</li>
                </ul>
              </div>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web3.png"
                  alt="Today's Allocations Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 3.1: Today's Allocations Table & Filter Engine (web3.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod4",
      tab: (
        <span>
          <HistoryOutlined /> 4. Previous Day Allocations
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 04 • Route: #/admin/all-allocations</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Previous Day Allocations & Historical Audits
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                පෙර දින වෙන්කිරීම් විගණනය • முந்தைய நாள் ஒதுக்கீடுகள் மற்றும் தணிக்கை
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                Read-only historical allocations audit from archived records prior to the current date:
              </Paragraph>

              <ul style={{ paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                <li><strong>Date Range Queries:</strong> Select any custom "From Date" to "To Date" to audit historical consumption.</li>
                <li><strong>Employee Audit Lookup:</strong> Search by Employee ID or Name to review past attendance and meal claims.</li>
                <li><strong>Export Historical Excel:</strong> Single-click export used by HR and Finance for monthly payroll deductions and contractor billing audits.</li>
              </ul>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web4.png"
                  alt="Previous Day Allocations Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 4.1: Previous Day Allocations Historical Audit (web4.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod5",
      tab: (
        <span>
          <CloudServerOutlined /> 5. Daily Archives
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 05 • Route: #/admin/daily-archive</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Daily Archived Reports & Cloud Storage
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                දෛනික ලේඛනාගාර වාර්තා සහ ක්ලවුඩ් ගබඩාව • தினசரி காப்பக அறிக்கைகள் & கிளவுட் சேமிப்பு
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                Intelligent automated midnight archives combining target day allocations with 2 preceding days into a 3-tab formatted Excel workbook:
              </Paragraph>

              <ul style={{ paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                <li><strong>Firebase Cloud Storage:</strong> Each daily archive is stored securely with cloud-backed download links.</li>
                <li><strong>1:00 AM Auto-Cleanup:</strong> Automatically prunes temporary allocations older than 2 days to maintain top-tier system speed.</li>
                <li><strong>Manual Controls:</strong> <em>"Archive Yesterday's Data"</em> and <em>"Archive Custom Date..."</em> buttons for emergency backups.</li>
              </ul>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web5.png"
                  alt="Daily Archived Reports Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 5.1: Daily Archived Reports Cards & Storage Manager (web5.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod6",
      tab: (
        <span>
          <TeamOutlined /> 6. Employees Directory
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 06 • Route: #/admin/employees</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Master Employees Directory & Bulk Sync
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                සේවක නාමාවලිය සහ එක්සෙල් සමමුහුර්තකරණය • பணியாளர் அடைவு & எக்செல் ஒத்திசைவு
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                Centralized workforce database managing 579+ factory workers, administrative staff, and contractor rosters:
              </Paragraph>

              <ul style={{ paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                <li><strong>Master Fields:</strong> Employee ID, Full Name, Designation, Meal Category, Payment Plan, and Operating Company.</li>
                <li><strong>"Download Template":</strong> Provides standard Excel template for bulk HR roster imports.</li>
                <li><strong>"Import Excel":</strong> Synchronize new workers or department shifts in seconds without manual entry.</li>
                <li><strong>Profile Actions:</strong> In-line <em>Edit</em> and <em>Delete</em> buttons for employee record maintenance.</li>
              </ul>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web6.png"
                  alt="Employees Directory Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 6.1: Master Employees Directory & Bulk Excel Operations (web6.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: "mod7",
      tab: (
        <span>
          <SettingOutlined /> 7. Master Data Settings
        </span>
      ),
      content: (
        <div>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} lg={11}>
              <Tag color="green" style={{ marginBottom: 8 }}>Module 07 • Route: #/admin/settings</Tag>
              <Title level={3} style={{ color: "#065f46", margin: "4px 0 8px" }}>
                Master Data & Subsidy Configuration
              </Title>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                ප්‍රධාන දත්ත සහ සහනාධාර ප්‍රතිපත්ති සැකසුම් • முதன்மை தரவு & மானிய அமைப்புகள்
              </Text>

              <Paragraph style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                Configure meal categories and company subsidy entitlement rules applied during booking:
              </Paragraph>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <Text strong style={{ color: "#0f172a" }}>Policy Matrix:</Text>
                <ul style={{ paddingLeft: 18, marginTop: 4, fontSize: 12.5, color: "#475569" }}>
                  <li><Tag color="green">Worker</Tag> ➔ Full Paid (Plant Operations & Line Staff)</li>
                  <li><Tag color="orange">Staff</Tag> ➔ Half Paid (Office & Administrative Staff)</li>
                  <li><Tag color="green">Executive</Tag> ➔ Full Paid (Senior Management)</li>
                  <li><Tag color="red">Contractor</Tag> ➔ Not Paid (External Third Parties)</li>
                </ul>
              </div>

              <Text style={{ fontSize: 13, color: "#475569" }}>
                Includes <strong>Operating Companies</strong> setup and <strong>Database Tools</strong> for cache invalidation and Firestore health checks.
              </Text>
            </Col>

            <Col xs={24} lg={13}>
              <Card
                bordered
                style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src="/docs/web7.png"
                  alt="Master Data Settings Screen"
                  style={{ borderRadius: 8, width: "100%", display: "block" }}
                />
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  Figure 7.1: Master Data & Category Subsidy Matrix (web7.png)
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "8px 4px" }}>
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
          borderRadius: 14,
          color: "#ffffff",
          marginBottom: 16,
          boxShadow: "0 8px 20px rgba(6, 95, 70, 0.2)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🌿</span>
            <Title level={4} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
              Hayleys Eco Solutions • Meal Management Web Portal
            </Title>
          </div>
          <Text style={{ color: "#d1fae5", fontSize: 12.5 }}>
            User Guide & Operations Manual (පරිශීලක මාර්ගෝපදේශය / பயனர் வழிகாட்டி)
          </Text>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            onClick={handleDownload}
            style={{
              background: "#10b981",
              borderColor: "#10b981",
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)"
            }}
          >
            Download PDF Manual (4 MB)
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={modules.map((m) => ({
          key: m.key,
          label: m.tab,
          children: m.content
        }))}
      />
    </div>
  );
}
