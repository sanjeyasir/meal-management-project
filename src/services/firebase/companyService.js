import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "companies";

export const DEFAULT_COMPANIES = [
  { id: "comp_eco", company_code: "HES", name: "Hayleys Eco Solutions", description: "Main Manufacturing & Eco Solutions Plant" },
  { id: "comp_fibre", company_code: "HFP", name: "Hayleys Fibre Plant 1", description: "Fibre Processing & Production Line" },
  { id: "comp_agro", company_code: "HAG", name: "Hayleys Agriculture", description: "Agricultural Processing Unit" },
  { id: "comp_logistics", company_code: "HLG", name: "Hayleys Advantis Logistics", description: "Supply Chain & Warehousing" }
];

/**
 * Seed default companies if collection is empty
 */
export async function seedDefaultCompanies() {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log("Seeding default companies to Firestore...");
      for (const comp of DEFAULT_COMPANIES) {
        await setDoc(doc(db, COLLECTION_NAME, comp.id), {
          ...comp,
          created_at: new Date().toISOString()
        });
      }
      return DEFAULT_COMPANIES;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error seeding companies:", error);
    return DEFAULT_COMPANIES;
  }
}

/**
 * Get all registered companies
 */
export async function getCompanies() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (snapshot.empty) {
      return await seedDefaultCompanies();
    }
    return snapshot.docs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        name: data.name || data.company_name || d.id,
        company_code: data.company_code || data.code || "HES"
      };
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return DEFAULT_COMPANIES;
  }
}

/**
 * Save or update a company with cascading update to employee records and allocations
 * @param {Object} company Company data { id, name, company_code, description }
 * @param {string} originalCompanyName Original name if edited
 */
export async function saveCompany(company, originalCompanyName = null) {
  const id = company.id || `comp_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, id);
  const newName = (company.name || "").trim();
  const oldName = originalCompanyName ? originalCompanyName.trim() : newName;
  const companyCode = (company.company_code || company.code || "HES").trim().toUpperCase();

  const payload = {
    ...company,
    id,
    name: newName,
    company_code: companyCode,
    description: company.description ? company.description.trim() : "",
    updated_at: new Date().toISOString()
  };

  // 1. Save Company document
  await setDoc(docRef, payload, { merge: true });

  // 2. Cascade update employees matching oldCompanyName
  if (oldName && oldName !== newName) {
    try {
      const empRef = collection(db, "employees");
      const empSnap = await getDocs(empRef);
      const empBatch = writeBatch(db);
      let count = 0;

      empSnap.docs.forEach((d) => {
        const emp = d.data();
        if ((emp.company || "").toLowerCase() === oldName.toLowerCase()) {
          empBatch.update(d.ref, {
            company: newName,
            updated_at: new Date().toISOString()
          });
          count++;
        }
      });

      if (count > 0) {
        await empBatch.commit();
        console.log(`[CompanyService] Cascaded company name change to ${count} employee records.`);
      }
    } catch (err) {
      console.warn("Notice: Failed cascading company update to employees:", err);
    }

    // 3. Cascade update allocations matching oldCompanyName
    try {
      const allocRef = collection(db, "meal_allocations");
      const allocSnap = await getDocs(allocRef);
      const allocBatch = writeBatch(db);
      let count = 0;

      allocSnap.docs.forEach((d) => {
        const alloc = d.data();
        if ((alloc.company || "").toLowerCase() === oldName.toLowerCase()) {
          allocBatch.update(d.ref, {
            company: newName,
            updated_at: new Date().toISOString()
          });
          count++;
        }
      });

      if (count > 0) {
        await allocBatch.commit();
        console.log(`[CompanyService] Cascaded company name change to ${count} allocations.`);
      }
    } catch (err) {
      console.warn("Notice: Failed cascading company update to meal allocations:", err);
    }
  }

  return payload;
}

/**
 * Delete a company
 */
export async function deleteCompany(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return true;
}
