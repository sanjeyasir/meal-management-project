import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "meal_allocations";

/**
 * Format a Date object or string to YYYY-MM-DD
 */
export function formatDateKey(d) {
  if (!d) return "";
  if (typeof d === "string") {
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    d = new Date(d);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validate if a meal allocation already exists for this employee, date, and meal type
 */
export async function validateMealExists(employeeId, dateStr, mealType) {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("employee_id", "==", String(employeeId)),
      where("date", "==", dateStr),
      where("meal_type", "==", mealType)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error validating meal exists:", error);
    return false;
  }
}

/**
 * Batch create meal allocations over a date range
 */
export async function createMealOrder(payCategory, orderDetails, createdBy) {
  const results = [];
  const empId = String(orderDetails.emp_id);
  const empName = orderDetails.emp_name || "Employee";
  const company = orderDetails.company || "Hayleys Eco Solutions";
  const section = orderDetails.section || "Operations";
  
  const startDate = new Date(orderDetails.start_date);
  const endDate = new Date(orderDetails.end_date);

  const mealMap = {
    Breakfast: Number(orderDetails.breakfast || 0),
    Lunch: Number(orderDetails.lunch || 0),
    Dinner: Number(orderDetails.dinner || 0),
  };

  // Calculate day difference
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < diffDays; i++) {
    const currentDay = new Date(startDate);
    currentDay.setDate(startDate.getDate() + i);
    const dayStr = formatDateKey(currentDay);

    for (const [mealType, count] of Object.entries(mealMap)) {
      if (count > 0) {
        const alreadyExists = await validateMealExists(empId, dayStr, mealType);

        if (alreadyExists) {
          results.push({
            type: "error",
            date: dayStr,
            mealType,
            message: `${dayStr} ${mealType}: Meal allocation already exists for this date.`
          });
        } else {
          try {
            const allocationId = `${empId}_${dayStr}_${mealType}`.replace(/\s+/g, "_");
            const docRef = doc(db, COLLECTION_NAME, allocationId);

            const payload = {
              id: allocationId,
              employee_id: empId,
              employee_name: empName,
              company,
              section,
              date: dayStr,
              meal_type: mealType,
              pay_category: payCategory || "Free Meal",
              status: "Ordered",
              created_at: new Date().toISOString(),
              created_by: createdBy || empName,
              received_at: null
            };

            await setDoc(docRef, payload);

            results.push({
              type: "success",
              date: dayStr,
              mealType,
              message: `${dayStr} ${mealType}: Meal order placed successfully!`
            });
          } catch (err) {
            results.push({
              type: "error",
              date: dayStr,
              mealType,
              message: `${dayStr} ${mealType}: Error saving order: ${err.message}`
            });
          }
        }
      }
    }
  }

  return results;
}

/**
 * Fetch all meal allocations filtered by query options
 */
export async function getMealAllocations(filters = {}) {
  try {
    let q = collection(db, COLLECTION_NAME);
    const constraints = [];

    if (filters.employee_id) {
      constraints.push(where("employee_id", "==", String(filters.employee_id)));
    }
    if (filters.date) {
      constraints.push(where("date", "==", formatDateKey(filters.date)));
    }
    if (filters.status) {
      constraints.push(where("status", "==", filters.status));
    }
    if (filters.pay_category) {
      constraints.push(where("pay_category", "==", filters.pay_category));
    }
    if (filters.meal_type) {
      constraints.push(where("meal_type", "==", filters.meal_type));
    }

    const finalQuery = constraints.length > 0 ? query(q, ...constraints) : q;
    const snapshot = await getDocs(finalQuery);
    
    const allocations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side date range filtering if fromDate/toDate specified
    let filtered = allocations;
    if (filters.fromDate && filters.toDate) {
      const fromStr = formatDateKey(filters.fromDate);
      const toStr = formatDateKey(filters.toDate);
      filtered = filtered.filter(a => a.date >= fromStr && a.date <= toStr);
    }

    // Sort descending by date
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error("Error getting meal allocations:", error);
    return [];
  }
}

/**
 * Update an existing meal allocation.
 * STRICT RULE: Only allocations with status 'Ordered' can be edited.
 * Allocations with status 'Recieved' / 'Received' are permanently locked.
 */
export async function updateMealAllocation(allocationId, updatedFields = {}) {
  try {
    const docRef = doc(db, COLLECTION_NAME, allocationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: "Meal allocation record not found." };
    }

    const currentData = docSnap.data();
    const currentStatus = (currentData.status || "").toLowerCase();

    if (currentStatus === "recieved" || currentStatus === "received") {
      return {
        success: false,
        message: "Locked: This meal has already been dispensed/received and cannot be edited."
      };
    }

    // Check if new combination of employee_id + date + meal_type collides with another record
    const targetDate = updatedFields.date ? formatDateKey(updatedFields.date) : currentData.date;
    const targetMealType = updatedFields.meal_type || currentData.meal_type;
    const targetEmpId = currentData.employee_id;

    if (targetDate !== currentData.date || targetMealType !== currentData.meal_type) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("employee_id", "==", String(targetEmpId)),
        where("date", "==", targetDate),
        where("meal_type", "==", targetMealType)
      );
      const querySnap = await getDocs(q);
      const conflict = querySnap.docs.find((d) => d.id !== allocationId);
      if (conflict) {
        return {
          success: false,
          message: `An allocation for ${targetMealType} on ${targetDate} already exists for this employee.`
        };
      }
    }

    const updates = {
      ...updatedFields,
      date: targetDate,
      meal_type: targetMealType,
      updated_at: new Date().toISOString()
    };

    // Remove undefined keys
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    await updateDoc(docRef, updates);
    return { success: true, message: "Meal allocation updated successfully." };
  } catch (error) {
    console.error("Error updating meal allocation:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Update allocation status (e.g. from 'Ordered' to 'Recieved')
 */
export async function updateMealAllocationStatus(allocationId, status) {
  try {
    const docRef = doc(db, COLLECTION_NAME, allocationId);
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    if (status.toLowerCase() === "recieved" || status.toLowerCase() === "received") {
      updates.received_at = new Date().toISOString();
      updates.status = "Recieved";
    }
    await updateDoc(docRef, updates);
    return { success: true, message: `Status updated to ${status}` };
  } catch (error) {
    console.error("Error updating allocation status:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Delete a meal allocation.
 * Only allocations with status 'Ordered' can be deleted/cancelled.
 */
export async function deleteMealAllocation(allocationId, force = false) {
  try {
    const docRef = doc(db, COLLECTION_NAME, allocationId);
    if (!force) {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        const currentStatus = (currentData.status || "").toLowerCase();
        if (currentStatus === "recieved" || currentStatus === "received") {
          return {
            success: false,
            message: "Cannot cancel/delete a meal that has already been received/dispensed."
          };
        }
      }
    }
    await deleteDoc(docRef);
    return { success: true, message: "Allocation cancelled and removed successfully" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Fetch today's allocations formatted for the Receive Canteen view
 */
export async function getMealAllocationsForToday(employeeId, targetDate = new Date()) {
  try {
    const dateStr = formatDateKey(targetDate);
    const allocations = await getMealAllocations({ employee_id: employeeId, date: dateStr });

    const summary = {
      category_type: allocations.length > 0 ? allocations[0].pay_category : "Free Meal",
      date: dateStr,
      meals_ordered: {
        Breakfast: { Ordered: 0, Recieved: 0, id: null, data: null },
        Lunch: { Ordered: 0, Recieved: 0, id: null, data: null },
        Dinner: { Ordered: 0, Recieved: 0, id: null, data: null }
      }
    };

    allocations.forEach(row => {
      const type = row.meal_type;
      const status = row.status; // "Ordered" or "Recieved"
      if (summary.meals_ordered[type]) {
        if (status === "Recieved" || status === "Received") {
          summary.meals_ordered[type].Recieved += 1;
        } else {
          summary.meals_ordered[type].Ordered += 1;
        }
        summary.meals_ordered[type].id = row.id;
        summary.meals_ordered[type].data = row;
      }
    });

    return summary;
  } catch (error) {
    console.error("Error fetching today's meals for receiving:", error);
    return null;
  }
}

/**
 * Fetch rolling allocations for the next 5 days
 */
export async function getNextFiveDaysMeals(employeeId) {
  try {
    const today = new Date();
    const todayStr = formatDateKey(today);
    
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 4);
    const futureStr = formatDateKey(futureDate);

    const allocations = await getMealAllocations({
      employee_id: employeeId,
      fromDate: todayStr,
      toDate: futureStr
    });

    return allocations.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("Error fetching next 5 days meals:", error);
    return [];
  }
}

/**
 * Generate aggregated statistics for an employee (Total Requested, Received, Half-Paid, Not-Paid, Free)
 */
export async function getMealStatistics(employeeId) {
  try {
    const all = await getMealAllocations({ employee_id: employeeId });

    const computeCategoryStats = (filterFn) => {
      const filtered = all.filter(filterFn);
      const b = filtered.filter(m => m.meal_type?.toLowerCase() === "breakfast").length;
      const l = filtered.filter(m => m.meal_type?.toLowerCase() === "lunch").length;
      const d = filtered.filter(m => m.meal_type?.toLowerCase() === "dinner").length;
      return {
        total: filtered.length,
        breakfast: b,
        lunch: l,
        dinner: d
      };
    };

    return {
      requested: computeCategoryStats(m => (m.status || "").toLowerCase() === "ordered"),
      recieved: computeCategoryStats(m => (m.status || "").toLowerCase() === "recieved" || (m.status || "").toLowerCase() === "received"),
      half_paid: computeCategoryStats(m => (m.pay_category || "").toLowerCase().includes("half")),
      not_paid: computeCategoryStats(m => (m.pay_category || "").toLowerCase().includes("not")),
      free: computeCategoryStats(m => (m.pay_category || "").toLowerCase().includes("free"))
    };
  } catch (error) {
    console.error("Error computing meal statistics:", error);
    const empty = { total: 0, breakfast: 0, lunch: 0, dinner: 0 };
    return {
      requested: empty,
      recieved: empty,
      half_paid: empty,
      not_paid: empty,
      free: empty
    };
  }
}
