import ExcelJS from "exceljs";
import { getCategoryByName, normalizePaymentType } from "../services/firebase/categoryService";
import { db } from "../services/firebase/config";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";

/**
 * Utility to trigger a browser file download from a Blob
 */
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Generate and download an interactive Excel template with drop-down lists for Categories and Companies
 * @param {Array} categories Master categories from Firestore
 * @param {Array} companies Master companies from Firestore
 */
export async function downloadEmployeeTemplate(categories = [], companies = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System";
  workbook.created = new Date();

  const categoryList = categories.map((c) => c.category_name).filter(Boolean);
  const companyList = companies.map((c) => c.name).filter(Boolean);

  const finalCats = categoryList.length > 0 ? categoryList : ["Executive", "Staff", "Worker", "Contractor", "Visitor"];
  const finalComps = companyList.length > 0 ? companyList : ["Hayleys Eco Solutions", "Hayleys Fibre Plant 1", "Hayleys Agriculture", "Hayleys Advantis Logistics"];

  // Sheet 1: Main Import Sheet
  const worksheet = workbook.addWorksheet("Employees_Import", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 1 }]
  });

  const headers = [
    "Employee ID",
    "Full Name",
    "Designation",
    "Meal Category",
    "Company"
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 30;
  headerRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF064E3B" } },
      left: { style: "thin", color: { argb: "FF064E3B" } },
      bottom: { style: "medium", color: { argb: "FF064E3B" } },
      right: { style: "thin", color: { argb: "FF064E3B" } }
    };
  }

  // Column Widths
  worksheet.getColumn(1).width = 18; // Employee ID
  worksheet.getColumn(2).width = 28; // Full Name
  worksheet.getColumn(3).width = 26; // Designation
  worksheet.getColumn(4).width = 22; // Meal Category
  worksheet.getColumn(5).width = 30; // Company

  // Sample Demo Rows
  const sampleRows = [
    ["EMP001", "Sanjey Asirvatham", "Quality Assurance Lead", finalCats[1] || "Staff", finalComps[0] || "Hayleys Eco Solutions"],
    ["EMP002", "Kasun Perera", "Production Supervisor", finalCats[2] || "Worker", finalComps[1] || "Hayleys Fibre Plant 1"],
    ["EMP003", "Anura Kumara", "Plant General Manager", finalCats[0] || "Executive", finalComps[0] || "Hayleys Eco Solutions"]
  ];

  sampleRows.forEach((rowValues) => {
    const r = worksheet.addRow(rowValues);
    r.height = 22;
    r.font = { name: "Calibri", size: 10 };
    r.alignment = { vertical: "middle" };
  });

  // Generate direct inline quoted list for reliable in-cell dropdowns across all Excel viewers
  const catListStr = `"${finalCats.map((c) => String(c).replace(/["\r\n]/g, "").trim()).filter(Boolean).join(",")}"`;
  const compListStr = `"${finalComps.map((c) => String(c).replace(/["\r\n]/g, "").trim()).filter(Boolean).join(",")}"`;

  // Set Data Validation Dropdowns for rows 2 through 500
  for (let rowIdx = 2; rowIdx <= 500; rowIdx++) {
    const catCell = worksheet.getCell(`D${rowIdx}`);
    catCell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [catListStr],
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: "Please select a valid Meal Category from the dropdown list."
    };

    const compCell = worksheet.getCell(`E${rowIdx}`);
    compCell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [compListStr],
      showErrorMessage: true,
      errorTitle: "Invalid Company",
      error: "Please select a valid Company from the dropdown list."
    };
  }

  // Export buffer & download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  downloadBlob(blob, "Employee_Import_Template.xlsx");
}

/**
 * Export current employees directory to Excel
 */
export async function exportEmployeesToExcel(employees = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hayleys Meal Management System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Employees Directory", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 1 }]
  });

  const headers = [
    "Employee ID",
    "Full Name",
    "Designation",
    "Meal Category",
    "Subsidy / Payment Plan",
    "Company / Plant"
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
  }

  worksheet.getColumn(1).width = 18;
  worksheet.getColumn(2).width = 28;
  worksheet.getColumn(3).width = 24;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 22;
  worksheet.getColumn(6).width = 30;

  employees.forEach((emp, index) => {
    const normPay = normalizePaymentType(emp.pay_category || emp.category_employment);
    const row = worksheet.addRow([
      emp.employee_id || emp.id || "-",
      emp.name || "-",
      emp.designation || "-",
      emp.category_employment || emp.category_name || "Staff",
      normPay,
      emp.company || "Hayleys Eco Solutions"
    ]);
    row.height = 22;
    row.font = { name: "Calibri", size: 10 };
    row.alignment = { vertical: "middle" };

    if (index % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `Employees_Directory_${dateStr}.xlsx`);
}

/**
 * Parse an uploaded Excel file for employee registration
 * @param {File} file Uploaded file object
 * @returns {Promise<{ validEmployees: Array, errors: Array }>}
 */
export async function parseEmployeeExcelUpload(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet("Employees_Import") || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Could not find a valid worksheet in the uploaded Excel file.");
  }

  const validEmployees = [];
  const errors = [];
  const seenIds = new Set();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const empId = String(row.getCell(1).text || "").trim();
    const name = String(row.getCell(2).text || "").trim();
    const designation = String(row.getCell(3).text || "").trim() || "Staff";
    const category = String(row.getCell(4).text || "").trim() || "Staff";
    const company = String(row.getCell(5).text || "").trim() || "Hayleys Eco Solutions";

    // Ignore empty blank rows
    if (!empId && !name) return;

    if (!empId) {
      errors.push(`Row ${rowNumber}: Missing Employee ID.`);
      return;
    }

    if (!name) {
      errors.push(`Row ${rowNumber}: Missing Full Name for Employee ID '${empId}'.`);
      return;
    }

    if (seenIds.has(empId.toLowerCase())) {
      errors.push(`Row ${rowNumber}: Duplicate Employee ID '${empId}' found within the file.`);
      return;
    }

    seenIds.add(empId.toLowerCase());

    validEmployees.push({
      employee_id: empId,
      name,
      designation,
      category_employment: category,
      category_name: category,
      company
    });
  });

  return { validEmployees, errors };
}

/**
 * Batch save parsed employee records into Firestore
 */
export async function batchSaveEmployees(employeeList = []) {
  if (!employeeList.length) return { savedCount: 0 };

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const emp of employeeList) {
    const cleanId = String(emp.employee_id).trim();
    const categoryConfig = await getCategoryByName(emp.category_employment || "Staff");
    const normalizedSubsidy = categoryConfig?.configuration_detail
      ? normalizePaymentType(categoryConfig.configuration_detail)
      : normalizePaymentType(emp.category_employment || "Full Paid");

    const docRef = doc(db, "employees", cleanId);
    batch.set(
      docRef,
      {
        id: cleanId,
        employee_id: cleanId,
        emp_id: cleanId,
        name: emp.name,
        full_name: emp.name,
        designation: emp.designation || "Staff",
        company: emp.company || "Hayleys Eco Solutions",
        category_employment: emp.category_employment || "Staff",
        category_name: emp.category_employment || "Staff",
        pay_category: normalizedSubsidy,
        status: "Active",
        is_active: true,
        updated_at: now,
        created_at: now
      },
      { merge: true }
    );
  }

  await batch.commit();
  return { savedCount: employeeList.length };
}
