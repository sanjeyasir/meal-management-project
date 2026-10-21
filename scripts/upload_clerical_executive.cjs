const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, writeBatch, collection, getDocs } = require("firebase/firestore");
const ExcelJS = require("exceljs");
const path = require("path");

const firebaseConfig = {
  apiKey: "AIzaSyBMHPcENLLt4uYIjCQIxNWrx339Aksv8Js",
  authDomain: "meal-management-project.firebaseapp.com",
  projectId: "meal-management-project",
  storageBucket: "meal-management-project.firebasestorage.app",
  messagingSenderId: "262120546026",
  appId: "1:262120546026:web:e5119d0a5effc829a74193"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function cleanEpf(raw) {
  if (raw === undefined || raw === null) return "";
  let s = String(raw).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s;
}

function cleanSection(raw) {
  if (!raw) return "General";
  let s = String(raw).trim();
  s = s.replace(/^(Toyo_|Rileys_)/i, "");
  return s.trim() || "General";
}

/**
 * Upload Clerical and Executive employees to Firestore
 * @param {Object} options
 * @param {string} options.clericalCategory - e.g. "Staff" or "Clerical"
 * @param {string} options.clericalPayCategory - e.g. "Half Paid"
 * @param {string} options.execCategory - e.g. "Executive"
 * @param {string} options.execPayCategory - e.g. "Full Paid" or "Half Paid"
 */
async function uploadClericalAndExecutive(options = {}) {
  const {
    clericalCategory = "Staff",
    clericalPayCategory = "Half Paid",
    execCategory = "Executive",
    execPayCategory = "Full Paid"
  } = options;

  console.log("==================================================================");
  console.log("   UPLOADING CLERICAL & EXECUTIVE EMPLOYEES TO FIRESTORE          ");
  console.log("==================================================================");
  console.log("Options:", { clericalCategory, clericalPayCategory, execCategory, execPayCategory });

  console.log("\n1. Authenticating as Admin...");
  const userCred = await signInWithEmailAndPassword(auth, "admin@gmail.com", "admin@123");
  console.log("   ✓ Logged in as:", userCred.user.email);

  console.log("\n2. Reading Clerical_Executive.xlsx...");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve("public", "Clerical_Executive.xlsx"));

  const now = new Date().toISOString();
  const employeeMap = new Map();

  // --- Sheet 0: Clerical List ---
  const cWs = wb.getWorksheet("Clerical List");

  // Clerical Toyo: Cols 1..3, prefix 8
  for (let r = 3; r <= cWs.rowCount; r++) {
    const row = cWs.getRow(r);
    const epf = cleanEpf(row.getCell(1).value);
    const name = String(row.getCell(2).value || "").trim();
    const sec = String(row.getCell(3).value || "").trim();
    if (epf && name) {
      const empId = "8" + epf;
      const parts = name.split(" ").filter(Boolean);
      const firstName = parts[0] || name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;
      const dept = cleanSection(sec);

      employeeMap.set(empId, {
        id: empId,
        employee_id: empId,
        emp_id: empId,
        epf_no: epf,
        name: name,
        full_name: name,
        first_name: firstName,
        last_name: lastName,
        company: "Toyo",
        designation: sec || "Clerical Staff",
        section: sec || "Clerical",
        department: dept || "Operations",
        category_employment: clericalCategory,
        category_name: clericalCategory,
        pay_category: clericalPayCategory,
        employment_type: "Permanent",
        status: "Active",
        is_active: true,
        source_sheet: "Clerical List",
        created_at: now,
        updated_at: now
      });
    }
  }

  // Clerical Rileys: Cols 5..7, prefix 9
  for (let r = 3; r <= cWs.rowCount; r++) {
    const row = cWs.getRow(r);
    const epf = cleanEpf(row.getCell(5).value);
    const name = String(row.getCell(6).value || "").trim();
    const sec = String(row.getCell(7).value || "").trim();
    if (epf && name) {
      const empId = "9" + epf;
      const parts = name.split(" ").filter(Boolean);
      const firstName = parts[0] || name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;
      const dept = cleanSection(sec);

      employeeMap.set(empId, {
        id: empId,
        employee_id: empId,
        emp_id: empId,
        epf_no: epf,
        name: name,
        full_name: name,
        first_name: firstName,
        last_name: lastName,
        company: "Rileys",
        designation: sec || "Clerical Staff",
        section: sec || "Clerical",
        department: dept || "Operations",
        category_employment: clericalCategory,
        category_name: clericalCategory,
        pay_category: clericalPayCategory,
        employment_type: "Permanent",
        status: "Active",
        is_active: true,
        source_sheet: "Clerical List",
        created_at: now,
        updated_at: now
      });
    }
  }

  // --- Sheet 1: Executive List ---
  const eWs = wb.getWorksheet("Executive List");

  // Executive Rileys: Cols 1..3, prefix 9
  for (let r = 3; r <= eWs.rowCount; r++) {
    const row = eWs.getRow(r);
    const epf = cleanEpf(row.getCell(1).value);
    const name = String(row.getCell(2).value || "").trim();
    const sec = String(row.getCell(3).value || "").trim();
    if (epf && name) {
      const empId = "9" + epf;
      const parts = name.split(" ").filter(Boolean);
      const firstName = parts[0] || name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;
      const dept = cleanSection(sec);

      employeeMap.set(empId, {
        id: empId,
        employee_id: empId,
        emp_id: empId,
        epf_no: epf,
        name: name,
        full_name: name,
        first_name: firstName,
        last_name: lastName,
        company: "Rileys",
        designation: dept ? `Executive - ${dept}` : "Executive",
        section: sec || dept,
        department: dept || "Management",
        category_employment: execCategory,
        category_name: execCategory,
        pay_category: execPayCategory,
        employment_type: "Executive",
        status: "Active",
        is_active: true,
        source_sheet: "Executive List",
        created_at: now,
        updated_at: now
      });
    }
  }

  // Executive Toyo: Cols 6..8, prefix 8
  for (let r = 3; r <= eWs.rowCount; r++) {
    const row = eWs.getRow(r);
    const epf = cleanEpf(row.getCell(6).value);
    const name = String(row.getCell(7).value || "").trim();
    const sec = String(row.getCell(8).value || "").trim();
    if (epf && name) {
      const empId = "8" + epf;
      const parts = name.split(" ").filter(Boolean);
      const firstName = parts[0] || name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;
      const dept = cleanSection(sec);

      employeeMap.set(empId, {
        id: empId,
        employee_id: empId,
        emp_id: empId,
        epf_no: epf,
        name: name,
        full_name: name,
        first_name: firstName,
        last_name: lastName,
        company: "Toyo",
        designation: dept ? `Executive - ${dept}` : "Executive",
        section: sec || dept,
        department: dept || "Management",
        category_employment: execCategory,
        category_name: execCategory,
        pay_category: execPayCategory,
        employment_type: "Executive",
        status: "Active",
        is_active: true,
        source_sheet: "Executive List",
        created_at: now,
        updated_at: now
      });
    }
  }

  const employeeList = Array.from(employeeMap.values());
  console.log(`\n3. Prepared ${employeeList.length} employee records.`);

  const BATCH_SIZE = 250;
  let uploaded = 0;

  for (let i = 0; i < employeeList.length; i += BATCH_SIZE) {
    const chunk = employeeList.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const emp of chunk) {
      const docRef = doc(db, "employees", emp.employee_id);
      batch.set(docRef, emp, { merge: true });
    }

    await batch.commit();
    uploaded += chunk.length;
    console.log(`   ✓ Committed batch: ${uploaded} / ${employeeList.length} employees uploaded.`);
  }

  console.log("\n4. Verifying total employees in Firestore...");
  const totalSnap = await getDocs(collection(db, "employees"));
  console.log(`   ✓ Total employees in Firestore now: ${totalSnap.size}`);

  console.log("\nSUCCESS: Clerical & Executive employees successfully uploaded!");
  return { uploaded: employeeList.length, totalInDb: totalSnap.size };
}

// Check CLI arguments if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    const [k, v] = arg.split("=");
    if (k && v) options[k.replace(/^--/, "")] = v;
  }

  uploadClericalAndExecutive(options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error("FATAL ERROR uploading employees:", err);
      process.exit(1);
    });
}

module.exports = { uploadClericalAndExecutive };
