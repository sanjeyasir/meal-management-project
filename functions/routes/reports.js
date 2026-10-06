const { Router } = require("express");
const { db } = require("../config/firebaseAdmin.js");

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

// 1. Summary
router.get("/summary", async (req, res) => {
  try {
    const startDate = formatDateKey(req.query.startDate || new Date());
    const endDate = formatDateKey(req.query.endDate || startDate);

    const snapshot = await db.collection(MEAL_COLLECTION)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const orders = [];
    const stats = {
      totalOrders: 0,
      totalDispensed: 0,
      totalPending: 0,
      byMealType: { Breakfast: 0, Lunch: 0, Dinner: 0 },
      byCategory: {},
      byDepartment: {}
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      orders.push({ id: doc.id, ...data });

      stats.totalOrders++;
      if (data.received || data.status === "Received") {
        stats.totalDispensed++;
      } else {
        stats.totalPending++;
      }

      const mType = data.meal_type || "Other";
      stats.byMealType[mType] = (stats.byMealType[mType] || 0) + 1;

      const cat = data.pay_category || "Unassigned";
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      const dept = data.department || "Operations";
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
    });

    return res.json({
      success: true,
      period: { startDate, endDate },
      summary: stats,
      count: orders.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Unclaimed
router.get("/unclaimed", async (req, res) => {
  try {
    const targetDate = formatDateKey(req.query.date || new Date());

    const snapshot = await db.collection(MEAL_COLLECTION)
      .where("date", "==", targetDate)
      .get();

    const unclaimed = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (!d.received && d.status !== "Received") {
        unclaimed.push({ id: doc.id, ...d });
      }
    });

    return res.json({
      success: true,
      date: targetDate,
      unclaimedCount: unclaimed.length,
      data: unclaimed
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
