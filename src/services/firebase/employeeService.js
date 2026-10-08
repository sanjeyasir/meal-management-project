import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "./config";
import { seedDefaultCategories, getCategoryByName, normalizePaymentType } from "./categoryService";

const COLLECTION_NAME = "employees";

export const DEFAULT_EMPLOYEES = [
  {
    employee_id: "EMP001",
    name: "Sanjey Asirvatham",
    designation: "Quality Assurance Lead",
    company: "Hayleys Eco Solutions",
    category_employment: "Staff",
    pay_category: "Half Paid",
    status: "Active"
  },
  {
    employee_id: "EMP002",
    name: "Kasun Perera",
    designation: "Production Supervisor",
    company: "Hayleys Fibre Plant 1",
    category_employment: "Worker",
    pay_category: "Full Paid",
    status: "Active"
  },
  {
    employee_id: "EMP003",
    name: "Nirosha Jayawardena",
    designation: "Plant General Manager",
    company: "Hayleys Eco Solutions",
    category_employment: "Executive",
    pay_category: "Full Paid",
    status: "Active"
  },
  {
    employee_id: "EMP004",
    name: "Mohamed Rizwan",
    designation: "Maintenance Technician",
    company: "Hayleys Fibre Plant 1",
    category_employment: "Worker",
    pay_category: "Full Paid",
    status: "Active"
  },
  {
    employee_id: "EMP005",
    name: "Dinesh Fernando",
    designation: "Logistics Officer",
    company: "Hayleys Eco Solutions",
    category_employment: "Staff",
    pay_category: "Half Paid",
    status: "Active"
  },
  {
    employee_id: "admin",
    name: "Admin",
    designation: "Admin",
    company: "Hayleys Eco Solutions",
    category_employment: "Executive",
    pay_category: "Full Paid",
    status: "Active"
  }
];

/**
 * Seed initial employees if collection is empty
 */
export async function seedDefaultEmployees() {
  try {
    await seedDefaultCategories();
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log("Seeding default employees to Firestore...");
      for (const emp of DEFAULT_EMPLOYEES) {
        await setDoc(doc(db, COLLECTION_NAME, emp.employee_id), {
          ...emp,
          created_at: new Date().toISOString()
        });
      }
      return DEFAULT_EMPLOYEES;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error seeding employees:", error);
    return DEFAULT_EMPLOYEES;
  }
}

/**
 * Fetch employee by Employee ID (e.g. EMP001, 1, or string)
 */
export async function getEmployeeById(employeeId) {
  try {
    if (!employeeId) return null;
    const cleanId = String(employeeId).trim();

    // 1. Direct doc lookup
    const docRef = doc(db, COLLECTION_NAME, cleanId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }

    // 2. Query where employee_id == cleanId
    const q = query(collection(db, COLLECTION_NAME), where("employee_id", "==", cleanId));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const match = querySnap.docs[0];
      return { id: match.id, ...match.data() };
    }

    // 3. Fallback search against defaults if initial db empty
    const defaults = await seedDefaultEmployees();
    const found = defaults.find(e => String(e.employee_id).toLowerCase() === cleanId.toLowerCase());
    return found || null;
  } catch (error) {
    console.error("Error finding employee:", error);
    const found = DEFAULT_EMPLOYEES.find(e => String(e.employee_id).toLowerCase() === String(employeeId).toLowerCase());
    return found || null;
  }
}

/**
 * Check if an Employee ID is unique in Firestore
 * @param {string} employeeId The new or updated employee ID to test
 * @param {string} originalEmployeeId The original employee ID (if updating existing record)
 * @returns {Promise<boolean>} True if ID is unique and available, False if already exists
 */
export async function isEmployeeIdUnique(employeeId, originalEmployeeId = null) {
  if (!employeeId) return false;
  const cleanId = String(employeeId).trim();
  const cleanOriginal = originalEmployeeId ? String(originalEmployeeId).trim() : null;

  // If updating and the ID didn't change, it's valid
  if (cleanOriginal && cleanId.toLowerCase() === cleanOriginal.toLowerCase()) {
    return true;
  }

  try {
    // 1. Check direct doc existence
    const docRef = doc(db, COLLECTION_NAME, cleanId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // If doc exists and is not the current employee being edited
      if (!cleanOriginal || docSnap.id.toLowerCase() !== cleanOriginal.toLowerCase()) {
        return false;
      }
    }

    // 2. Query by employee_id field (case-insensitive or exact match)
    const q = query(collection(db, COLLECTION_NAME), where("employee_id", "==", cleanId));
    const querySnap = await getDocs(q);
    const duplicates = querySnap.docs.filter(
      (d) => !cleanOriginal || d.id.toLowerCase() !== cleanOriginal.toLowerCase()
    );

    if (duplicates.length > 0) {
      return false;
    }

    return true;
  } catch (err) {
    console.warn("isEmployeeIdUnique check warning:", err);
    return true;
  }
}

/**
 * Get all employees with full field normalization
 */
export async function getEmployees() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (snapshot.empty) {
      return await seedDefaultEmployees();
    }
    return snapshot.docs.map(d => {
      const data = d.data() || {};
      const empId = String(data.employee_id || data.emp_id || data.id || d.id || "").trim();
      const fullName = String(data.name || data.full_name || `${data.first_name || ""} ${data.last_name || ""}`.trim() || `Employee ${empId}`).trim();
      const firstName = data.first_name || (fullName ? fullName.split(" ")[0] : "Employee");
      const lastName = data.last_name || (fullName && fullName.split(" ").length > 1 ? fullName.split(" ").slice(1).join(" ") : empId);
      const section = data.section || data.department || "Operations";
      const department = data.department || data.section || "Operations";
      const category = data.category_employment || data.pay_category || "Staff";
      const status = data.status || (data.is_active !== false ? "Active" : "Inactive");

      return {
        id: d.id,
        doc_id: d.id,
        ...data,
        employee_id: empId,
        emp_id: empId,
        name: fullName,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        section,
        department,
        category_employment: category,
        pay_category: category,
        status,
        is_active: status === "Active"
      };
    });
  } catch (error) {
    console.error("Error getting employees:", error);
    return DEFAULT_EMPLOYEES;
  }
}

/**
 * Subscribe to employees collection
 */
export function subscribeEmployees(callback) {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      seedDefaultEmployees().then(callback);
    } else {
      const data = snapshot.docs.map(d => {
        const row = d.data() || {};
        const empId = String(row.employee_id || row.emp_id || d.id || "").trim();
        return {
          id: d.id,
          doc_id: d.id,
          ...row,
          employee_id: empId,
          emp_id: empId,
          name: row.name || row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim() || `Employee ${empId}`
        };
      });
      callback(data);
    }
  }, (err) => {
    console.error("Employee subscription error:", err);
    callback(DEFAULT_EMPLOYEES);
  });
}

/**
 * Create or update employee record
 * @param {Object} employee Employee data to save
 * @param {string} originalEmployeeId Original employee ID if updating an existing record
 */
export async function saveEmployee(employee, originalEmployeeId = null) {
  const resolvedId = String(employee.employee_id || employee.emp_id || employee.id || "").trim();
  if (!resolvedId || resolvedId === "undefined" || resolvedId === "null") {
    throw new Error("Employee ID is required and cannot be empty.");
  }

  const cleanId = resolvedId;
  const cleanOriginal = originalEmployeeId ? String(originalEmployeeId).trim() : null;

  // Uniqueness validation
  const isUnique = await isEmployeeIdUnique(cleanId, cleanOriginal);
  if (!isUnique) {
    throw new Error(`Employee ID '${cleanId}' is already registered in the system. Please specify a unique Employee ID.`);
  }

  const fullName = String(employee.name || employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Employee ${cleanId}`).trim();
  const firstName = employee.first_name || (fullName ? fullName.split(" ")[0] : "Employee");
  const lastName = employee.last_name || (fullName && fullName.split(" ").length > 1 ? fullName.split(" ").slice(1).join(" ") : cleanId);

  const resolvedCatName = String(employee.category_employment || employee.category_name || employee.pay_category || "Staff").trim();
  const categoryConfig = await getCategoryByName(resolvedCatName);
  const resolvedSubsidy = categoryConfig?.configuration_detail
    ? normalizePaymentType(categoryConfig.configuration_detail)
    : normalizePaymentType(employee.pay_category || "Full Paid");

  const payload = {
    ...employee,
    id: cleanId,
    employee_id: cleanId,
    emp_id: cleanId,
    name: fullName,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    designation: employee.designation?.trim() || "Staff",
    company: employee.company?.trim() || "Hayleys Eco Solutions",
    category_employment: resolvedCatName,
    category_name: resolvedCatName,
    pay_category: resolvedSubsidy,
    status: "Active",
    is_active: true,
    updated_at: new Date().toISOString()
  };

  // If this is an update where the employee_id itself was changed
  if (cleanOriginal && cleanOriginal !== cleanId) {
    console.log(`[EmployeeService] Updating employee ID from ${cleanOriginal} -> ${cleanId}`);

    // 1. Create new doc with new ID
    const newDocRef = doc(db, COLLECTION_NAME, cleanId);
    await setDoc(newDocRef, {
      ...payload,
      created_at: employee.created_at || new Date().toISOString()
    });

    // 2. Delete old doc with old ID
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, cleanOriginal));
    } catch (e) {
      console.warn("Delete old doc error:", e);
    }

    // 3. Cascade update existing meal allocations to the new employee ID
    try {
      const allocQuery = query(collection(db, "meal_allocations"), where("employee_id", "==", cleanOriginal));
      const allocSnap = await getDocs(allocQuery);
      if (!allocSnap.empty) {
        const batch = writeBatch(db);
        allocSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            employee_id: cleanId,
            emp_id: cleanId,
            employee_name: payload.name,
            name: payload.name,
            current_designation: payload.designation,
            company: payload.company,
            section: payload.section,
            department: payload.department,
            category_name: payload.category_employment,
            category_employment: payload.category_employment,
            pay_category: payload.pay_category,
            updated_at: new Date().toISOString()
          });
        });
        await batch.commit();
      }
    } catch (allocErr) {
      console.warn("Notice: Failed cascading update to meal allocations:", allocErr);
    }
  } else {
    // Normal create or in-place update
    const docRef = doc(db, COLLECTION_NAME, cleanId);
    await setDoc(docRef, payload, { merge: true });

    // Cascade update allocations for this employee to keep category/subsidy fresh
    try {
      const allocQuery = query(collection(db, "meal_allocations"), where("employee_id", "==", cleanId));
      const allocSnap = await getDocs(allocQuery);
      if (!allocSnap.empty) {
        const batch = writeBatch(db);
        allocSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            employee_name: payload.name,
            name: payload.name,
            section: payload.section,
            department: payload.department,
            category_name: payload.category_employment,
            category_employment: payload.category_employment,
            pay_category: payload.pay_category,
            updated_at: new Date().toISOString()
          });
        });
        await batch.commit();
      }
    } catch (allocErr) {
      console.warn("Notice: Failed cascading allocation update:", allocErr);
    }
  }

  return { id: cleanId, ...payload };
}

/**
 * Delete employee record cleanly by Doc ID, employee_id, or emp_id
 */
export async function deleteEmployee(idOrEmpId) {
  if (idOrEmpId === null || idOrEmpId === undefined) return false;
  const cleanId = String(idOrEmpId).trim();
  if (!cleanId) return false;

  // 1. Try direct doc delete
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, cleanId));
  } catch (err) {
    console.warn("Direct doc delete notice:", err);
  }

  // 2. Query delete by employee_id
  try {
    const q1 = query(collection(db, COLLECTION_NAME), where("employee_id", "==", cleanId));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn("Query delete employee_id notice:", err);
  }

  // 3. Query delete by emp_id
  try {
    const q2 = query(collection(db, COLLECTION_NAME), where("emp_id", "==", cleanId));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn("Query delete emp_id notice:", err);
  }

  return true;
}

