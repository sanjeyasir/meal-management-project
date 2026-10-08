const { Router } = require("express");
const { db, storage } = require("../config/firebaseAdmin.js");

const router = Router();
const MEAL_COLLECTION = "meal_allocations";
const ARCHIVE_COLLECTION = "daily_archived_reports";
const STORAGE_FOLDER = "daily_archive_reports";

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

function getYesterdaySriLankaDate() {
  const now = new Date();
  const slDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  slDate.setDate(slDate.getDate() - 1);
  return formatDateKey(slDate);
}

function formatSriLankaDateTime(val) {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(d);
  } catch (e) {
    return String(val);
  }
}

function normalizePaymentType(type) {
  if (!type) return "Full Paid";
  const lower = String(type).trim().toLowerCase();
  if (lower.includes("half")) return "Half Paid";
  if (lower.includes("not") || lower.includes("unpaid") || lower.includes("none")) return "Not Paid";
  if (lower.includes("full") || lower.includes("free")) return "Full Paid";
  return "Full Paid";
}

/**
 * Server-side Daily Archive Engine
 */
async function archiveDailyAllocations(targetDate = null, triggeredBy = "Automated Cloud Schedule (12:00 AM)") {
  const ExcelJS = require("exceljs");
  const dateKey = targetDate ? formatDateKey(targetDate) : getYesterdaySriLankaDate();
  const filename = `Daily_Meal_Allocations_${dateKey}.xlsx`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;

  // 1. Fetch allocations and master categories for the specified date
  const [snapshot, catSnap] = await Promise.all([
    db.collection(MEAL_COLLECTION).where("date", "==", dateKey).get(),
    db.collection("employee_categories").get()
  ]);

  const catMap = {};
  catSnap.forEach((doc) => {
    const data = doc.data();
    if (data.category_name) {
      catMap[data.category_name.toLowerCase()] = data.configuration_detail;
    }
  });

  const getAutoSubsidy = (item) => {
    const cat = (item.category_name || item.category_employment || item.employee_category || "Staff").trim();
    const masterSubsidy = catMap[cat.toLowerCase()] || item.pay_category || item.configuration_detail;
    return normalizePaymentType(masterSubsidy);
  };

  const allocations = [];
  snapshot.forEach(doc => allocations.push({ id: doc.id, ...doc.data() }));

  // 2. Metrics aggregation
  const totalAllocations = allocations.length;
  let dispensedCount = 0;
  let breakfastCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;
  let fullPaidCount = 0;
  let halfPaidCount = 0;
  let notPaidCount = 0;

  allocations.forEach(item => {
    const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
    if (isRecv) dispensedCount++;

    const mType = item.meal_type || "Lunch";
    if (mType === "Breakfast") breakfastCount++;
    else if (mType === "Lunch") lunchCount++;
    else if (mType === "Dinner") dinnerCount++;

    const norm = getAutoSubsidy(item);
    if (norm === "Full Paid") fullPaidCount++;
    else if (norm === "Half Paid") halfPaidCount++;
    else if (norm === "Not Paid") notPaidCount++;
  });

  const pendingCount = totalAllocations - dispensedCount;

  // 3. Build Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System Cloud API";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Meal Transactions", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 3 }]
  });

  // Title Banner
  worksheet.mergeCells("A1:J1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `HAYLEYS ECO SOLUTIONS - DAILY MEAL ALLOCATIONS ARCHIVE REPORT (${dateKey})`;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;

  // Subtitle Row
  worksheet.mergeCells("A2:J2");
  const subCell = worksheet.getCell("A2");
  const nowSL = formatSriLankaDateTime(new Date());
  subCell.value = `Archive Date: ${dateKey}  |  Archived on: ${nowSL} (Sri Jayawardenepura Time)  |  Trigger: ${triggeredBy}  |  Total Entries: ${totalAllocations}`;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 24;

  // Headers (NO Allocation ID, NO Section)
  const headers = [
    "Allocation Date",
    "Employee ID",
    "Employee Name",
    "Employee Category",
    "Subsidy / Payment Plan",
    "Company / Plant",
    "Meal Slot",
    "Status",
    "Created At (Sri Lanka Time)",
    "Dispensed At (Sri Lanka Time)"
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  for (let c = 1; c <= headers.length; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF064E3B" } },
      left: { style: "thin", color: { argb: "FF064E3B" } },
      bottom: { style: "medium", color: { argb: "FF064E3B" } },
      right: { style: "thin", color: { argb: "FF064E3B" } }
    };
  }

  // Rows
  allocations.forEach((item, index) => {
    const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
    const normPay = getAutoSubsidy(item);
    const cat = item.category_name || item.category_employment || "Staff";

    const row = worksheet.addRow([
      item.date || dateKey,
      item.employee_id || item.emp_id || "-",
      item.employee_name || item.name || "-",
      cat,
      normPay,
      item.company || "Hayleys Eco Solutions",
      item.meal_type || "-",
      isRecv ? "Received" : "Ordered",
      formatSriLankaDateTime(item.created_at),
      formatSriLankaDateTime(item.received_at)
    ]);

    row.height = 22;
    row.font = { name: "Calibri", size: 10 };
    row.alignment = { vertical: "middle" };

    const isEven = index % 2 === 1;
    const bgFill = isEven
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    for (let c = 1; c <= headers.length; c++) {
      const cell = row.getCell(c);
      cell.fill = bgFill;
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } }
      };
    }

    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
  });

  worksheet.autoFilter = `A3:J${Math.max(3, allocations.length + 3)}`;
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 16;
  worksheet.getColumn(3).width = 26;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 22;
  worksheet.getColumn(6).width = 28;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 14;
  worksheet.getColumn(9).width = 26;
  worksheet.getColumn(10).width = 26;
  worksheet.getColumn(11).width = 26;

  // 4. Export Buffer & Upload to Firebase Storage
  const buffer = await workbook.xlsx.writeBuffer();
  let downloadUrl = "";

  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(Buffer.from(buffer), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      metadata: {
        archiveDate: dateKey,
        totalRecords: String(totalAllocations),
        archivedAt: new Date().toISOString()
      }
    });

    // Make public or get public URL if bucket permissions permit
    try {
      await file.makePublic();
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    } catch (e) {
      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    }
  } catch (storageErr) {
    console.warn("[Cloud Storage Upload Warning]:", storageErr.message);
  }

  // 5. Store Metadata in Firestore collection 'daily_archived_reports'
  const reportMetadata = {
    id: dateKey,
    date: dateKey,
    display_label: `Daily Archive - ${dateKey}`,
    filename,
    storage_path: storagePath,
    download_url: downloadUrl,
    total_allocations: totalAllocations,
    dispensed_count: dispensedCount,
    pending_count: pendingCount,
    breakfast_count: breakfastCount,
    lunch_count: lunchCount,
    dinner_count: dinnerCount,
    full_paid_count: fullPaidCount,
    half_paid_count: halfPaidCount,
    not_paid_count: notPaidCount,
    archived_at: new Date().toISOString(),
    archived_at_formatted: formatSriLankaDateTime(new Date()),
    archived_by: triggeredBy
  };

  await db.collection(ARCHIVE_COLLECTION).doc(dateKey).set(reportMetadata, { merge: true });

  return reportMetadata;
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
      if (data.received || data.status === "Received" || data.status === "Recieved") {
        stats.totalDispensed++;
      } else {
        stats.totalPending++;
      }

      const mType = data.meal_type || "Other";
      stats.byMealType[mType] = (stats.byMealType[mType] || 0) + 1;

      const cat = normalizePaymentType(data.pay_category || data.category_employment);
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      const dept = data.department || data.section || "Operations";
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
      if (!d.received && d.status !== "Received" && d.status !== "Recieved") {
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

// 3. Trigger / Run Daily Archive (Previous Day or Specific Date)
router.post("/archive-daily", async (req, res) => {
  try {
    const targetDate = req.body?.date || req.query?.date || null;
    const triggeredBy = req.body?.triggeredBy || "API Request";
    const result = await archiveDailyAllocations(targetDate, triggeredBy);
    return res.json({
      success: true,
      message: `Successfully generated daily archive for ${result.date} into Firebase Storage and Firestore.`,
      archive: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/archive-daily", async (req, res) => {
  try {
    const targetDate = req.query?.date || null;
    const result = await archiveDailyAllocations(targetDate, "Manual Trigger (GET)");
    return res.json({
      success: true,
      message: `Successfully generated daily archive for ${result.date}`,
      archive: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  archiveDailyAllocations
};
