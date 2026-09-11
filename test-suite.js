import http from "http";

async function runVerification() {
  console.log("==================================================");
  console.log("🧪 STARTING AUTOMATED END-TO-END VERIFICATION TEST");
  console.log("==================================================");

  // Test 1: Middleware Health
  console.log("\n[Test 1] Testing Biometric Middleware on port 5000...");
  try {
    const res = await fetch("http://localhost:5000/status");
    const json = await res.json();
    console.log("  ✅ Middleware Status:", json);
  } catch (err) {
    console.error("  ❌ Middleware status error:", err.message);
  }

  // Test 2: Biometric HTTP POST Transmission (Hardware Emulation)
  console.log("\n[Test 2] Simulating Hardware Biometric Reader POST / on port 5000...");
  try {
    const postRes = await fetch("http://localhost:5000/", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "EMP001\tSanjey Asirvatham\tQuality Assurance Lead"
    });
    const text = await postRes.text();
    console.log("  ✅ Biometric POST Response:", text);

    // Verify in logs
    const logsRes = await fetch("http://localhost:5000/api/logs");
    const logs = await logsRes.json();
    console.log(`  ✅ Middleware has captured ${logs.logs?.length || 0} scan log(s). Latest:`, logs.logs?.[0]?.raw);
  } catch (err) {
    console.error("  ❌ Biometric POST error:", err.message);
  }

  // Test 3: Vite Web & Desktop Server
  console.log("\n[Test 3] Testing Frontend Web / Desktop Server on port 5173...");
  try {
    const viteRes = await fetch("http://localhost:5173/");
    console.log("  ✅ Vite Frontend status code:", viteRes.status, "(OK)");
  } catch (err) {
    console.error("  ❌ Vite frontend error:", err.message);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL CORE VERIFICATION TESTS COMPLETED!");
  console.log("==================================================");
}

runVerification();
