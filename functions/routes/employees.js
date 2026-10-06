const { Router } = require("express");
const { db } = require("../config/firebaseAdmin.js");

const router = Router();
const EMP_COLLECTION = "employees";

/**
 * Normalizes employee data across all schema variations (emp_id, employee_id, name, first_name, last_name, etc.)
 */
function normalizeEmployee(docId, docData = {}) {
  const resolvedId = String(
    docData.emp_id ||
    docData.employee_id ||
    docData.id ||
    docId ||
    ""
  ).trim();

  let fullName = String(docData.name || docData.full_name || "").trim();
  let firstName = String(docData.first_name || "").trim();
  let lastName = String(docData.last_name || "").trim();

  if (!fullName) {
    fullName = `${firstName} ${lastName}`.trim() || `Employee ${resolvedId}`;
  }

  if (!firstName) {
    const parts = fullName.split(" ");
    firstName = parts[0] || "Employee";
    if (!lastName && parts.length > 1) {
      lastName = parts.slice(1).join(" ");
    }
  }

  if (!lastName) {
    lastName = fullName !== firstName ? fullName.replace(firstName, "").trim() : (resolvedId || "User");
  }

  const department = docData.department || docData.section || docData.designation || "Operations";
  const section = docData.section || docData.department || "Operations";
  const designation = docData.designation || docData.role || "Staff";
  const payCategory = docData.pay_category || docData.category_employment || "Factory Daily Paid";
  const categoryEmployment = docData.category_employment || docData.pay_category || "Staff";
  const company = docData.company || "Hayleys Eco Solutions";
  const mealPreference = docData.meal_preference || "Standard";

  const isActive = docData.is_active !== undefined
    ? Boolean(docData.is_active)
    : (docData.status ? String(docData.status).toLowerCase() === "active" : true);

  return {
    ...docData,
    id: docId || resolvedId,
    emp_id: resolvedId,
    employee_id: resolvedId,
    name: fullName,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    department: department,
    section: section,
    designation: designation,
    pay_category: payCategory,
    category_employment: categoryEmployment,
    company: company,
    meal_preference: mealPreference,
    is_active: isActive,
    status: isActive ? "Active" : "Inactive"
  };
}

/**
 * Finds employee document by Doc ID, emp_id, employee_id (string or integer)
 */
async function findEmployeeDoc(lookupKey) {
  if (!lookupKey || lookupKey === "None" || lookupKey === "null") return null;

  const keyStr = String(lookupKey).trim();

  // 1. Direct Doc ID match
  let empDoc = await db.collection(EMP_COLLECTION).doc(keyStr).get();
  if (empDoc.exists) return empDoc;

  // 2. Query where emp_id == keyStr
  let snap = await db.collection(EMP_COLLECTION).where("emp_id", "==", keyStr).limit(1).get();
  if (!snap.empty) return snap.docs[0];

  // 3. Query where employee_id == keyStr
  snap = await db.collection(EMP_COLLECTION).where("employee_id", "==", keyStr).limit(1).get();
  if (!snap.empty) return snap.docs[0];

  // 4. Query numeric if valid number
  if (!isNaN(keyStr)) {
    const numKey = Number(keyStr);
    snap = await db.collection(EMP_COLLECTION).where("emp_id", "==", numKey).limit(1).get();
    if (!snap.empty) return snap.docs[0];

    snap = await db.collection(EMP_COLLECTION).where("employee_id", "==", numKey).limit(1).get();
    if (!snap.empty) return snap.docs[0];

    // Strip leading zeroes if any (e.g. 0641 -> 641)
    const strippedStr = String(numKey);
    if (strippedStr !== keyStr) {
      empDoc = await db.collection(EMP_COLLECTION).doc(strippedStr).get();
      if (empDoc.exists) return empDoc;

      snap = await db.collection(EMP_COLLECTION).where("emp_id", "==", strippedStr).limit(1).get();
      if (!snap.empty) return snap.docs[0];

      snap = await db.collection(EMP_COLLECTION).where("employee_id", "==", strippedStr).limit(1).get();
      if (!snap.empty) return snap.docs[0];
    }
  }

  return null;
}

// 1. List employees
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const snapshot = await db.collection(EMP_COLLECTION).limit(limit).get();

    const employees = [];
    snapshot.forEach(doc => {
      employees.push(normalizeEmployee(doc.id, doc.data()));
    });

    return res.json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get employee by ID
router.get("/:id", async (req, res) => {
  try {
    const lookupKey = String(req.params.id).trim();
    const empDoc = await findEmployeeDoc(lookupKey);

    if (!empDoc || !empDoc.exists) {
      return res.status(404).json({ success: false, message: `Employee '${lookupKey}' not found.` });
    }

    const employee = normalizeEmployee(empDoc.id, empDoc.data());
    return res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Verify employee for Kiosk Login
router.post("/verify", async (req, res) => {
  try {
    const { empId, pin, id, employeeId, employee_id } = req.body;
    const lookupKey = String(empId || pin || id || employeeId || employee_id || "").trim();

    if (!lookupKey || lookupKey === "None" || lookupKey === "null") {
      return res.status(400).json({ success: false, message: "Missing empId or pin" });
    }

    const empDoc = await findEmployeeDoc(lookupKey);

    if (!empDoc || !empDoc.exists) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: `Employee '${lookupKey}' is not registered.`
      });
    }

    const employee = normalizeEmployee(empDoc.id, empDoc.data());

    return res.json({
      success: true,
      verified: true,
      message: `Employee ${employee.name || (employee.first_name + ' ' + employee.last_name)} verified.`,
      employee
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Register or Update Employee
router.post("/", async (req, res) => {
  try {
    const {
      emp_id,
      employee_id,
      id,
      name,
      first_name,
      last_name,
      company = "Hayleys Eco Solutions",
      department = "Operations",
      section = "Operations",
      designation = "Staff",
      pay_category = "Factory Daily Paid",
      category_employment = "Staff",
      meal_preference = "Standard",
      is_active = true
    } = req.body;

    const docId = String(emp_id || employee_id || id || "").trim();
    if (!docId || docId === "None") {
      return res.status(400).json({ success: false, message: "emp_id is required" });
    }

    const docRef = db.collection(EMP_COLLECTION).doc(docId);

    const employeeData = {
      emp_id: docId,
      employee_id: docId,
      name: name || `${first_name || 'Employee'} ${last_name || docId}`.trim(),
      first_name: first_name || (name ? name.split(" ")[0] : "Employee"),
      last_name: last_name || (name && name.split(" ").length > 1 ? name.split(" ").slice(1).join(" ") : docId),
      company,
      department,
      section,
      designation,
      pay_category,
      category_employment,
      meal_preference,
      is_active: is_active !== false,
      status: is_active !== false ? "Active" : "Inactive",
      updated_at: new Date().toISOString()
    };

    await docRef.set(employeeData, { merge: true });

    return res.json({
      success: true,
      message: `Employee ${docId} saved.`,
      data: employeeData
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

