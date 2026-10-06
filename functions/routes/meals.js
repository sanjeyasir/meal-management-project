const { Router } = require("express");
const { db, FieldValue } = require("../config/firebaseAdmin.js");

const router = Router();
const MEAL_COLLECTION = "meal_allocations";

function formatDateKey(d) {
  if (!d) return "";
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    d = new Date(d);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Find all matching meal allocations for an employee on a target date
 */
async function findAllocationsForEmployee(empId, dateStr) {
  const keyStr = String(empId).trim();
  const keysToTry = [keyStr];

  if (!isNaN(keyStr)) {
    const numKey = Number(keyStr);
    keysToTry.push(numKey);
    const stripped = String(numKey);
    if (stripped !== keyStr) {
      keysToTry.push(stripped);
    }
  }

  const seenIds = new Set();
  const results = [];

  for (const k of keysToTry) {
    // 1. Check employee_id
    const snap1 = await db.collection(MEAL_COLLECTION)
      .where("employee_id", "==", k)
      .where("date", "==", dateStr)
      .get();
    snap1.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        results.push({ id: doc.id, ...doc.data() });
      }
    });

    // 2. Check emp_id
    const snap2 = await db.collection(MEAL_COLLECTION)
      .where("emp_id", "==", k)
      .where("date", "==", dateStr)
      .get();
    snap2.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        results.push({ id: doc.id, ...doc.data() });
      }
    });
  }

  return results;
}

// 1. Place Meal Order
router.post("/order", async (req, res) => {
  try {
    const {
      emp_id,
      employee_id,
      employeeId,
      id,
      pin,
      emp_name,
      name,
      employee_name,
      company,
      department,
      section,
      pay_category,
      category_employment,
      start_date,
      end_date,
      breakfast = 0,
      lunch = 0,
      dinner = 0,
      createdBy = "Desktop Kiosk App"
    } = req.body;

    const resolvedEmpId = String(emp_id || employee_id || employeeId || id || pin || "").trim();
    if (!resolvedEmpId || resolvedEmpId === "None" || resolvedEmpId === "null" || resolvedEmpId === "undefined") {
      return res.status(400).json({ success: false, message: "Missing or invalid required field: emp_id" });
    }

    const resolvedEmpName = String(emp_name || name || employee_name || `Employee ${resolvedEmpId}`).trim();
    const resolvedDept = String(department || section || "Operations").trim();
    const resolvedSection = String(section || department || "Operations").trim();
    const resolvedPayCat = String(pay_category || category_employment || "Factory Daily Paid").trim();
    const resolvedCompany = String(company || "Hayleys Eco Solutions").trim();

    const startDateObj = new Date(start_date || new Date());
    const endDateObj = new Date(end_date || startDateObj);

    const mealQuantities = {
      Breakfast: Number(breakfast) || 0,
      Lunch: Number(lunch) || 0,
      Dinner: Number(dinner) || 0
    };

    const batch = db.batch();
    const createdOrders = [];
    const skippedOrders = [];

    const curr = new Date(startDateObj);
    while (curr <= endDateObj) {
      const dateStr = formatDateKey(curr);

      // Check existing allocations for duplicate prevention
      const existingAllocations = await findAllocationsForEmployee(resolvedEmpId, dateStr);

      for (const [mealType, qty] of Object.entries(mealQuantities)) {
        if (qty > 0) {
          const isAlreadyAllocated = existingAllocations.some(a => a.meal_type === mealType);

          if (isAlreadyAllocated) {
            skippedOrders.push({ date: dateStr, meal_type: mealType, reason: "Already allocated" });
            continue;
          }

          const docRef = db.collection(MEAL_COLLECTION).doc();
          const orderData = {
            id: docRef.id,
            employee_id: resolvedEmpId,
            emp_id: resolvedEmpId,
            employee_name: resolvedEmpName,
            name: resolvedEmpName,
            company: resolvedCompany,
            department: resolvedDept,
            section: resolvedSection,
            pay_category: resolvedPayCat,
            date: dateStr,
            meal_type: mealType,
            quantity: qty,
            status: "Ordered",
            received: false,
            created_by: createdBy,
            created_at: new Date().toISOString(),
            server_timestamp: FieldValue.serverTimestamp()
          };

          batch.set(docRef, orderData);
          createdOrders.push(orderData);
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (createdOrders.length > 0) {
      await batch.commit();
    }

    return res.json({
      success: true,
      message: `Created ${createdOrders.length} meal order(s).`,
      createdCount: createdOrders.length,
      orders: createdOrders,
      skipped: skippedOrders
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Dispense / Receive Meal at Kiosk
router.post("/dispense", async (req, res) => {
  try {
    const { employeeId, emp_id, employee_id, id, pin, mealType, date, dispensedBy = "Receiving Kiosk" } = req.body;
    const targetDate = formatDateKey(date || new Date());
    const empId = String(employeeId || emp_id || employee_id || id || pin || "").trim();

    if (!empId || empId === "None" || empId === "null") {
      return res.status(400).json({ success: false, message: "Missing or invalid employeeId" });
    }

    // Step 1: Query all allocations matching empId across employee_id / emp_id fields
    const allAllocations = await findAllocationsForEmployee(empId, targetDate);

    if (allAllocations.length === 0) {
      return res.status(404).json({
        success: false,
        dispensed: false,
        message: `No active meal order found for Employee ${empId} on ${targetDate}.`
      });
    }

    // Step 2: Look for unreceived meal for specific mealType (or first unreceived)
    let targetAlloc = null;
    if (mealType) {
      targetAlloc = allAllocations.find(a => a.meal_type === mealType && !a.received && a.status !== "Received");
    }
    if (!targetAlloc) {
      targetAlloc = allAllocations.find(a => !a.received && a.status !== "Received");
    }

    // If all are already received:
    if (!targetAlloc) {
      const firstAlloc = allAllocations[0];
      return res.status(409).json({
        success: false,
        dispensed: false,
        alreadyReceived: true,
        receivedAt: firstAlloc.received_at || "earlier today",
        message: `Meal already received by Employee ${empId} on ${targetDate}.`
      });
    }

    // Dispense meal
    const docId = targetAlloc.id;
    const receivedTimestamp = new Date().toISOString();

    await db.collection(MEAL_COLLECTION).doc(docId).update({
      status: "Received",
      received: true,
      received_at: receivedTimestamp,
      dispensed_by: dispensedBy,
      updated_at: receivedTimestamp
    });

    const updatedData = { ...targetAlloc, status: "Received", received: true, received_at: receivedTimestamp };

    return res.json({
      success: true,
      dispensed: true,
      message: `Meal successfully dispensed to ${updatedData.employee_name || updatedData.name || empId} (${updatedData.meal_type}).`,
      allocation: updatedData
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Today's meals
router.get("/today", async (req, res) => {
  try {
    const targetDate = formatDateKey(req.query.date || new Date());
    const snapshot = await db.collection(MEAL_COLLECTION).where("date", "==", targetDate).get();

    const orders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const resolvedId = data.employee_id || data.emp_id;
      if (resolvedId && resolvedId !== "None") {
        orders.push({ id: doc.id, emp_id: resolvedId, employee_id: resolvedId, ...data });
      }
    });

    const summary = {
      date: targetDate,
      totalOrders: orders.length,
      breakfast: orders.filter(o => o.meal_type === "Breakfast").length,
      lunch: orders.filter(o => o.meal_type === "Lunch").length,
      dinner: orders.filter(o => o.meal_type === "Dinner").length,
      dispensedCount: orders.filter(o => o.received || o.status === "Received").length,
      pendingCount: orders.filter(o => !o.received && o.status !== "Received").length
    };

    return res.json({
      success: true,
      summary,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Employee upcoming meals / allocations
router.get("/employee/:empId", async (req, res) => {
  try {
    const empId = String(req.params.empId).trim();
    const days = Math.min(Number(req.query.days) || 7, 30);
    const startDateParam = req.query.startDate;
    let baseDate;
    if (startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
      const [y, m, d] = startDateParam.split("-").map(Number);
      baseDate = new Date(y, m - 1, d);
    } else {
      baseDate = new Date();
    }
    const allAllocations = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = formatDateKey(d);
      const dayAllocations = await findAllocationsForEmployee(empId, dateStr);
      allAllocations.push(...dayAllocations);
    }

    return res.json({
      success: true,
      employee_id: empId,
      emp_id: empId,
      count: allAllocations.length,
      data: allAllocations
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Check if employee already has allocations for a date range
router.post("/check-allocations", async (req, res) => {
  try {
    const { emp_id, employee_id, pin, id, start_date, end_date } = req.body;
    const resolvedId = String(emp_id || employee_id || pin || id || "").trim();
    if (!resolvedId) {
      return res.status(400).json({ success: false, message: "Missing employee ID" });
    }

    const startDateObj = new Date(start_date || new Date());
    const endDateObj = new Date(end_date || startDateObj);

    const allocations = [];
    const curr = new Date(startDateObj);
    while (curr <= endDateObj) {
      const dateStr = formatDateKey(curr);
      const dayAllocations = await findAllocationsForEmployee(resolvedId, dateStr);
      allocations.push(...dayAllocations);
      curr.setDate(curr.getDate() + 1);
    }

    const hasExisting = allocations.length > 0;
    return res.json({
      success: true,
      hasExisting,
      count: allocations.length,
      allocations,
      message: hasExisting
        ? `Employee ${resolvedId} already has ${allocations.length} meal(s) allocated in this date range.`
        : "No existing allocations found for this date range."
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Delete all meal allocations (Reset / Wipe)
router.post("/clear-all", async (req, res) => {
  try {
    const snapshot = await db.collection(MEAL_COLLECTION).get();
    if (snapshot.empty) {
      return res.json({ success: true, message: "No meal allocations found to delete.", deletedCount: 0 });
    }

    const batchSize = 400;
    let deletedCount = 0;
    let batch = db.batch();
    let i = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      i++;
      deletedCount++;
      if (i >= batchSize) {
        await batch.commit();
        batch = db.batch();
        i = 0;
      }
    }
    if (i > 0) {
      await batch.commit();
    }

    return res.json({
      success: true,
      message: `Successfully deleted all ${deletedCount} meal allocation(s).`,
      deletedCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/all", async (req, res) => {
  try {
    const snapshot = await db.collection(MEAL_COLLECTION).get();
    if (snapshot.empty) {
      return res.json({ success: true, message: "No meal allocations found to delete.", deletedCount: 0 });
    }

    const batchSize = 400;
    let deletedCount = 0;
    let batch = db.batch();
    let i = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      i++;
      deletedCount++;
      if (i >= batchSize) {
        await batch.commit();
        batch = db.batch();
        i = 0;
      }
    }
    if (i > 0) {
      await batch.commit();
    }

    return res.json({
      success: true,
      message: `Successfully deleted all ${deletedCount} meal allocation(s).`,
      deletedCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


