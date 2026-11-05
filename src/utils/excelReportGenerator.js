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
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;

  // 2. Subtitle / Metadata Row
  worksheet.mergeCells("A2:K2");
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
    "Meal Count",
    "Status",
    "Ordered Date & Time (Sri Lanka Time)",
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
    const masterSubsidy = item.pay_category || catMap[categoryName.toLowerCase()] || item.configuration_detail;
    const normalizedPayment = normalizePaymentType(masterSubsidy);
    const mealCount = item.quantity || 1;

    const row = worksheet.addRow([
      item.date || "-",
      item.employee_id || item.emp_id || "-",
      item.employee_name || item.name || "-",
      item.company || "Hayleys Eco Solutions",
      categoryName,
      normalizedPayment,
      item.meal_type || "-",
      mealCount,
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
    row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };

    const payCell = row.getCell(6);
    if (normalizedPayment === "Full Paid") {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
    } else if (normalizedPayment === "Half Paid") {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFD97706" } };
    } else {
      payCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFDC2626" } };
    }

    const countCell = row.getCell(8);
    countCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };

    const statusCell = row.getCell(9);
    if (isRecv) {
      statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
    } else {
      statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF2563EB" } };
    }
  });

  worksheet.autoFilter = `A3:K${Math.max(3, allocations.length + 3)}`;
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 16;
  worksheet.getColumn(3).width = 26;
  worksheet.getColumn(4).width = 28;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 20;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 14;
  worksheet.getColumn(9).width = 14;
  worksheet.getColumn(10).width = 26;
  worksheet.getColumn(11).width = 26;
}

/**
 * Generate a comprehensive daily Excel Workbook (Only Current Target Date):
 * - Tab 1: Daily Archive (Target Date Allocations)
 * - Tab 2: Summary & Statistics (Target Date Breakdown)
 */
export async function buildMealReportWorkbook({
  allocations = [],
  targetAllocations = null,
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

  // Determine Target Day Allocations (Only current date)
  let targetList = targetAllocations;
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
  // SHEET 2: Daily Summary & Statistics Breakdown
  // ----------------------------------------------------
  const sheet2 = workbook.addWorksheet("Summary & Statistics");
  sheet2.views = [{ showGridLines: true, state: "frozen", ySplit: 3 }];

  sheet2.mergeCells("A1:K1");
  const s2Title = sheet2.getCell("A1");
  s2Title.value = `HAYLEYS ECO SOLUTIONS - DAILY SUMMARY & METRICS (${effectiveTargetDate})`;
  s2Title.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  s2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  s2Title.alignment = { horizontal: "center", vertical: "middle" };
  sheet2.getRow(1).height = 34;

  sheet2.mergeCells("A2:K2");
  const s2Sub = sheet2.getCell("A2");
  s2Sub.value = `Generated on: ${sriLankaNow} (Sri Jayawardenepura Time)  |  Target Date: ${effectiveTargetDate}  |  Trigger: ${generatedBy}`;
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

  const total = targetList.length;
  const dispensed = targetList.filter(a => (a.status || "").toLowerCase() === "received" || (a.status || "").toLowerCase() === "recieved" || a.received).length;
  const pending = total - dispensed;
  const bf = targetList.filter(a => a.meal_type === "Breakfast").length;
  const lu = targetList.filter(a => a.meal_type === "Lunch").length;
  const dn = targetList.filter(a => a.meal_type === "Dinner").length;

  const getSubsidy = (item) => {
    const cat = (item.category_name || item.category_employment || "Staff").trim();
    const masterSubsidy = catMap[cat.toLowerCase()] || item.pay_category || item.configuration_detail;
    return normalizePaymentType(masterSubsidy);
  };

  const fp = targetList.filter(a => getSubsidy(a) === "Full Paid").length;
  const hp = targetList.filter(a => getSubsidy(a) === "Half Paid").length;
  const np = targetList.filter(a => getSubsidy(a) === "Not Paid").length;
  const rate = total > 0 ? `${Math.round((dispensed / total) * 100)}%` : "0%";

  const r = sheet2.addRow([
    effectiveTargetDate,
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

