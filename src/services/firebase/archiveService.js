import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import { getMealAllocations, formatDateKey } from "./mealService";
import { buildMealReportWorkbook } from "../../utils/excelReportGenerator";
import { normalizePaymentType, getCategories } from "./categoryService";
import { formatSriLankaDateTime, getSriLankaNowFormatted } from "../../utils/timeUtils";

const ARCHIVE_COLLECTION = "daily_archived_reports";
const STORAGE_FOLDER = "daily_archive_reports";

/**
 * Get yesterday's date formatted as YYYY-MM-DD in Sri Lanka time
 */
export function getYesterdayDateKey() {
  const now = new Date();
  // Adjust to Sri Lanka time UTC+5:30
  const slDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  slDate.setDate(slDate.getDate() - 1);
  return formatDateKey(slDate);
}

/**
 * Fetch list of all daily archived reports from Firestore
 */
export async function getArchivedDailyReports(filters = {}) {
  try {
    const colRef = collection(db, ARCHIVE_COLLECTION);
    const snapshot = await getDocs(colRef);
    
    let list = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Date range filtering
    if (filters.startDate && filters.endDate) {
      const start = formatDateKey(filters.startDate);
      const end = formatDateKey(filters.endDate);
      list = list.filter(r => r.date >= start && r.date <= end);
    } else if (filters.startDate) {
      const start = formatDateKey(filters.startDate);
      list = list.filter(r => r.date >= start);
    }

    // Sort descending by date (newest first)
    return list.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error("Error fetching archived daily reports:", error);
    return [];
  }
}

/**
 * Fetch single archived daily report metadata
 */
export async function getArchivedReportByDate(dateStr) {
  try {
    const cleanDate = formatDateKey(dateStr);
    const docRef = doc(db, ARCHIVE_COLLECTION, cleanDate);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting archived report by date:", error);
    return null;
  }
}

/**
 * Archive Previous Day's Allocations (or any designated date)
 * 1. Queries allocations for that date
 * 2. Compiles statistics
 * 3. Generates Excel (.xlsx) with clean formatting (no allocation id, category & payment types)
 * 4. Uploads to Firebase Storage
 * 5. Saves metadata into Firestore collection 'daily_archived_reports'
 */
export async function archiveDailyAllocationsForDate(targetDateStr = null, triggeredBy = "System Automated (12:00 AM)") {
  const dateKey = targetDateStr ? formatDateKey(targetDateStr) : getYesterdayDateKey();
  const filename = `Daily_Meal_Allocations_${dateKey}.xlsx`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;

  try {
    // 1. Fetch all allocations for this date
    const allocations = await getMealAllocations({ date: dateKey });

    // 2. Compute aggregate metrics
    const totalAllocations = allocations.length;
    const dispensedCount = allocations.filter(
      a => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received"
    ).length;
    const pendingCount = totalAllocations - dispensedCount;

    const breakfastCount = allocations.filter(a => a.meal_type === "Breakfast").length;
    const lunchCount = allocations.filter(a => a.meal_type === "Lunch").length;
    const dinnerCount = allocations.filter(a => a.meal_type === "Dinner").length;

    // Load master categories for dynamic subsidy resolution
    let catMap = {};
    try {
      const cats = await getCategories();
      cats.forEach((c) => {
        if (c.category_name) {
          catMap[c.category_name.toLowerCase()] = c.configuration_detail;
        }
      });
    } catch (e) {
      catMap = {};
    }

    const getSubsidy = (a) => {
      const cat = (a.category_name || a.category_employment || a.employee_category || "Staff").trim();
      const masterSubsidy = catMap[cat.toLowerCase()] || a.pay_category || a.configuration_detail;
      return normalizePaymentType(masterSubsidy);
    };

    const fullPaidCount = allocations.filter(a => getSubsidy(a) === "Full Paid").length;
    const halfPaidCount = allocations.filter(a => getSubsidy(a) === "Half Paid").length;
    const notPaidCount = allocations.filter(a => getSubsidy(a) === "Not Paid").length;

    // 3. Build formatted Excel Workbook
    const workbook = await buildMealReportWorkbook({
      allocations,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE REPORT (${dateKey})`,
      dateRangeStr: `Daily Archive: ${dateKey}`,
      generatedBy: triggeredBy,
      categoryMap: catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const uint8Array = new Uint8Array(buffer);

    // 4. Upload to Firebase Storage
    let downloadUrl = "";
    try {
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, uint8Array, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        customMetadata: {
          archiveDate: dateKey,
          totalRecords: String(totalAllocations),
          archivedAt: new Date().toISOString()
        }
      });
      downloadUrl = await getDownloadURL(uploadResult.ref);
    } catch (storageErr) {
      console.warn("Storage upload notice (continuing with metadata recording):", storageErr);
    }

    // 5. Save metadata into Firestore
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
      archived_at_formatted: getSriLankaNowFormatted(),
      archived_by: triggeredBy
    };

    const docRef = doc(db, ARCHIVE_COLLECTION, dateKey);
    await setDoc(docRef, reportMetadata, { merge: true });

    return {
      success: true,
      report: reportMetadata,
      buffer
    };
  } catch (error) {
    console.error(`Error archiving daily allocations for ${dateKey}:`, error);
    throw error;
  }
}

/**
 * Trigger download of an archived report for the user
 */
export async function downloadArchivedReport(report) {
  if (!report) return;

  try {
    if (report.download_url) {
      // Download directly from Firebase Storage URL
      const a = document.createElement("a");
      a.href = report.download_url;
      a.target = "_blank";
      a.download = report.filename || `Daily_Meal_Allocations_${report.date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true };
    }

    // Fallback: Generate on-the-fly and download
    const res = await archiveDailyAllocationsForDate(report.date, "Client Export");
    const blob = new Blob([res.buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.filename || `Daily_Meal_Allocations_${report.date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error("Error downloading archived report:", err);
    throw err;
  }
}

/**
 * Delete an archived daily report doc and storage file
 */
export async function deleteArchivedReport(dateStr) {
  try {
    const cleanDate = formatDateKey(dateStr);
    const docRef = doc(db, ARCHIVE_COLLECTION, cleanDate);
    await deleteDoc(docRef);

    try {
      const storageRef = ref(storage, `${STORAGE_FOLDER}/Daily_Meal_Allocations_${cleanDate}.xlsx`);
      await deleteObject(storageRef);
    } catch (e) {
      // Storage file might already be absent
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting archived report:", error);
    throw error;
  }
}
