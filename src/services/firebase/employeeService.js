import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./config";
import { seedDefaultCategories } from "./categoryService";

const COLLECTION_NAME = "employees";

export const DEFAULT_EMPLOYEES = [
  {
    employee_id: "EMP001",
    name: "Sanjey Asirvatham",
    designation: "Quality Assurance Lead",
    company: "Hayleys Eco Solutions",
    section: "Quality Management",
    category_employment: "Staff",
    email: "sanjey.a@hayleys.com",
    phone: "+94 77 123 4567",
    status: "Active"
  },
  {
    employee_id: "EMP002",
    name: "Kasun Perera",
    designation: "Production Supervisor",
    company: "Hayleys Fibre Plant 1",
    section: "Manufacturing Line A",
    category_employment: "Worker",
    email: "kasun.p@hayleys.com",
    phone: "+94 77 234 5678",
    status: "Active"
  },
  {
    employee_id: "EMP003",
    name: "Nirosha Jayawardena",
    designation: "Plant General Manager",
    company: "Hayleys Eco Solutions",
    section: "Executive Management",
    category_employment: "Executive",
    email: "nirosha.j@hayleys.com",
    phone: "+94 77 345 6789",
    status: "Active"
  },
  {
    employee_id: "EMP004",
    name: "Mohamed Rizwan",
    designation: "Maintenance Technician",
    company: "Hayleys Fibre Plant 2",
    section: "Engineering & Maintenance",
    category_employment: "Worker",
    email: "rizwan.m@hayleys.com",
    phone: "+94 77 456 7890",
    status: "Active"
  },
  {
    employee_id: "EMP005",
    name: "Dinesh Fernando",
    designation: "Logistics Officer",
    company: "Hayleys Eco Solutions",
    section: "Supply Chain & Dispatch",
    category_employment: "Staff",
    email: "dinesh.f@hayleys.com",
    phone: "+94 77 567 8901",
    status: "Active"
  },
  {
    employee_id: "1",
    name: "Admin",
    designation: "Admin",
    company: "Hayleys Eco Solutions",
    section: "Administration",
    category_employment: "Executive",
    email: "admin@hayleys.com",
    phone: "+94 11 234 5678",
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
    // Fallback search
    const found = DEFAULT_EMPLOYEES.find(e => String(e.employee_id).toLowerCase() === String(employeeId).toLowerCase());
    return found || null;
  }
}

/**
 * Get all employees
 */
export async function getEmployees() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (snapshot.empty) {
      return await seedDefaultEmployees();
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    }
  }, (err) => {
    console.error("Employee subscription error:", err);
    callback(DEFAULT_EMPLOYEES);
  });
}

/**
 * Create or update employee
 */
export async function saveEmployee(employee) {
  const id = employee.employee_id || employee.id || `EMP_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = {
    ...employee,
    employee_id: id,
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, payload, { merge: true });
  return { id, ...payload };
}

/**
 * Delete employee
 */
export async function deleteEmployee(employeeId) {
  await deleteDoc(doc(db, COLLECTION_NAME, employeeId));
  return true;
}
