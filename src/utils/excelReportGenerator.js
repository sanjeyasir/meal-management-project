import ExcelJS from "exceljs";
import { formatSriLankaDateTime, getSriLankaNowFormatted } from "./timeUtils";
import { normalizePaymentType, getCategories } from "../services/firebase/categoryService";

/**
 * Helper to populate a standard meal transactions worksheet
 */
function populateTransactionsSheet(worksheet, {
  allocations = [],
  title = "MEAL MANAGEMENT SYSTEM - ALLOCATIONS TRANSACTION REPORT",
  subtitle = "",
  catMap = {}
}) {
  // Freeze top 3 rows
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
    "Full Name",
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

  // Style header cells
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

  // 4. Data Rows
  allocations.forEach((item, index) => {
    const createdAtFormatted = formatSriLankaDateTime(item.created_at);
    const receivedAtFormatted = formatSriLankaDateTime(item.received_at);

    const isRecv =
      (item.status || "").toLowerCase() === "recieved" ||
      (item.status || "").toLowerCase() === "received" ||
      item.received === true;

    const categoryName = item.category_name || item.category_employment || item.employee_category || "Staff";
    const masterSubsidy = catMap[categoryName.toLowerCase()] || item.pay_category || item.configuration_detail;
    const normalizedPayment = normalizePaymentType(masterSubsidy);

    const row = worksheet.addRow([
      item.date || "-",
      item.employee_id || item.emp_id || "-",
      item.employee_name || item.name || "-",
      item.company || "Hayleys Eco Solutions",
      categoryName,
      normalizedPayment,
      item.meal_type || "-",
      isRecv ? "Received" : "Ordered",
      createdAtFormatted,
      receivedAtFormatted
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

    const payCell = row.getCell(6);
    if (normalizedPayment === "Full Paid") {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
    } else if (normalizedPayment === "Half Paid") {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFD97706" } };
    } else {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFDC2626" } };
    }

    const statusCell = row.getCell(8);
    if (isRecv) {
      statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
    } else {
      statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF2563EB" } };
    }
  });

  worksheet.autoFilter = `A3:J${Math.max(3, allocations.length + 3)}`;
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 16;
  worksheet.getColumn(3).width = 26;
  worksheet.getColumn(4).width = 28;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 20;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 14;
  worksheet.getColumn(9).width = 26;
  worksheet.getColumn(10).width = 26;
}

/**
 * Generate a comprehensive multi-tab Excel Workbook:
 * - Tab 1: Target Daily Allocations
 * - Tab 2: 3-Day Historical Review (Target Day + 2 Previous Days if present)
 * - Tab 3: Daily Summary & Aggregate Statistics
 */
export async function buildMealReportWorkbook({
  allocations = [],
  targetAllocations = null,
  historicalAllocations = null,
  targetDate = null,
  title = "HAYLEYS ECO SOLUTIONS - DAILY MEAL ALLOCATIONS ARCHIVE REPORT",
  dateRangeStr = "Daily Archive",
  generatedBy = "System Administrator",
  categoryMap = null
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System";
  workbook.created = new Date();

  // Load master categories if not passed
  let catMap = categoryMap;
  if (!catMap) {
    try {
      const cats = await getCategories();
      catMap = {};
      cats.forEach((c) => {
        if (c.category_name) {
          catMap[c.category_name.toLowerCase()] = c.configuration_detail;
        }
      });
    } catch (e) {
      catMap = {};
    }
  }

  // Determine Target Day Allocations and 3-Day All Allocations
  let targetList = targetAllocations;
  let allList = allocations;

  if (targetDate && !targetList) {
    targetList = allocations.filter(a => a.date === targetDate);
  } else if (!targetList) {
    targetList = allocations;
  }

  const effectiveTargetDate = targetDate || (targetList[0]?.date) || "Target Date";
  const sriLankaNow = getSriLankaNowFormatted();

  // ----------------------------------------------------
  // SHEET 1: Daily Allocations for Target Date
  // ----------------------------------------------------
  const sheet1Name = `Daily Archive (${effectiveTargetDate})`.substring(0, 31);
  const sheet1 = workbook.addWorksheet(sheet1Name);
  populateTransactionsSheet(sheet1, {
    allocations: targetList,
    title: `HAYLEYS ECO SOLUTIONS - DAILY ALLOCATIONS ARCHIVE (${effectiveTargetDate})`,
    subtitle: `Archive Date: ${effectiveTargetDate}  |  Generated on: ${sriLankaNow} (Sri Jayawardenepura Time)  |  By: ${generatedBy}  |  Total Entries: ${targetList.length}`,
    catMap
  });

  // ----------------------------------------------------
  // SHEET 2: 3-Day Historical Review (Target Day + 2 Previous Days)
  // ----------------------------------------------------
  const sheet2 = workbook.addWorksheet("3-Day Historical Review");
  // Sort all allocations descending by date, then employee name
  const sortedAll = [...allList].sort((a, b) => {
    const dComp = (b.date || "").localeCompare(a.date || "");
    if (dComp !== 0) return dComp;
    return (a.employee_name || "").localeCompare(b.employee_name || "");
  });

  populateTransactionsSheet(sheet2, {
    allocations: sortedAll,
    title: `HAYLEYS ECO SOLUTIONS - 3-DAY HISTORICAL ALLOCATIONS REPORT`,
    subtitle: `Includes Target Date (${effectiveTargetDate}) + Up to 2 Previous Days  |  Generated on: ${sriLankaNow}  |  Total Records: ${sortedAll.length}`,
    catMap
  });

  // ----------------------------------------------------
  // SHEET 3: 3-Day Summary & Statistics Breakdown
  // ----------------------------------------------------
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
  s3Sub.value = `Generated on: ${sriLankaNow} (Sri Jayawardenepura Time)  |  Target Date: ${effectiveTargetDate}  |  Trigger: ${generatedBy}`;
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

  // Group by distinct dates
  const distinctDates = Array.from(new Set(sortedAll.map(a => a.date).filter(Boolean))).sort().reverse();
  distinctDates.forEach((dKey, idx) => {
    const dayItems = sortedAll.filter(a => a.date === dKey);
    const total = dayItems.length;
    const dispensed = dayItems.filter(a => (a.status || "").toLowerCase() === "received" || (a.status || "").toLowerCase() === "recieved" || a.received).length;
    const pending = total - dispensed;
    const bf = dayItems.filter(a => a.meal_type === "Breakfast").length;
    const lu = dayItems.filter(a => a.meal_type === "Lunch").length;
    const dn = dayItems.filter(a => a.meal_type === "Dinner").length;

    const getSubsidy = (item) => {
      const cat = (item.category_name || item.category_employment || "Staff").trim();
      const masterSubsidy = catMap[cat.toLowerCase()] || item.pay_category || item.configuration_detail;
      return normalizePaymentType(masterSubsidy);
    };

    const fp = dayItems.filter(a => getSubsidy(a) === "Full Paid").length;
    const hp = dayItems.filter(a => getSubsidy(a) === "Half Paid").length;
    const np = dayItems.filter(a => getSubsidy(a) === "Not Paid").length;
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

  return workbook;
}

/**
 * Generate and trigger download of the report in browser
 */
export async function generateTransactionEntriesReport({
  allocations = [],
  targetAllocations = null,
  targetDate = null,
  title = "MEAL MANAGEMENT SYSTEM - ALLOCATIONS TRANSACTION REPORT",
  dateRangeStr = "All Records",
  generatedBy = "System Administrator",
  customFilename = null
}) {
  const workbook = await buildMealReportWorkbook({
    allocations,
    targetAllocations,
    targetDate,
    title,
    dateRangeStr,
    generatedBy
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const cleanDate = targetDate || new Date().toISOString().split("T")[0];
  const filename = customFilename || `Daily_Meal_Allocations_${cleanDate}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return { success: true, filename, buffer };
}

/**
 * Legacy alias for backwards compatibility
 */
export async function generateFormattedMealReport(params) {
  return generateTransactionEntriesReport(params);
}

