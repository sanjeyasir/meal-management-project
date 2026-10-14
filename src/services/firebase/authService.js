import { signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./config.js";
import { getEmployeeById, seedDefaultEmployees } from "./employeeService.js";
import { getCategoryByName, seedDefaultCategories } from "./categoryService.js";

const SESSION_KEY = "hayleys_meal_session";

// Immediately clear any persistent cache from localStorage to ensure fresh manual login
try {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
} catch (e) {
  // Ignore
}

/**
 * Friendly error message resolver for Firebase Auth
 */
export function getFirebaseErrorMessage(errorCode, defaultMsg) {
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact the administrator.";
    case "auth/too-many-requests":
      return "Too many unsuccessful login attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    default:
      return defaultMsg || "Authentication failed. Please check your credentials.";
  }
}

/**
 * Ensure active Firebase Auth session for Firestore security rules
 */
export async function ensureFirebaseAuth() {
  try {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log("[Firebase Auth] Anonymous authentication session established.");
    }
    return auth.currentUser;
  } catch (err) {
    console.warn("[Firebase Auth] Anonymous sign-in notice:", err.message);
    return auth.currentUser || null;
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
    pay_category: categoryConfig?.configuration_detail || "Full Paid",
    isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || String(employee.employee_id) === "1",
    loginMethod: "FINGERPRINT",
    loginTime: new Date().toISOString()
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch {}
  return sessionData;
}

/**
 * Manual Login (Firebase Auth for Admin, or Staff ID match)
 */
export async function loginManual(username, password) {
  const u = (username || "").trim();
  const p = (password || "").trim();

  if (!u || !p) {
    throw new Error("Please enter both email/username and password.");
  }

  const isEmail = u.includes("@");
  const isAdminAlias = u.toLowerCase() === "admin" || u === "1";

  // 1. If username is an email or admin identifier, authenticate against Firebase Authentication
  if (isEmail || isAdminAlias) {
    const emailToAuth = isEmail ? u.toLowerCase() : "admin@gmail.com";
    try {
      const userCred = await signInWithEmailAndPassword(auth, emailToAuth, p);
      const firebaseUser = userCred.user;

      // Look up employee record
      let employee = await getEmployeeById("admin");
      if (!employee) {
        employee = await getEmployeeById("1");
      }

      const categoryConfig = await getCategoryByName(employee?.category_employment || "Executive");

      const sessionData = {
        uid: firebaseUser.uid,
        employee_id: employee?.employee_id || "admin",
        name: employee?.name || firebaseUser.displayName || "Admin",
        email: firebaseUser.email || emailToAuth,
        designation: employee?.designation || "Administrator",
        company: employee?.company || "Hayleys Eco Solutions",
        category_employment: employee?.category_employment || "Executive",
        category_name: employee?.category_employment || "Executive",
        pay_category: categoryConfig?.configuration_detail || "Full Paid",
        isAdmin: true,
        loginMethod: "FIREBASE_AUTH",
        loginTime: new Date().toISOString()
      };

      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      } catch {}
      return sessionData;
    } catch (fbErr) {
      console.warn("[Firebase Auth] Login error:", fbErr.code, fbErr.message);

      // Support fallback for local dev shortcut if password is admin/admin123
      if (isAdminAlias && (p === "admin" || p === "admin123")) {
        const employee = await getEmployeeById("admin") || await getEmployeeById("1") || {
          employee_id: "admin",
          name: "Admin",
          designation: "Admin",
          company: "Hayleys Eco Solutions",
          category_employment: "Executive"
        };
        const categoryConfig = await getCategoryByName(employee.category_employment || "Executive");
        const sessionData = {
          employee_id: "admin",
          name: employee.name || "Admin",
          email: "admin@gmail.com",
          designation: "Admin",
          company: employee.company || "Hayleys Eco Solutions",
          category_employment: employee.category_employment || "Executive",
          category_name: employee.category_employment || "Executive",
          pay_category: categoryConfig?.configuration_detail || "Full Paid",
          isAdmin: true,
          loginMethod: "CREDENTIALS",
          loginTime: new Date().toISOString()
        };
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        } catch {}
        return sessionData;
      }

      throw new Error(getFirebaseErrorMessage(fbErr.code, fbErr.message));
    }
  }

  // 2. Try employee ID match with default password
  await ensureFirebaseAuth();
  const employee = await getEmployeeById(u);
  if (employee && (p === "123456" || p === "admin123" || p === u)) {
    const categoryConfig = await getCategoryByName(employee.category_employment);
    const sessionData = {
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email || `${employee.employee_id}@hayleys.com`,
      designation: employee.designation,
      company: employee.company || "Hayleys Eco Solutions",
      category_employment: employee.category_employment,
      category_name: employee.category_employment,
      pay_category: categoryConfig?.configuration_detail || "Full Paid",
      isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || employee.employee_id?.toLowerCase() === "admin" || employee.employee_id === "1",
      loginMethod: "CREDENTIALS",
      loginTime: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch {}
    return sessionData;
  }

  throw new Error("Invalid username or password. Use 'admin@gmail.com' and 'admin@123' or a valid Employee ID.");
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
    category_employment: employee.category_employment || "Worker",
    category_name: employee.category_employment || "Worker",
    pay_category: categoryConfig?.configuration_detail || "Full Paid",
    isAdmin: String(employee.designation || "").toLowerCase().includes("admin") || String(employee.employee_id).toLowerCase() === "admin" || String(employee.employee_id) === "1",
    loginMethod: "KIOSK_SELECTION",
    loginTime: new Date().toISOString()
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch {}
  return sessionData;
}

/**
 * Get active session
 */
export function getCurrentUser() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && (session.employee_id === "1" || session.name === "Admin" || session.isAdmin) && session.employee_id === "1") {
      session.employee_id = "admin";
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {}
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Log out
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("[Firebase Auth] Error signing out:", err);
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SESSION_KEY);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

/**
 * Subscribe to Firebase Auth state changes
 */
export function onAuthUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}
