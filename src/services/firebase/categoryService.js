import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "employee_categories";

export const DEFAULT_CATEGORIES = [
  { id: "cat_exec", category_name: "Executive", configuration_detail: "Free Meal", description: "Senior Management & Executives" },
  { id: "cat_staff", category_name: "Staff", configuration_detail: "Half Paid", description: "Office & Administrative Staff" },
  { id: "cat_worker", category_name: "Worker", configuration_detail: "Free Meal", description: "Plant Operations & Line Staff" },
  { id: "cat_contract", category_name: "Contractor", configuration_detail: "Not Paid", description: "Third Party & External Contractors" },
  { id: "cat_visitor", category_name: "Visitor", configuration_detail: "Free Meal", description: "Official Guests & Auditors" }
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
          created_at: new Date().toISOString()
        });
      }
      return DEFAULT_CATEGORIES;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const q = query(collection(db, COLLECTION_NAME), where("category_name", "==", categoryName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    
    // Case-insensitive match fallback
    const all = await getCategories();
    const match = all.find(c => c.category_name?.toLowerCase() === categoryName.toLowerCase());
    return match || { category_name: categoryName, configuration_detail: "Free Meal" };
  } catch (error) {
    console.error("Error finding category by name:", error);
    return { category_name: categoryName, configuration_detail: "Free Meal" };
  }
}

/**
 * Save or update a category
 */
export async function saveCategory(category) {
  const id = category.id || `cat_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, id);
  await setDoc(docRef, {
    ...category,
    id,
    updated_at: new Date().toISOString()
  }, { merge: true });
  return { id, ...category };
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return true;
}
