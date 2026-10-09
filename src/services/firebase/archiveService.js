import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./config";
import { getMealAllocations, formatDateKey } from "./mealService";
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
 * 2. In that same flow, take the 2 days previous meals if present from the allocations store.
 * 3. Generate the 3-day multi-tab Excel (.xlsx) file containing:
 *    - Sheet 1: Target Day Transactions
 *    - Sheet 2: 3-Day Historical Review (Target Day + 2 Previous Days)
 *    - Sheet 3: 3-Day Summary & Statistics Breakdown
 * 4. Archive/upload to Storage via server-side Cloud Function & finalize metadata in Firestore.
 */
export async function archiveDailyAllocationsForDate(targetDateStr = null, triggeredBy = "System Automated (12:00 AM)") {
  const dateKey = targetDateStr ? formatDateKey(targetDateStr) : getYesterdayDateKey();
  const filename = `Daily_Meal_Allocations_${dateKey}.xlsx`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;

  try {
    // ----------------------------------------------------
    // STEP 1: ARCHIVE THE TARGET DAY'S DATA TO THE LIST FIRST
    // ----------------------------------------------------
    const targetAllocations = await getMealAllocations({ date: dateKey });

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
    // STEP 2: IN THE SAME FLOW, TAKE THE 2 PREVIOUS DAYS MEALS IF PRESENT
    // ----------------------------------------------------
    const [prevDay1, prevDay2] = getPreviousDaysKeys(dateKey, 2);
    
    const [prevAllocs1, prevAllocs2] = await Promise.all([
      getMealAllocations({ date: prevDay1 }),
      getMealAllocations({ date: prevDay2 })
    ]);

    const historicalAllocations = [...prevAllocs1, ...prevAllocs2];
    const allAllocations = [...targetAllocations, ...historicalAllocations];

    // ----------------------------------------------------
    // STEP 3: CREATE THE 3-DAY EXCEL WORKBOOK
    // ----------------------------------------------------
    const workbook = await buildMealReportWorkbook({
      allocations: allAllocations,
      targetAllocations,
      targetDate: dateKey,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE REPORT (${dateKey})`,
      dateRangeStr: `${dateKey} (Includes up to 2 previous days: ${prevDay1}, ${prevDay2})`,
      generatedBy: triggeredBy,
      categoryMap: catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // ----------------------------------------------------
    // STEP 4: ARCHIVE TO STORAGE ON SERVER & FINALIZE METADATA
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
    reportMetadata.historical_days_included = [prevDay1, prevDay2];
    reportMetadata.historical_records_count = historicalAllocations.length;
    reportMetadata.total_3day_records = allAllocations.length;

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
 * Download an archived report directly without CORS errors
 * Uses client-side in-memory ExcelJS generator with Target Day + 2 Previous Days meals
 */
export async function downloadArchivedReport(report) {
  if (!report) return;

  const dateKey = formatDateKey(report.date || report.id);
  const filename = report.filename || `Daily_Meal_Allocations_${dateKey}.xlsx`;

  try {
    // 1. Fetch Target Day allocations + 2 Previous Days allocations from Firestore (CORS-free)
    const [prevDay1, prevDay2] = getPreviousDaysKeys(dateKey, 2);

    const [targetAllocations, prevAllocs1, prevAllocs2, cats] = await Promise.all([
      getMealAllocations({ date: dateKey }),
      getMealAllocations({ date: prevDay1 }),
      getMealAllocations({ date: prevDay2 }),
      getCategories().catch(() => [])
    ]);

    const catMap = {};
    cats.forEach((c) => {
      if (c.category_name) {
        catMap[c.category_name.toLowerCase()] = c.configuration_detail;
      }
    });

    const historicalAllocations = [...prevAllocs1, ...prevAllocs2];
    const allAllocations = [...targetAllocations, ...historicalAllocations];

    // 2. Build multi-tab 3-day workbook directly in the browser
    const workbook = await buildMealReportWorkbook({
      allocations: allAllocations,
      targetAllocations,
      targetDate: dateKey,
      title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE REPORT (${dateKey})`,
      dateRangeStr: `${dateKey} (Includes up to 2 previous days: ${prevDay1}, ${prevDay2})`,
      generatedBy: "Web App Download",
      categoryMap: catMap
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    // 3. Trigger seamless direct client download
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
 * Delete an archived daily report doc from Firestore
 */
export async function deleteArchivedReport(dateStr) {
  try {
    const cleanDate = formatDateKey(dateStr);
    const docRef = doc(db, ARCHIVE_COLLECTION, cleanDate);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting archived report:", error);
    throw error;
  }
}
