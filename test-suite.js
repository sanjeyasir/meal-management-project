import http from "http";

async function runVerification() {
  console.log("==================================================");
  console.log("🧪 STARTING HARDWARE KIOSK END-TO-END VERIFICATION");
  console.log("==================================================");

  // Test 1: Middleware Health & Kiosk Configuration on Port 4370
  console.log("\n[Test 1] Testing Biometric Middleware on primary Port 4370...");
  try {
    const res = await fetch("http://localhost:4370/status");
    const json = await res.json();
    console.log("  ✅ Primary Port 4370 Status:", json.status);
    console.log("  ✅ Configured Kiosks in Middleware:", json.kiosks);
  } catch (err) {
    console.error("  ❌ Port 4370 status error:", err.message);
  }

  // Test 2: Secondary Port 5000 Fallback
  console.log("\n[Test 2] Testing Dual Listener on secondary Port 5000...");
  try {
    const res5000 = await fetch("http://localhost:5000/status");
    const json5000 = await res5000.json();
    console.log("  ✅ Secondary Port 5000 Status:", json5000.status);
  } catch (err) {
    console.log("  ℹ️ Secondary Port 5000 status (optional):", err.message);
  }

  // Test 3: Simulating POST from Ordering Kiosk (IP: 192.168.8.168:4370)
  console.log("\n[Test 3] Simulating POST call from Ordering Kiosk (192.168.8.168:4370)...");
  try {
    const postResOrder = await fetch("http://localhost:4370/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Forwarded-For": "192.168.8.168"
      },
      body: "EMP001\tSanjey Asirvatham\tQuality Assurance Lead"
    });
    const textOrder = await postResOrder.text();
    console.log("  ✅ Ordering Kiosk POST Response:", textOrder);
  } catch (err) {
    console.error("  ❌ Ordering Kiosk POST error:", err.message);
  }

  // Test 4: Simulating POST from Receiving Kiosk (IP: 192.168.8.160:4370)
  console.log("\n[Test 4] Simulating POST call from Receiving Kiosk (192.168.8.160:4370)...");
  try {
    const postResReceive = await fetch("http://localhost:4370/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Forwarded-For": "192.168.8.160"
      },
      body: "EMP002\tKasun Perera\tMachine Operator"
    });
    const textReceive = await postResReceive.text();
    console.log("  ✅ Receiving Kiosk POST Response:", textReceive);
  } catch (err) {
    console.error("  ❌ Receiving Kiosk POST error:", err.message);
  }

  // Test 5: Verify Live Scan Logs categorization
  console.log("\n[Test 5] Verifying Kiosk Log Classification in Middleware...");
  try {
    const logsRes = await fetch("http://localhost:4370/api/logs");
    const logs = await logsRes.json();
    console.log(`  ✅ Captured ${logs.logs?.length || 0} scan logs:`);
    (logs.logs || []).slice(0, 3).forEach((l, idx) => {
      console.log(`     [Log ${idx + 1}] Source: ${l.sourceIp}:${l.port} | Kiosk: ${l.kioskName} (${l.kioskRole}) | Action: ${l.targetAction} | Employee: ${l.employeeId}`);
    });
  } catch (err) {
    console.error("  ❌ Log verification error:", err.message);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL KIOSK END-TO-END VERIFICATION TESTS COMPLETED!");
  console.log("==================================================");
}

runVerification();
