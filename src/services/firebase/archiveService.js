import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import { getMealAllocations, getMealAllocationsWithArchived, formatDateKey } from "./mealService";
import { buildMealReportWorkbook } from "../../utils/excelReportGenerator";
import { normalizePaymentType, getCategories } from "./categoryService";
import { getSriLankaNowFormatted } from "../../utils/timeUtils";

const ARCHIVE_COLLECTION = "daily_archived_reports";
const STORAGE_FOLDER = "daily_archive_reports";
const API_BASE_URL = "https://us-central1-meal-management-project.cloudfunctions.net/api";

/**
 * Get yesterday's date formatted as YYYY-MM-DD in Sri Lanka time (Asia/Colombo)
 */
export function getYesterdayDateKey() {
  const now = new Date();
  const slDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  slDate.setDate(slDate.getDate() - 1);
  return formatDateKey(slDate);
}

/**
 * Get preceding date keys (e.g. 2 days prior to targetDateKey)
 */
export function getPreviousDaysKeys(targetDateKey, count = 2) {
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
 * 
 * REQUIRED WORKFLOW:
 * 1. At 12 AM / Trigger: First archive target day's information to a list in Firestore ('daily_archived_reports').
 * 2. Generate the daily Excel (.xlsx) file containing:
 *    - Sheet 1: Target Day Transactions
 *    - Sheet 2: Daily Summary & Statistics Breakdown
 * 3. Archive/upload to Storage via server-side Cloud Function & finalize metadata in Firestore.
 */
export async function archiveDailyAllocationsForDate(targetDateStr = null, triggeredBy = "System Automated (12:00 AM)") {
  const dateKey = targetDateStr ? formatDateKey(targetDateStr) : getYesterdayDateKey();
  const filename = `Daily_Meal_Allocations_${dateKey}.xlsx`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;

  try {
    // ----------------------------------------------------
    // STEP 1: ARCHIVE THE TARGET DAY'S DATA TO THE LIST FIRST
    // ----------------------------------------------------
    const targetAllocations = await getMealAllocationsWithArchived({ date: dateKey });

    const totalAllocations = targetAllocations.length;
    const dispensedCount = targetAllocations.filter(
      a => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received" || a.received
    ).length;
    const pendingCount = totalAllocations - dispensedCount;

    const breakfastCount = targetAllocations.filter(a => a.meal_type === "Breakfast").length;
    const lunchCount = targetAllocations.filter(a => a.meal_type === "Lunch").length;
    const dinnerCount = targetAllocations.filter(a => a.meal_type === "Dinner").length;

    // Load master categories for subsidy resolution
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

    const fullPaidCount = targetAllocations.filter(a => getSubsidy(a) === "Full Paid").length;
    const halfPaidCount = targetAllocations.filter(a => getSubsidy(a) === "Half Paid").length;
    const notPaidCount = targetAllocations.filter(a => getSubsidy(a) === "Not Paid").length;

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
      archived_at_formatted: getSriLankaNowFormatted(),
      archived_by: triggeredBy
    };

    const docRef = doc(db, ARCHIVE_COLLECTION, dateKey);
    await setDoc(docRef, reportMetadata, { merge: true });

    // ----------------------------------------------------
    // STEP 2: CREATE THE DAILY EXCEL WORKBOOK (ONLY TARGET DATE)
    // ----------------------------------------------------
    const workbook = await buildMealReportWorkbook({
      allocations: targetAllocations,
      targetAllocations,
      targetDate: dateKey,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE REPORT (${dateKey})`,
      dateRangeStr: `${dateKey}`,
      generatedBy: triggeredBy,
      categoryMap: catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // ----------------------------------------------------
    // STEP 3: ARCHIVE TO STORAGE ON SERVER & FINALIZE METADATA
    // ----------------------------------------------------
    let downloadUrl = "";

    try {
      const apiResp = await fetch(`${API_BASE_URL}/reports/archive-daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, triggeredBy })
      });
      if (apiResp.ok) {
        const apiData = await apiResp.json();
        if (apiData.archive?.download_url) {
          downloadUrl = apiData.archive.download_url;
        }
      }
    } catch (apiErr) {
      console.warn("Cloud Functions API archive sync note:", apiErr.message);
    }

    reportMetadata.download_url = downloadUrl;

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
 * Download an archived report directly
 * Uses preserved Cloud Storage object URL if available, with client-side ExcelJS fallback
 */
export async function downloadArchivedReport(report) {
  if (!report) return;

  const dateKey = formatDateKey(report.date || report.id);
  const filename = report.filename || `Daily_Meal_Allocations_${dateKey}.xlsx`;

  // 1. If Cloud Storage download URL is available, trigger direct download
  if (report.download_url && typeof report.download_url === "string" && report.download_url.startsWith("http")) {
    try {
      const a = document.createElement("a");
      a.href = report.download_url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true };
    } catch (e) {
      console.warn("Direct storage download fallback:", e);
    }
  }

  // 2. Client-side fallback generator from preserved Firestore archive data (Only Target Date)
  try {
    const [targetAllocations, cats] = await Promise.all([
      getMealAllocationsWithArchived({ date: dateKey }),
      getCategories().catch(() => [])
    ]);

    const catMap = {};
    cats.forEach((c) => {
      if (c.category_name) {
        catMap[c.category_name.toLowerCase()] = c.configuration_detail;
      }
    });

    const workbook = await buildMealReportWorkbook({
      allocations: targetAllocations,
      targetAllocations,
      targetDate: dateKey,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE REPORT (${dateKey})`,
      dateRangeStr: `${dateKey}`,
      generatedBy: "Web App Download",
      categoryMap: catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
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
 * Delete an archived daily report doc and its Storage file
 */
export async function deleteArchivedReport(dateOrId) {
  try {
    const cleanId = String(dateOrId || "").trim();
    if (!cleanId) return { success: false, error: "Report ID or date is required." };

    // 1. Delete from Firestore daily_archived_reports
    const docRef = doc(db, ARCHIVE_COLLECTION, cleanId);
    await deleteDoc(docRef);

    // 2. Delete Excel file from Firebase Storage
    try {
      const storageRef = ref(storage, `${STORAGE_FOLDER}/Daily_Meal_Allocations_${cleanId}.xlsx`);
      await deleteObject(storageRef);
    } catch (storageErr) {
      // Storage file might already be removed or direct bucket path
    }

    // 3. Notify backend API to clean storage bucket
    try {
      await fetch(`${API_BASE_URL}/reports/archive-daily?id=${encodeURIComponent(cleanId)}`, {
        method: "DELETE"
      });
    } catch (apiErr) {
      console.warn("Backend storage delete notice:", apiErr.message);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting archived report:", error);
    throw error;
  }
}

/**
 * Cleanup / deletion is permanently disabled per business requirements.
 */
export async function triggerArchivedCleanup(retentionDays = 2, triggeredBy = "Admin Console") {
  console.warn("triggerArchivedCleanup is disabled. Archive records are permanently preserved.");
  return { success: true, message: "Archive record deletion is disabled. All records are permanently preserved." };
}
