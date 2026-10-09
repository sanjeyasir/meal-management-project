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

function getPreviousDaysKeys(targetDateKey, count = 2) {
  const result = [];
  const [y, m, d] = targetDateKey.split("-").map(Number);
  const baseDate = new Date(y, m - 1, d);

  for (let i = 1; i <= count; i++) {
    const prevDate = new Date(baseDate);
    prevDate.setDate(prevDate.getDate() - i);
    result.push(formatDateKey(prevDate));
  }
  return result;
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
 * Helper to populate a standard meal transactions worksheet
 */
function populateTransactionsSheet(worksheet, { allocations = [], title = "", subtitle = "", catMap = {} }) {
  worksheet.views = [{ showGridLines: true, state: "frozen", ySplit: 3 }];

  // 1. Report Title & Header Banner
  worksheet.mergeCells("A1:J1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;

  // 2. Subtitle / Metadata Row
  worksheet.mergeCells("A2:J2");
  const subCell = worksheet.getCell("A2");
  subCell.value = subtitle;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 24;

  // 3. Table Column Headers (Row 3)
  const headers = [
    "Allocation Date",
    "Employee ID",
    "Employee Name",
    "Company",
    "Meal Category",
    "Payment Plan",
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

  // 4. Rows
  allocations.forEach((item, index) => {
    const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
    const cat = (item.category_name || item.category_employment || item.employee_category || "Staff").trim();
    const masterSubsidy = catMap[cat.toLowerCase()] || item.pay_category || item.configuration_detail;
    const normPay = normalizePaymentType(masterSubsidy);

    const row = worksheet.addRow([
      item.date || "-",
      item.employee_id || item.emp_id || "-",
      item.employee_name || item.name || "-",
      item.company || "Hayleys Eco Solutions",
      cat,
      normPay,
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
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
  });

  worksheet.autoFilter = `A3:J${Math.max(3, allocations.length + 3)}`;
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 16;
  worksheet.getColumn(3).width = 26;
  worksheet.getColumn(4).width = 26;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 20;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 14;
  worksheet.getColumn(9).width = 26;
  worksheet.getColumn(10).width = 26;
}

/**
 * Server-side Daily Archive Engine (Matches 3-day multi-tab specifications)
 */
async function archiveDailyAllocations(targetDate = null, triggeredBy = "Automated Cloud Schedule (12:00 AM)") {
  const ExcelJS = require("exceljs");
  const dateKey = targetDate ? formatDateKey(targetDate) : getYesterdaySriLankaDate();
  const filename = `Daily_Meal_Allocations_${dateKey}.xlsx`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;

  // ----------------------------------------------------
  // STEP 1: ARCHIVE THE TARGET DAY'S DATA TO THE LIST FIRST
  // ----------------------------------------------------
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

  const targetAllocations = [];
  snapshot.forEach(doc => targetAllocations.push({ id: doc.id, ...doc.data() }));

  const totalAllocations = targetAllocations.length;
  let dispensedCount = 0;
  let breakfastCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;
  let fullPaidCount = 0;
  let halfPaidCount = 0;
  let notPaidCount = 0;

  targetAllocations.forEach(item => {
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
  const nowSL = formatSriLankaDateTime(new Date());

  // Save initial metadata record to Firestore archive list
  const reportMetadata = {
    id: dateKey,
    date: dateKey,
    display_label: `Daily Archive - ${dateKey}`,
    filename,
    storage_path: storagePath,
    download_url: "",
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
    archived_at_formatted: nowSL,
    archived_by: triggeredBy
  };

  await db.collection(ARCHIVE_COLLECTION).doc(dateKey).set(reportMetadata, { merge: true });

  // ----------------------------------------------------
  // STEP 2: IN THE SAME FLOW, TAKE THE 2 PREVIOUS DAYS MEALS IF PRESENT
  // ----------------------------------------------------
  const [prevDay1, prevDay2] = getPreviousDaysKeys(dateKey, 2);

  const [snap1, snap2] = await Promise.all([
    db.collection(MEAL_COLLECTION).where("date", "==", prevDay1).get(),
    db.collection(MEAL_COLLECTION).where("date", "==", prevDay2).get()
  ]);

  const prevAllocs1 = [];
  snap1.forEach(doc => prevAllocs1.push({ id: doc.id, ...doc.data() }));

  const prevAllocs2 = [];
  snap2.forEach(doc => prevAllocs2.push({ id: doc.id, ...doc.data() }));

  const historicalAllocations = [...prevAllocs1, ...prevAllocs2];
  const allAllocations = [...targetAllocations, ...historicalAllocations];

  // ----------------------------------------------------
  // STEP 3: CREATE THE 3-DAY MULTI-TAB EXCEL WORKBOOK
  // ----------------------------------------------------
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System Cloud API";
  workbook.created = new Date();

  // Tab 1: Target Daily Allocations
  const sheet1Name = `Daily Archive (${dateKey})`.substring(0, 31);
  const sheet1 = workbook.addWorksheet(sheet1Name);
  populateTransactionsSheet(sheet1, {
    allocations: targetAllocations,
    title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE (${dateKey})`,
    subtitle: `Archive Date: ${dateKey}  |  Archived on: ${nowSL} (Sri Jayawardenepura Time)  |  Trigger: ${triggeredBy}  |  Total Entries: ${targetAllocations.length}`,
    catMap
  });

  // Tab 2: 3-Day Historical Review
  const sheet2 = workbook.addWorksheet("3-Day Historical Review");
  const sortedAll = [...allAllocations].sort((a, b) => {
    const dComp = (b.date || "").localeCompare(a.date || "");
    if (dComp !== 0) return dComp;
    return (a.employee_name || "").localeCompare(b.employee_name || "");
  });

  populateTransactionsSheet(sheet2, {
    allocations: sortedAll,
    title: `HAYLEYS ECO SOLUTIONS - 3-DAY HISTORICAL ALLOCATIONS REPORT`,
    subtitle: `Includes Target Date (${dateKey}) + Up to 2 Previous Days (${prevDay1}, ${prevDay2})  |  Generated on: ${nowSL}  |  Total Records: ${sortedAll.length}`,
    catMap
  });

  // Tab 3: Summary & Statistics Breakdown
  const sheet3 = workbook.addWorksheet("Summary & Statistics");
  sheet3.views = [{ showGridLines: true, state: "frozen", ySplit: 3 }];

  sheet3.mergeCells("A1:K1");
  const s3Title = sheet3.getCell("A1");
  s3Title.value = `HAYLEYS ECO SOLUTIONS - 3-DAY SUMMARY & METRICS BREAKDOWN`;
  s3Title.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  s3Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  s3Title.alignment = { horizontal: "center", vertical: "middle" };
  sheet3.getRow(1).height = 34;

  sheet3.mergeCells("A2:K2");
  const s3Sub = sheet3.getCell("A2");
  s3Sub.value = `Generated on: ${nowSL} (Sri Jayawardenepura Time)  |  Target Date: ${dateKey}  |  Trigger: ${triggeredBy}`;
  s3Sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  s3Sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  s3Sub.alignment = { horizontal: "center", vertical: "middle" };
  sheet3.getRow(2).height = 24;

  const statHeaders = [
    "Date",
    "Total Orders",
    "Dispensed",
    "Pending",
    "Breakfast",
    "Lunch",
    "Dinner",
    "Full Paid",
    "Half Paid",
    "Not Paid",
    "Dispense Rate"
  ];

  const statHeaderRow = sheet3.addRow(statHeaders);
  statHeaderRow.height = 26;
  statHeaderRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  statHeaderRow.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= statHeaders.length; c++) {
    const cell = statHeaderRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF064E3B" } },
      left: { style: "thin", color: { argb: "FF064E3B" } },
      bottom: { style: "medium", color: { argb: "FF064E3B" } },
      right: { style: "thin", color: { argb: "FF064E3B" } }
    };
  }

  const distinctDates = Array.from(new Set(sortedAll.map(a => a.date).filter(Boolean))).sort().reverse();
  distinctDates.forEach((dKey, idx) => {
    const dayItems = sortedAll.filter(a => a.date === dKey);
    const total = dayItems.length;
    const dispensed = dayItems.filter(a => (a.status || "").toLowerCase() === "received" || (a.status || "").toLowerCase() === "recieved" || a.received).length;
    const pending = total - dispensed;
    const bf = dayItems.filter(a => a.meal_type === "Breakfast").length;
    const lu = dayItems.filter(a => a.meal_type === "Lunch").length;
    const dn = dayItems.filter(a => a.meal_type === "Dinner").length;

    const fp = dayItems.filter(a => getAutoSubsidy(a) === "Full Paid").length;
    const hp = dayItems.filter(a => getAutoSubsidy(a) === "Half Paid").length;
    const np = dayItems.filter(a => getAutoSubsidy(a) === "Not Paid").length;
    const rate = total > 0 ? `${Math.round((dispensed / total) * 100)}%` : "0%";

    const r = sheet3.addRow([
      dKey,
      total,
      dispensed,
      pending,
      bf,
      lu,
      dn,
      fp,
      hp,
      np,
      rate
    ]);
    r.height = 22;
    r.font = { name: "Calibri", size: 10 };
    r.alignment = { horizontal: "center", vertical: "middle" };

    const bgFill = idx % 2 === 1
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    for (let c = 1; c <= statHeaders.length; c++) {
      const cell = r.getCell(c);
      cell.fill = bgFill;
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } }
      };
    }
  });

  sheet3.getColumn(1).width = 16;
  sheet3.getColumn(2).width = 14;
  sheet3.getColumn(3).width = 14;
  sheet3.getColumn(4).width = 14;
  sheet3.getColumn(5).width = 14;
  sheet3.getColumn(6).width = 14;
  sheet3.getColumn(7).width = 14;
  sheet3.getColumn(8).width = 14;
  sheet3.getColumn(9).width = 14;
  sheet3.getColumn(10).width = 14;
  sheet3.getColumn(11).width = 16;

  // ----------------------------------------------------
  // STEP 4: EXPORT BUFFER & UPLOAD TO FIREBASE STORAGE
  // ----------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  let downloadUrl = "";

  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(Buffer.from(buffer), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      metadata: {
        archiveDate: dateKey,
        totalRecords: String(allAllocations.length),
        archivedAt: new Date().toISOString()
      }
    });

    try {
      await file.makePublic();
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    } catch (e) {
      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    }
  } catch (storageErr) {
    console.warn("[Cloud Storage Upload Warning]:", storageErr.message);
  }

  // ----------------------------------------------------
  // STEP 5: FINALIZE METADATA IN FIRESTORE
  // ----------------------------------------------------
  reportMetadata.download_url = downloadUrl;
  reportMetadata.historical_days_included = [prevDay1, prevDay2];
  reportMetadata.historical_records_count = historicalAllocations.length;
  reportMetadata.total_3day_records = allAllocations.length;

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

// 4. Direct Streaming Download of Excel (.xlsx) with 3-Day History
router.get("/download-excel", async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const targetDate = req.query?.date ? formatDateKey(req.query.date) : getYesterdaySriLankaDate();
    const [prevDay1, prevDay2] = getPreviousDaysKeys(targetDate, 2);

    const [snapshot, catSnap, snap1, snap2] = await Promise.all([
      db.collection(MEAL_COLLECTION).where("date", "==", targetDate).get(),
      db.collection("employee_categories").get(),
      db.collection(MEAL_COLLECTION).where("date", "==", prevDay1).get(),
      db.collection(MEAL_COLLECTION).where("date", "==", prevDay2).get()
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

    const targetAllocations = [];
    snapshot.forEach(doc => targetAllocations.push({ id: doc.id, ...doc.data() }));

    const prevAllocs1 = [];
    snap1.forEach(doc => prevAllocs1.push({ id: doc.id, ...doc.data() }));

    const prevAllocs2 = [];
    snap2.forEach(doc => prevAllocs2.push({ id: doc.id, ...doc.data() }));

    const allAllocations = [...targetAllocations, ...prevAllocs1, ...prevAllocs2];
    const nowSL = formatSriLankaDateTime(new Date());

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hayleys Meal Management System API";
    workbook.created = new Date();

    const sheet1 = workbook.addWorksheet(`Daily Archive (${targetDate})`.substring(0, 31));
    populateTransactionsSheet(sheet1, {
      allocations: targetAllocations,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE (${targetDate})`,
      subtitle: `Archive Date: ${targetDate}  |  Generated on: ${nowSL}  |  Total Entries: ${targetAllocations.length}`,
      catMap
    });

    const sheet2 = workbook.addWorksheet("3-Day Historical Review");
    const sortedAll = [...allAllocations].sort((a, b) => {
      const dComp = (b.date || "").localeCompare(a.date || "");
      if (dComp !== 0) return dComp;
      return (a.employee_name || "").localeCompare(b.employee_name || "");
    });

    populateTransactionsSheet(sheet2, {
      allocations: sortedAll,
      title: `HAYLEYS ECO SOLUTIONS - 3-DAY HISTORICAL ALLOCATIONS REPORT`,
      subtitle: `Includes Target Date (${targetDate}) + 2 Previous Days (${prevDay1}, ${prevDay2})  |  Generated on: ${nowSL}`,
      catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Daily_Meal_Allocations_${targetDate}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.byteLength);

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("[Download Excel Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  archiveDailyAllocations
};
