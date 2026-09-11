import { signInAnonymously } from "firebase/auth";
import { auth } from "./config";
import { getEmployeeById, seedDefaultEmployees } from "./employeeService";
import { getCategoryByName, seedDefaultCategories } from "./categoryService";

const SESSION_KEY = "hayleys_meal_session";

/**
 * Ensure active Firebase Auth session for Firestore security rules
 */
export async function ensureFirebaseAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log("[Firebase Auth] Anonymous authentication session established.");
    }
    return auth.currentUser;
  } catch (err) {
    console.warn("[Firebase Auth] Anonymous sign-in notice:", err.message);
    return null;
  }
}

/**
 * Seed all initial data on first launch
 */
export async function seedAllInitialData() {
  try {
    await ensureFirebaseAuth();
    await seedDefaultCategories();
    await seedDefaultEmployees();
    return true;
  } catch (err) {
    console.error("Error during initial data seeding:", err);
    return false;
  }
}

/**
 * Parse raw fingerprint scanner payload
 * Supports tab-separated format: "emp_id\tname\tdesignation" or JSON string
 */
export function parseFingerprintPayload(rawPayload) {
  if (!rawPayload) return null;
  
  if (typeof rawPayload === "object") {
    return {
      emp_id: rawPayload.emp_id || rawPayload.employee_id || rawPayload.id,
      name: rawPayload.name || rawPayload.employee_name,
      designation: rawPayload.designation || rawPayload.role
    };
  }

  const str = String(rawPayload).trim();
  
  // Try JSON parse
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      const obj = JSON.parse(str);
      return {
        emp_id: obj.emp_id || obj.employee_id || obj.id,
        name: obj.name || obj.employee_name,
        designation: obj.designation || obj.role
      };
    } catch {
      // Fall through to tab/delimiter split
    }
  }

  // Handle escaped \t or real tab
  const cleaned = str.replace(/\\t/g, "\t");
  const parts = cleaned.split("\t");

  if (parts.length >= 1 && parts[0]) {
    return {
      emp_id: parts[0]?.trim(),
      name: parts[1]?.trim() || "",
      designation: parts[2]?.trim() || ""
    };
  }

  return { emp_id: str, name: "", designation: "" };
}

/**
 * Authenticate via Biometric Fingerprint Data
 */
export async function loginWithBiometric(rawPayload) {
  await ensureFirebaseAuth();

  const parsed = parseFingerprintPayload(rawPayload);
  if (!parsed || !parsed.emp_id) {
    throw new Error("Invalid or empty fingerprint payload received.");
  }

  // Look up employee in Firestore
  const employee = await getEmployeeById(parsed.emp_id);
  if (!employee) {
    throw new Error(`Unknown employee ID: "${parsed.emp_id}". Please contact HR.`);
  }

  // Resolve payment category
  const categoryConfig = await getCategoryByName(employee.category_employment || "Worker");

  const sessionData = {
    employee_id: employee.employee_id,
    name: employee.name || parsed.name,
    designation: employee.designation || parsed.designation,
    company: employee.company || "Hayleys Eco Solutions",
    section: employee.section || "Operations",
    category_employment: employee.category_employment || "Worker",
    category_name: employee.category_employment || "Worker",
    pay_category: categoryConfig?.configuration_detail || "Free Meal",
    isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || String(employee.employee_id) === "1",
    loginMethod: "FINGERPRINT",
    loginTime: new Date().toISOString()
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

/**
 * Manual Login (Admin or Staff)
 */
export async function loginManual(username, password) {
  await ensureFirebaseAuth();

  const u = (username || "").trim();
  const p = (password || "").trim();

  // Admin shortcut support (like Python app)
  if ((u === "admin" && (p === "admin" || p === "admin123")) || (u === "1" && p === "admin")) {
    const employee = await getEmployeeById("1") || {
      employee_id: "1",
      name: "Admin",
      designation: "Admin",
      company: "Hayleys Eco Solutions",
      section: "Administration",
      category_employment: "Executive"
    };

    const categoryConfig = await getCategoryByName(employee.category_employment);

    const sessionData = {
      employee_id: "1",
      name: employee.name || "System Admin",
      designation: "Admin",
      company: employee.company || "Hayleys Eco Solutions",
      section: employee.section || "Administration",
      category_employment: employee.category_employment || "Executive",
      category_name: employee.category_employment || "Executive",
      pay_category: categoryConfig?.configuration_detail || "Free Meal",
      isAdmin: true,
      loginMethod: "CREDENTIALS",
      loginTime: new Date().toISOString()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  }

  // Try employee ID match with default password
  const employee = await getEmployeeById(u);
  if (employee && (p === "123456" || p === "admin123" || p === u)) {
    const categoryConfig = await getCategoryByName(employee.category_employment);
    const sessionData = {
      employee_id: employee.employee_id,
      name: employee.name,
      designation: employee.designation,
      company: employee.company || "Hayleys Eco Solutions",
      section: employee.section || "Operations",
      category_employment: employee.category_employment,
      category_name: employee.category_employment,
      pay_category: categoryConfig?.configuration_detail || "Free Meal",
      isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || employee.employee_id === "1",
      loginMethod: "CREDENTIALS",
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  }

  throw new Error("Invalid username or password. Use 'admin' / 'admin123' or a valid Employee ID.");
}

/**
 * Set active employee session directly from Kiosk selection (Autocomplete or quick scan)
 */
export async function selectEmployeeSession(employee) {
  if (!employee) return null;
  await ensureFirebaseAuth();

  const categoryConfig = await getCategoryByName(employee.category_employment || "Worker");

  const sessionData = {
    employee_id: employee.employee_id,
    name: employee.name,
    designation: employee.designation || "Staff",
    company: employee.company || "Hayleys Eco Solutions",
    section: employee.section || "Operations",
    category_employment: employee.category_employment || "Worker",
    category_name: employee.category_employment || "Worker",
    pay_category: categoryConfig?.configuration_detail || "Free Meal",
    isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || String(employee.employee_id) === "1",
    loginMethod: "KIOSK_SELECTION",
    loginTime: new Date().toISOString()
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

/**
 * Get active session
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Log out
 */
export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

