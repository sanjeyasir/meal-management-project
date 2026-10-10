const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const express = require("express");
const cors = require("cors");

const iclockRouter = require("./routes/iclock.js");
const mealsRouter = require("./routes/meals.js");
const employeesRouter = require("./routes/employees.js");
const reportsModule = require("./routes/reports.js");
const kiosksRouter = require("./routes/kiosks.js");

const app = express();

// Configure CORS
app.use(cors({ origin: true }));

// Support text/plain and raw stream bodies (essential for ZKTeco ADMS /iclock/cdata)
app.use(express.text({ type: ["text/*", "application/octet-stream"] }));

// Support JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Root & Health check
app.get("/", (req, res) => {
  res.json({
    service: "Hayleys Meal Management System Cloud API",
    status: "HEALTHY",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      iclock: ["/iclock/cdata", "/iclock/getrequest", "/api/iclock/punch"],
      meals: ["/api/meals/order", "/api/meals/dispense", "/api/meals/today", "/api/meals/employee/:empId"],
      employees: ["/api/employees", "/api/employees/:id", "/api/employees/verify"],
      reports: ["/api/reports/summary", "/api/reports/unclaimed", "/api/reports/archive-daily"],
      kiosks: ["/api/kiosks/status", "/api/kiosks/heartbeat"]
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 2. Mount ZKTeco ADMS Handlers
app.use("/iclock", iclockRouter);
app.use("/api/iclock", iclockRouter);

// 3. Mount Application Routers (handles both /api/* and direct /* routing)
app.use("/api/meals", mealsRouter);
app.use("/meals", mealsRouter);

app.use("/api/employees", employeesRouter);
app.use("/employees", employeesRouter);

const reportsRouter = reportsModule.router || reportsModule;
app.use("/api/reports", reportsRouter);
app.use("/reports", reportsRouter);

app.use("/api/kiosks", kiosksRouter);
app.use("/kiosks", kiosksRouter);

// 4. 404 Fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.method} ${req.originalUrl}' not found.`
  });
});

// 5. Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Cloud Functions Error]:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

/**
 * Cloud Function HTTP API Handler (GCF v2)
 */
exports.api = onRequest(
  {
    cors: true,
    maxInstances: 10,
    region: "us-central1",
    invoker: "public"
  },
  app
);

/**
 * Dedicated iclock handler for ZKTeco ADMS direct routing (GCF v2)
 */
exports.iclock = onRequest(
  {
    cors: true,
    maxInstances: 10,
    region: "us-central1",
    invoker: "public"
  },
  app
);

/**
 * 1. Automated Daily Midnight Move & Archive Function (12:00 AM Sri Lanka Time)
 * - Moves previous day's complete allocations from live 'meal_allocations' to 'archived_meal_allocations'
 * - Generates formatted 3-day multi-tab Excel (.xlsx) report
 * - Uploads to Firebase Storage under daily_archive_reports/
 * - Records metadata summary in Firestore under 'daily_archived_reports'
 */
exports.archiveDailyAllocations = onSchedule(
  {
    schedule: "0 0 * * *", // Every day at 12:00 AM (midnight)
    timeZone: "Asia/Colombo",
    region: "us-central1"
  },
  async (event) => {
    console.log("[Cloud Scheduler - 12:00 AM] Running daily allocations move & archive...");
    try {
      const result = await reportsModule.archiveDailyAllocations(null, "Cloud Scheduler (12:00 AM)");
      console.log(`[Cloud Scheduler - 12:00 AM] Daily archive successfully completed for date: ${result.date}`, result);
    } catch (err) {
      console.error("[Cloud Scheduler - 12:00 AM Error] Failed running daily allocations archive:", err);
    }
  }
);

/**
 * 2. Automated Daily 1:00 AM Cleanup Function (1:00 AM Sri Lanka Time)
 * - Runs 1 hour after the midnight archive
 * - Purges 2+ days old allocation records from 'archived_meal_allocations'
 * - Keeps Firestore lean and minimal while permanent Excel (.xlsx) files remain safely in Firebase Storage
 */
exports.cleanupArchivedAllocations = onSchedule(
  {
    schedule: "0 1 * * *", // Every day at 1:00 AM
    timeZone: "Asia/Colombo",
    region: "us-central1"
  },
  async (event) => {
    console.log("[Cloud Scheduler - 1:00 AM] Running daily cleanup of 2+ days old archived allocations...");
    try {
      const result = await reportsModule.cleanupOldArchivedAllocations(2, "Cloud Scheduler (1:00 AM)");
      console.log(`[Cloud Scheduler - 1:00 AM] Daily cleanup completed:`, result);
    } catch (err) {
      console.error("[Cloud Scheduler - 1:00 AM Error] Failed running archived allocations cleanup:", err);
    }
  }
);
