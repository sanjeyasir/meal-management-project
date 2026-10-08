import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "employee_categories";

export const ALLOWED_PAYMENT_TYPES = ["Half Paid", "Full Paid", "Not Paid"];

export function normalizePaymentType(type) {
  if (!type) return "Full Paid";
  const lower = String(type).trim().toLowerCase();
  if (lower.includes("half") || lower.includes("50%")) return "Half Paid";
  if (lower.includes("not") || lower.includes("unpaid") || lower.includes("none") || lower === "contractor") return "Not Paid";
  if (lower.includes("full") || lower.includes("free") || lower.includes("100%")) return "Full Paid";
  return "Full Paid";
}

export const DEFAULT_CATEGORIES = [
  { id: "cat_exec", category_name: "Executive", configuration_detail: "Full Paid", description: "Senior Management & Executives" },
  { id: "cat_staff", category_name: "Staff", configuration_detail: "Half Paid", description: "Office & Administrative Staff" },
  { id: "cat_worker", category_name: "Worker", configuration_detail: "Full Paid", description: "Plant Operations & Line Staff" },
  { id: "cat_contract", category_name: "Contractor", configuration_detail: "Not Paid", description: "Third Party & External Contractors" },
  { id: "cat_visitor", category_name: "Visitor", configuration_detail: "Full Paid", description: "Official Guests & Auditors" }
];

/**
 * Seed initial categories if collection is empty
 */
export async function seedDefaultCategories() {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log("Seeding default employee categories to Firestore...");
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, COLLECTION_NAME, cat.id), {
          ...cat,
          configuration_detail: normalizePaymentType(cat.configuration_detail),
          created_at: new Date().toISOString()
        });
      }
      return DEFAULT_CATEGORIES;
    }
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        category_name: data.category_name || d.id,
        configuration_detail: normalizePaymentType(data.configuration_detail)
      };
    });
  } catch (error) {
    console.error("Error seeding categories:", error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Get all employee categories
 */
export async function getCategories() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (snapshot.empty) {
      return await seedDefaultCategories();
    }
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        category_name: data.category_name || d.id,
        configuration_detail: normalizePaymentType(data.configuration_detail)
      };
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Get category configuration by category name
 */
export async function getCategoryByName(categoryName) {
  try {
    if (!categoryName) return null;
    const cleanName = String(categoryName).trim();
    
    // Direct exact query
    const q = query(collection(db, COLLECTION_NAME), where("category_name", "==", cleanName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        ...data,
        category_name: data.category_name || cleanName,
        configuration_detail: normalizePaymentType(data.configuration_detail)
      };
    }
    
    // Case-insensitive match fallback across all categories
    const all = await getCategories();
    const match = all.find(c => c.category_name?.toLowerCase() === cleanName.toLowerCase());
    if (match) {
      return {
        ...match,
        category_name: match.category_name || cleanName,
        configuration_detail: normalizePaymentType(match.configuration_detail)
      };
    }

    // Default based on known types
    return {
      category_name: cleanName,
      configuration_detail: normalizePaymentType(cleanName)
    };
  } catch (error) {
    console.error("Error finding category by name:", error);
    return { category_name: categoryName, configuration_detail: "Full Paid" };
  }
}

/**
 * Save or update a category with cascading updates to employees and allocations
 * @param {Object} category Category payload
 * @param {string} originalCategoryName Original name of category if edited
 */
export async function saveCategory(category, originalCategoryName = null) {
  const id = category.id || `cat_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, id);
  const normalizedDetail = normalizePaymentType(category.configuration_detail);
  const newName = (category.category_name || "").trim();
  const oldName = originalCategoryName ? originalCategoryName.trim() : newName;

  const payload = {
    ...category,
    id,
    category_name: newName,
    configuration_detail: normalizedDetail,
    updated_at: new Date().toISOString()
  };

  // 1. Save Category Doc
  await setDoc(docRef, payload, { merge: true });

  // 2. Cascade update employees matching oldCategoryName (or id)
  try {
    const empRef = collection(db, "employees");
    const empSnap = await getDocs(empRef);
    const empBatch = writeBatch(db);
    let empUpdateCount = 0;

    empSnap.docs.forEach((docSnap) => {
      const emp = docSnap.data();
      const currentCat = (emp.category_employment || emp.category_name || "").trim();
      const isMatch = (oldName && currentCat.toLowerCase() === oldName.toLowerCase()) || (emp.category_id === id);

      if (isMatch) {
        empBatch.update(docSnap.ref, {
          category_employment: newName,
          category_name: newName,
          pay_category: normalizedDetail,
          updated_at: new Date().toISOString()
        });
        empUpdateCount++;
      }
    });

    if (empUpdateCount > 0) {
      await empBatch.commit();
      console.log(`[CategoryService] Cascaded category updates to ${empUpdateCount} employee records.`);
    }
  } catch (empErr) {
    console.warn("Notice: Failed cascading updates to employees:", empErr);
  }

  // 3. Cascade update pending meal allocations matching oldCategoryName
  try {
    const allocRef = collection(db, "meal_allocations");
    const allocSnap = await getDocs(allocRef);
    const allocBatch = writeBatch(db);
    let allocUpdateCount = 0;

    allocSnap.docs.forEach((docSnap) => {
      const alloc = docSnap.data();
      const currentCat = (alloc.category_name || alloc.category_employment || "").trim();
      const isMatch = oldName && currentCat.toLowerCase() === oldName.toLowerCase();

      if (isMatch) {
        allocBatch.update(docSnap.ref, {
          category_name: newName,
          category_employment: newName,
          pay_category: normalizedDetail,
          updated_at: new Date().toISOString()
        });
        allocUpdateCount++;
      }
    });

    if (allocUpdateCount > 0) {
      await allocBatch.commit();
      console.log(`[CategoryService] Cascaded category updates to ${allocUpdateCount} meal allocations.`);
    }
  } catch (allocErr) {
    console.warn("Notice: Failed cascading updates to meal allocations:", allocErr);
  }

  return payload;
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return true;
}
