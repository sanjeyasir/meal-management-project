import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "departments";

export const DEFAULT_DEPARTMENTS = [
  { id: "dept_qa", dept_id: "QA-01", name: "Quality Assurance & Compliance" },
  { id: "dept_prod", dept_id: "PR-01", name: "Production & Manufacturing" },
  { id: "dept_maint", dept_id: "MT-01", name: "Engineering & Maintenance" },
  { id: "dept_log", dept_id: "LG-01", name: "Logistics & Supply Chain" },
  { id: "dept_admin", dept_id: "AD-01", name: "Human Resources & Administration" }
];

export async function getDepartments() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (snapshot.empty) {
      for (const d of DEFAULT_DEPARTMENTS) {
        await setDoc(doc(db, COLLECTION_NAME, d.id), d);
      }
      return DEFAULT_DEPARTMENTS;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching departments:", error);
    return DEFAULT_DEPARTMENTS;
  }
}

export async function addDepartment(deptId, name) {
  const id = `dept_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, id);
  await setDoc(docRef, { id, dept_id: deptId, name, created_at: new Date().toISOString() });
  return { id, dept_id: deptId, name };
}

export async function deleteDepartment(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return true;
}
