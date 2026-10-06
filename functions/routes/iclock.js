const { Router } = require("express");
const { db, FieldValue } = require("../config/firebaseAdmin.js");

const router = Router();

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "Unknown"
  );
}

function parseZkAttLogLine(line) {
  if (!line || !line.trim()) return null;
  const parts = line.trim().split(/\t+|\s{2,}|\s+/);
  if (parts.length >= 2) {
    const pin = parts[0].trim();
    const timestampStr = parts.length >= 3 ? `${parts[1]} ${parts[2]}` : parts[1];
    return {
      pin,
      rawTimestamp: timestampStr,
      status: parts[3] || "0",
      verifyType: parts[4] || "1"
    };
  }
  return null;
}

// 1. Handshake
router.get("/cdata", (req, res) => {
  const sn = req.query.SN || "UNKNOWN_DEVICE";
  res.setHeader("Content-Type", "text/plain");
  return res.send(
    `GET OPTION FROM: ${sn}\n` +
    `Stamp=9999\n` +
    `OpStamp=9999\n` +
    `ErrorDelay=60\n` +
    `Delay=30\n` +
    `Realtime=1\n` +
    `TransInterval=1\n` +
    `TransTimes=00:00;23:59\n` +
    `ServerVersion=3.1.1\n`
  );
});

// 2. Heartbeat
router.get("/getrequest", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  return res.send("OK\n");
});

// 3. ADMS Punch POST
router.post("/cdata", async (req, res) => {
  const sn = req.query.SN || req.headers["x-terminal-sn"] || "ZK_TERMINAL";
  const table = req.query.table || "ATTLOG";
  const clientIp = getClientIp(req);
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || "");

  let processedCount = 0;
  const lines = rawBody.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parsed = parseZkAttLogLine(line);
    if (!parsed || !parsed.pin) continue;

    processedCount++;
    const pin = parsed.pin;

    let employeeData = {
      emp_id: pin,
      first_name: "Employee",
      last_name: pin,
      department: "Production",
      pay_category: "Factory Daily Paid"
    };

    try {
      const empSnap = await db.collection("employees").doc(pin).get();
      if (empSnap.exists) {
        employeeData = { ...employeeData, ...empSnap.data() };
      } else {
        const querySnap = await db.collection("employees").where("emp_id", "==", pin).limit(1).get();
        if (!querySnap.empty) {
          employeeData = { ...employeeData, ...querySnap.docs[0].data() };
        }
      }
    } catch (dbErr) {
      console.warn("[ADMS] Employee lookup:", dbErr.message);
    }

    try {
      await db.collection("kiosk_events").doc("LIVE_SCAN").set({
        pin,
        employee_id: pin,
        employee_name: `${employeeData.first_name || ""} ${employeeData.last_name || ""}`.trim() || `EMP-${pin}`,
        employee_data: employeeData,
        source_ip: clientIp,
        serial_number: sn,
        table,
        timestamp: new Date().toISOString(),
        server_timestamp: FieldValue.serverTimestamp(),
        source: "CLOUD_FUNCTION_ADMS"
      });

      await db.collection("attendance_punches").add({
        pin,
        employee_name: `${employeeData.first_name || ""} ${employeeData.last_name || ""}`.trim() || `EMP-${pin}`,
        serial_number: sn,
        raw_payload: line,
        source_ip: clientIp,
        created_at: new Date().toISOString()
      });
    } catch (saveErr) {
      console.error("[ADMS] Save error:", saveErr);
    }
  }

  res.setHeader("Content-Type", "text/plain");
  return res.send(`OK: ${processedCount || 1}\n`);
});

// 4. REST API Punch
router.post("/punch", async (req, res) => {
  try {
    const { pin, employeeId, kioskType, sourceIp } = req.body;
    const resolvedPin = String(pin || employeeId || "").trim();

    if (!resolvedPin) {
      return res.status(400).json({ success: false, message: "Missing required field: pin or employeeId" });
    }

    let employeeData = null;
    const empDoc = await db.collection("employees").doc(resolvedPin).get();
    if (empDoc.exists) {
      employeeData = empDoc.data();
    } else {
      const qSnap = await db.collection("employees").where("emp_id", "==", resolvedPin).limit(1).get();
      if (!qSnap.empty) {
        employeeData = qSnap.docs[0].data();
      }
    }

    const payload = {
      pin: resolvedPin,
      employee_id: resolvedPin,
      employee_name: employeeData ? `${employeeData.first_name || ""} ${employeeData.last_name || ""}`.trim() : `EMP-${resolvedPin}`,
      employee_data: employeeData,
      kiosk_type: kioskType || "GENERAL",
      source_ip: sourceIp || getClientIp(req),
      timestamp: new Date().toISOString(),
      server_timestamp: FieldValue.serverTimestamp(),
      source: "REST_API_PUNCH"
    };

    await db.collection("kiosk_events").doc("LIVE_SCAN").set(payload);

    return res.json({
      success: true,
      message: `Punch registered for Employee ${resolvedPin}`,
      data: payload
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
