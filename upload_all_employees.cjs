const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, writeBatch, collection, getDocs } = require("firebase/firestore");
const XLSX = require("xlsx");
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

async function uploadEmployees() {
  console.log("1. Authenticating as Admin...");
  const userCred = await signInWithEmailAndPassword(auth, "admin@gmail.com", "admin@123");
  console.log("   Logged in as:", userCred.user.email);

  console.log("2. Ensuring Rileys & Toyo in 'companies' collection...");
  const companiesToEnsure = [
    { id: "comp_rileys", company_code: "RIL", name: "Rileys", description: "Rileys Plant" },
    { id: "comp_toyo", company_code: "TOY", name: "Toyo", description: "Toyo Plant" }
  ];
  const compBatch = writeBatch(db);
  const now = new Date().toISOString();
  for (const c of companiesToEnsure) {
    compBatch.set(doc(db, "companies", c.id), { ...c, updated_at: now, created_at: now }, { merge: true });
  }
  await compBatch.commit();
  console.log("   Companies registered successfully.");

  console.log("3. Reading Excel file...");
  const filePath = path.resolve(__dirname, "public", "All employee list.xlsx");
  const wb = XLSX.readFile(filePath);

  const employeeMap = new Map();
  const stats = { Rileys: { perm: 0, man: 0 }, Toyo: { perm: 0, man: 0 } };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      if (row.includes("EPF") || row.includes("Name")) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      console.warn("Could not find header row in sheet:", sheetName);
      continue;
    }

    const isRileys = sheetName.toLowerCase().includes("riley");
    const prefix = isRileys ? "9" : "8";
    const company = isRileys ? "Rileys" : "Toyo";

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];

      // Permanent Employee (Columns 0..3)
      const pName = r[1];
      const pEpf = cleanEpf(r[2]);
      if (pName && pEpf) {
        const empId = prefix + pEpf;
        const fullName = String(pName).trim();
        const parts = fullName.split(" ").filter(Boolean);
        const firstName = parts[0] || fullName;
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;

        employeeMap.set(empId, {
          id: empId,
          employee_id: empId,
          emp_id: empId,
          epf_no: pEpf,
          name: fullName,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          company: company,
          category_employment: "Staff",
          category_name: "Staff",
          pay_category: "Half Paid",
          employment_type: "Permanent",
          contractor: "",
          designation: "Staff",
          status: "Active",
          is_active: true,
          updated_at: now,
          created_at: now
        });
        stats[company].perm++;
      }

      // Manpower Employee (Columns 5..9)
      const mName = r[6];
      const mEpf = cleanEpf(r[7]);
      const mCont = r[8] ? String(r[8]).trim() : "";
      if (mName && mEpf) {
        const empId = prefix + mEpf;
        const fullName = String(mName).trim();
        const parts = fullName.split(" ").filter(Boolean);
        const firstName = parts[0] || fullName;
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : empId;

        employeeMap.set(empId, {
          id: empId,
          employee_id: empId,
          emp_id: empId,
          epf_no: mEpf,
          name: fullName,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          company: company,
          category_employment: "Staff",
          category_name: "Staff",
          pay_category: "Half Paid",
          employment_type: "Manpower",
          contractor: mCont,
          designation: "Manpower Worker",
          status: "Active",
          is_active: true,
          updated_at: now,
          created_at: now
        });
        stats[company].man++;
      }
    }
  }

  const employeeList = Array.from(employeeMap.values());
  console.log(`4. Prepared ${employeeList.length} employees to upload.`);
  console.log("   Stats:", stats);

  console.log("5. Uploading in batches to Firestore 'employees' collection...");
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
    console.log(`   Uploaded ${uploaded} / ${employeeList.length} employees...`);
  }

  console.log("6. Verifying upload in Firestore...");
  const verifySnap = await getDocs(collection(db, "employees"));
  console.log(`   Total employees now in Firestore: ${verifySnap.size}`);

  console.log("SUCCESS: All employees successfully uploaded!");
}

uploadEmployees().catch(err => {
  console.error("FATAL ERROR uploading employees:", err);
  process.exit(1);
});
