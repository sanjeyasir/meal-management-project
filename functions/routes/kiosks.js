const { Router } = require("express");
const { db, FieldValue } = require("../config/firebaseAdmin.js");

const router = Router();

// 1. Kiosk status
router.get("/status", async (req, res) => {
  try {
    const liveDoc = await db.collection("kiosk_events").doc("LIVE_SCAN").get();
    const liveData = liveDoc.exists ? liveDoc.data() : null;

    const kiosksSnap = await db.collection("kiosks").get();
    const kiosks = [];
    kiosksSnap.forEach(d => kiosks.push({ id: d.id, ...d.data() }));

    return res.json({
      success: true,
      service: "Hayleys Meal Management Cloud Functions API",
      timestamp: new Date().toISOString(),
      liveScan: liveData,
      kiosks
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Heartbeat
router.post("/heartbeat", async (req, res) => {
  try {
    const { kioskId, kioskName, ip, role, status = "ONLINE" } = req.body;
    const docId = String(kioskId || ip || "kiosk-unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

    const heartbeatData = {
      kioskId: docId,
      name: kioskName || docId,
      ip: ip || req.ip,
      role: role || "GENERAL",
      status,
      lastSeen: new Date().toISOString(),
      server_timestamp: FieldValue.serverTimestamp()
    };

    await db.collection("kiosks").doc(docId).set(heartbeatData, { merge: true });

    return res.json({
      success: true,
      message: `Heartbeat acknowledged for ${docId}`,
      data: heartbeatData
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
