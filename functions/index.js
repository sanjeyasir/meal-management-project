const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");

const iclockRouter = require("./routes/iclock.js");
const mealsRouter = require("./routes/meals.js");
const employeesRouter = require("./routes/employees.js");
const reportsRouter = require("./routes/reports.js");
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
      reports: ["/api/reports/summary", "/api/reports/unclaimed"],
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
