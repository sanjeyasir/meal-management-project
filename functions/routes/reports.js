const { Router } = require("express");
const crypto = require("crypto");
const { db, storage, defaultBucketName, getStorageBucket, getOrCreateStorageBucket } = require("../config/firebaseAdmin.js");

const router = Router();
const MEAL_COLLECTION = "meal_allocations";
const ARCHIVED_MEALS_COLLECTION = "archived_meal_allocations";
const ARCHIVE_COLLECTION = "daily_archived_reports";
const STORAGE_FOLDER = "daily_archive_reports";

/**
 * Helper to fetch allocations for a given date across both active and archived collections
 */
async function getAllocationsForDate(dateKey) {
  if (!dateKey) return [];
  const [activeSnap, archivedSnap] = await Promise.all([
    db.collection(MEAL_COLLECTION).where("date", "==", dateKey).get(),
    db.collection(ARCHIVED_MEALS_COLLECTION).where("date", "==", dateKey).get()
  ]);
  const map = new Map();
  archivedSnap.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
  activeSnap.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
  return Array.from(map.values());
}

function formatDateKey(d) {
  if (!d) return "";
  if (typeof d === "string") {
    const clean = d.trim().replace(/^["']|["']$/g, "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    d = new Date(clean);
  }
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return getYesterdaySriLankaDate();
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdaySriLankaDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
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
    let d;
    if (typeof val === "object" && typeof val.toDate === "function") {
      d = val.toDate();
    } else if (typeof val === "object" && typeof val._seconds === "number") {
      d = new Date(val._seconds * 1000);
    } else if (typeof val === "object" && typeof val.seconds === "number") {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
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
  // STEP 1: DUMP TARGET DAY'S DATA INTO ARCHIVED_MEALS_COLLECTION (NO DELETION)
  // ----------------------------------------------------
  const [activeSnap, catSnap] = await Promise.all([
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

  // Perform atomic batch dump: copy into ARCHIVED_MEALS_COLLECTION WITHOUT deleting from live collection
  let dumpedCount = 0;
  if (!activeSnap.empty) {
    const batchSize = 400;
    let batch = db.batch();
    let opCount = 0;

    for (const docSnap of activeSnap.docs) {
      const data = docSnap.data();
      const archiveRef = db.collection(ARCHIVED_MEALS_COLLECTION).doc(docSnap.id);

      batch.set(archiveRef, {
        ...data,
        archived_to_list_at: new Date().toISOString(),
        archived_by: triggeredBy
      }, { merge: true });

      // No deletion: records are dumped into archive and preserved permanently
      opCount++;
      dumpedCount++;

      if (opCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  }

  // Retrieve complete target allocations from the archived list
  const targetAllocations = await getAllocationsForDate(dateKey);

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
    storagePath,
    download_url: "",
    total_allocations: totalAllocations,
    dumped_count: dumpedCount,
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
  // STEP 2: CREATE THE DAILY EXCEL WORKBOOK (ONLY CURRENT ARCHIVE DATE)
  // ----------------------------------------------------
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System Cloud API";
  workbook.created = new Date();

  // Tab 1: Daily Allocations for Current Archive Date
  const sheet1Name = `Daily Archive (${dateKey})`.substring(0, 31);
  const sheet1 = workbook.addWorksheet(sheet1Name);
  populateTransactionsSheet(sheet1, {
    allocations: targetAllocations,
    title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE (${dateKey})`,
    subtitle: `Archive Date: ${dateKey}  |  Archived on: ${nowSL} (Sri Lanka Time)  |  Trigger: ${triggeredBy}  |  Total Entries: ${targetAllocations.length}`,
    catMap
  });

  // Tab 2: Daily Summary & Statistics Breakdown
  const sheet2 = workbook.addWorksheet("Summary & Statistics");
  sheet2.views = [{ showGridLines: true, state: "frozen", ySplit: 3 }];

  sheet2.mergeCells("A1:K1");
  const s2Title = sheet2.getCell("A1");
  s2Title.value = `HAYLEYS ECO SOLUTIONS - DAILY SUMMARY & METRICS (${dateKey})`;
  s2Title.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  s2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  s2Title.alignment = { horizontal: "center", vertical: "middle" };
  sheet2.getRow(1).height = 34;

  sheet2.mergeCells("A2:K2");
  const s2Sub = sheet2.getCell("A2");
  s2Sub.value = `Generated on: ${nowSL} (Sri Lanka Time)  |  Archive Date: ${dateKey}  |  Trigger: ${triggeredBy}`;
  s2Sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  s2Sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  s2Sub.alignment = { horizontal: "center", vertical: "middle" };
  sheet2.getRow(2).height = 24;

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

  const statHeaderRow = sheet2.addRow(statHeaders);
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

  const rate = totalAllocations > 0 ? `${Math.round((dispensedCount / totalAllocations) * 100)}%` : "0%";
  const r = sheet2.addRow([
    dateKey,
    totalAllocations,
    dispensedCount,
    pendingCount,
    breakfastCount,
    lunchCount,
    dinnerCount,
    fullPaidCount,
    halfPaidCount,
    notPaidCount,
    rate
  ]);
  r.height = 24;
  r.font = { name: "Calibri", size: 10 };
  r.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= statHeaders.length; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    cell.border = {
      top: { style: "hair", color: { argb: "FFE2E8F0" } },
      left: { style: "hair", color: { argb: "FFE2E8F0" } },
      bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      right: { style: "hair", color: { argb: "FFE2E8F0" } }
    };
  }

  sheet2.getColumn(1).width = 16;
  sheet2.getColumn(2).width = 14;
  sheet2.getColumn(3).width = 14;
  sheet2.getColumn(4).width = 14;
  sheet2.getColumn(5).width = 14;
  sheet2.getColumn(6).width = 14;
  sheet2.getColumn(7).width = 14;
  sheet2.getColumn(8).width = 14;
  sheet2.getColumn(9).width = 14;
  sheet2.getColumn(10).width = 14;
  sheet2.getColumn(11).width = 16;

  // ----------------------------------------------------
  // STEP 3: EXPORT BUFFER & UPLOAD TO CLOUD OBJECT STORAGE
  // ----------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  let downloadUrl = "";
  let uploadSuccess = false;
  let uploadError = null;
  let bucket = null;

  try {
    bucket = await getOrCreateStorageBucket();
    const file = bucket.file(storagePath);
    const downloadToken = crypto.randomUUID();

    await file.save(Buffer.from(buffer), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      resumable: false,
      metadata: {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          archiveDate: dateKey,
          totalRecords: String(totalAllocations),
          archivedAt: new Date().toISOString()
        }
      }
    });

    try {
      await file.makePublic();
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    } catch (pubErr) {
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10 // 10 years
        });
        downloadUrl = signedUrl;
      } catch (signErr) {
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      }
    }

    uploadSuccess = true;
    console.log(`[Cloud Storage] Successfully generated and stored Excel archive at gs://${bucket.name}/${storagePath}`);
  } catch (storageErr) {
    uploadError = storageErr.message;
    console.error("[Cloud Storage Upload Error]:", storageErr);
  }

  // ----------------------------------------------------
  // STEP 4: FINALIZE METADATA IN FIRESTORE
  // ----------------------------------------------------
  reportMetadata.download_url = downloadUrl;
  reportMetadata.upload_success = uploadSuccess;
  if (bucket && bucket.name) {
    reportMetadata.bucket_name = bucket.name;
  }
  if (uploadError) {
    reportMetadata.storage_error = uploadError;
  }

  await db.collection(ARCHIVE_COLLECTION).doc(dateKey).set(reportMetadata, { merge: true });

  return reportMetadata;
}

/**
 * Cleanup Engine:
 * Deletion functionality for archive records has been decommissioned per business requirement.
 * All archive allocations and reports are permanently preserved.
 */
async function cleanupOldArchivedAllocations(retentionDays = null, triggeredBy = "System") {
  console.log(`[Archive Cleanup - ${triggeredBy}] Deletion of archived records has been removed. All records are permanently preserved.`);
  return {
    success: true,
    deletedCount: 0,
    triggeredBy,
    message: "Archive record deletion is disabled. All archive allocations are permanently preserved."
  };
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

// Delete an archived daily report metadata & its cloud storage file
router.delete("/archive-daily", async (req, res) => {
  try {
    const reportId = (req.query?.id || req.query?.date || req.body?.id || req.body?.date || "").trim();
    if (!reportId) {
      return res.status(400).json({ success: false, error: "Report ID or date is required." });
    }

    // 1. Delete metadata doc from daily_archived_reports
    const docRef = db.collection(ARCHIVE_COLLECTION).doc(reportId);
    const snap = await docRef.get();
    let filename = `Daily_Meal_Allocations_${reportId}.xlsx`;
    let storagePath = `${STORAGE_FOLDER}/${filename}`;

    if (snap.exists) {
      const data = snap.data();
      if (data.filename) filename = data.filename;
      if (data.storage_path) storagePath = data.storage_path;
      if (data.storagePath) storagePath = data.storagePath;
      await docRef.delete();
    } else {
      await docRef.delete();
    }

    // 2. Delete Excel file from Cloud Storage if exists
    try {
      const bucket = getOrCreateStorageBucket();
      if (bucket) {
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
        }
      }
    } catch (storageErr) {
      console.warn(`[Delete Report Storage Warning for ${reportId}]:`, storageErr.message);
    }

    return res.json({
      success: true,
      message: `Archived report for ${reportId} deleted successfully.`
    });
  } catch (error) {
    console.error("[Delete Archive Report Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Direct Streaming Download of Excel (.xlsx) for Target Date
router.get("/download-excel", async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const targetDate = req.query?.date ? formatDateKey(req.query.date) : getYesterdaySriLankaDate();

    const [targetAllocations, catSnap] = await Promise.all([
      getAllocationsForDate(targetDate),
      db.collection("employee_categories").get()
    ]);

    const catMap = {};
    catSnap.forEach((doc) => {
      const data = doc.data();
      if (data.category_name) {
        catMap[data.category_name.toLowerCase()] = data.configuration_detail;
      }
    });

    const nowSL = formatSriLankaDateTime(new Date());
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hayleys Meal Management System API";
    workbook.created = new Date();

    // Tab 1: Daily Allocations for Current Archive Date
    const sheet1 = workbook.addWorksheet(`Daily Archive (${targetDate})`.substring(0, 31));
    populateTransactionsSheet(sheet1, {
      allocations: targetAllocations,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE (${targetDate})`,
      subtitle: `Archive Date: ${targetDate}  |  Generated on: ${nowSL}  |  Total Entries: ${targetAllocations.length}`,
      catMap
    });

    // Tab 2: Daily Summary & Statistics Breakdown
    const sheet2 = workbook.addWorksheet("Summary & Statistics");
    sheet2.views = [{ showGridLines: true, state: "frozen", ySplit: 3 }];

    sheet2.mergeCells("A1:K1");
    const s2Title = sheet2.getCell("A1");
    s2Title.value = `HAYLEYS ECO SOLUTIONS - DAILY SUMMARY & METRICS (${targetDate})`;
    s2Title.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    s2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
    s2Title.alignment = { horizontal: "center", vertical: "middle" };
    sheet2.getRow(1).height = 34;

    sheet2.mergeCells("A2:K2");
    const s2Sub = sheet2.getCell("A2");
    s2Sub.value = `Generated on: ${nowSL} (Sri Lanka Time)  |  Archive Date: ${targetDate}`;
    s2Sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
    s2Sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
    s2Sub.alignment = { horizontal: "center", vertical: "middle" };
    sheet2.getRow(2).height = 24;

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

    const statHeaderRow = sheet2.addRow(statHeaders);
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

    const totalAllocations = targetAllocations.length;
    let dispensedCount = 0;
    let breakfastCount = 0;
    let lunchCount = 0;
    let dinnerCount = 0;
    let fullPaidCount = 0;
    let halfPaidCount = 0;
    let notPaidCount = 0;

    targetAllocations.forEach((item) => {
      const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
      if (isRecv) dispensedCount++;
      const mType = item.meal_type || "Lunch";
      if (mType === "Breakfast") breakfastCount++;
      else if (mType === "Lunch") lunchCount++;
      else if (mType === "Dinner") dinnerCount++;

      const cat = (item.category_name || item.category_employment || item.employee_category || "Staff").trim();
      const masterSubsidy = catMap[cat.toLowerCase()] || item.pay_category || item.configuration_detail;
      const norm = normalizePaymentType(masterSubsidy);
      if (norm === "Full Paid") fullPaidCount++;
      else if (norm === "Half Paid") halfPaidCount++;
      else if (norm === "Not Paid") notPaidCount++;
    });

    const pendingCount = totalAllocations - dispensedCount;
    const rate = totalAllocations > 0 ? `${Math.round((dispensedCount / totalAllocations) * 100)}%` : "0%";

    const r = sheet2.addRow([
      targetDate,
      totalAllocations,
      dispensedCount,
      pendingCount,
      breakfastCount,
      lunchCount,
      dinnerCount,
      fullPaidCount,
      halfPaidCount,
      notPaidCount,
      rate
    ]);
    r.height = 24;
    r.font = { name: "Calibri", size: 10 };
    r.alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= statHeaders.length; c++) {
      const cell = r.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } }
      };
    }

    sheet2.getColumn(1).width = 16;
    sheet2.getColumn(2).width = 14;
    sheet2.getColumn(3).width = 14;
    sheet2.getColumn(4).width = 14;
    sheet2.getColumn(5).width = 14;
    sheet2.getColumn(6).width = 14;
    sheet2.getColumn(7).width = 14;
    sheet2.getColumn(8).width = 14;
    sheet2.getColumn(9).width = 14;
    sheet2.getColumn(10).width = 14;
    sheet2.getColumn(11).width = 16;

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

// 5. Cleanup endpoint (Decommissioned: Deletion is permanently disabled)
router.post("/cleanup-archived", async (req, res) => {
  return res.json({
    success: true,
    message: "Archived records deletion is disabled. All archive allocations are permanently preserved.",
    deletedCount: 0
  });
});

router.get("/cleanup-archived", async (req, res) => {
  return res.json({
    success: true,
    message: "Archived records deletion is disabled. All archive allocations are permanently preserved.",
    deletedCount: 0
  });
});

// 6. Clean test data with company 'Hayleys Eco Solutions'
async function handleCleanTestData(req, res) {
  try {
    const targetCompany = (req.body?.company || req.query?.company || "Hayleys Eco Solutions").trim();
    const dryRun = req.query?.dryRun === "true" || req.body?.dryRun === true;
    const reArchive = req.query?.reArchive !== "false" && req.body?.reArchive !== false;

    const [archivedSnap, liveSnap] = await Promise.all([
      db.collection(ARCHIVED_MEALS_COLLECTION).get(),
      db.collection(MEAL_COLLECTION).get()
    ]);

    const affectedDates = new Set();
    const archivedToDelete = [];
    archivedSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const comp = (data.company || data.company_name || "").toLowerCase().trim();
      if (comp === targetCompany.toLowerCase()) {
        archivedToDelete.push({ id: docSnap.id, date: data.date, ...data });
        if (data.date) affectedDates.add(data.date);
      }
    });

    const liveToDelete = [];
    liveSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const comp = (data.company || data.company_name || "").toLowerCase().trim();
      if (comp === targetCompany.toLowerCase()) {
        liveToDelete.push({ id: docSnap.id, date: data.date, ...data });
        if (data.date) affectedDates.add(data.date);
      }
    });

    if (!dryRun) {
      // Delete in batches from archived_meal_allocations
      if (archivedToDelete.length > 0) {
        let batch = db.batch();
        let count = 0;
        for (const item of archivedToDelete) {
          batch.delete(db.collection(ARCHIVED_MEALS_COLLECTION).doc(item.id));
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }

      // Delete in batches from meal_allocations
      if (liveToDelete.length > 0) {
        let batch = db.batch();
        let count = 0;
        for (const item of liveToDelete) {
          batch.delete(db.collection(MEAL_COLLECTION).doc(item.id));
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }

      // Re-generate archives for affected dates
      const reArchivedDates = [];
      if (reArchive) {
        for (const dKey of affectedDates) {
          try {
            await archiveDailyAllocations(dKey, "Clean Test Data Refresh");
            reArchivedDates.push(dKey);
          } catch (rErr) {
            console.warn(`[Re-archive error for ${dKey}]:`, rErr.message);
          }
        }
      }

      return res.json({
        success: true,
        dryRun: false,
        targetCompany,
        deletedFromArchived: archivedToDelete.length,
        deletedFromLive: liveToDelete.length,
        affectedDates: Array.from(affectedDates),
        reArchivedDates,
        sampleArchivedDeleted: archivedToDelete.slice(0, 5).map(d => ({ id: d.id, date: d.date, name: d.employee_name || d.name, empId: d.employee_id })),
        sampleLiveDeleted: liveToDelete.slice(0, 5).map(d => ({ id: d.id, date: d.date, name: d.employee_name || d.name, empId: d.employee_id }))
      });
    }

    return res.json({
      success: true,
      dryRun: true,
      targetCompany,
      foundInArchived: archivedToDelete.length,
      foundInLive: liveToDelete.length,
      affectedDates: Array.from(affectedDates),
      sampleArchived: archivedToDelete.slice(0, 5).map(d => ({ id: d.id, date: d.date, name: d.employee_name || d.name, empId: d.employee_id })),
      sampleLive: liveToDelete.slice(0, 5).map(d => ({ id: d.id, date: d.date, name: d.employee_name || d.name, empId: d.employee_id }))
    });
  } catch (error) {
    console.error("[Clean Test Data Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

router.post("/clean-test-data", handleCleanTestData);
router.get("/clean-test-data", handleCleanTestData);

module.exports = {
  router,
  archiveDailyAllocations,
  cleanupOldArchivedAllocations,
  getAllocationsForDate,
  ARCHIVED_MEALS_COLLECTION
};
