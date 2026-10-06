import http from "http";
import { WebSocket } from "ws";

async function runVerification() {
  console.log("==================================================");
  console.log("🧪 STARTING ZKTECO MB360 & KIOSK PROTOCOL VERIFICATION");
  console.log("==================================================");

  // Test 1: Middleware Health & Configuration on Port 4370
  console.log("\n[Test 1] Testing Biometric Middleware on primary Port 4370...");
  try {
    const res = await fetch("http://localhost:4370/status");
    const json = await res.json();
    console.log("  ✅ Primary Port 4370 Status:", json.status);
    console.log("  ✅ Server LAN IPs:", json.localNetworkIps?.map(i => `${i.iface}: ${i.ip}`).join(", ") || "127.0.0.1");
    console.log("  ✅ Configured Kiosks:", json.kiosks);
  } catch (err) {
    console.error("  ❌ Port 4370 status error:", err.message);
  }

  // Test 2: ZKTeco MB360 ADMS Handshake (GET /iclock/cdata)
  console.log("\n[Test 2] Testing ZKTeco MB360 Handshake (GET /iclock/cdata)...");
  try {
    const handshakeRes = await fetch("http://localhost:4370/iclock/cdata?SN=BJ8936001&options=all&pushver=2.4.1", {
      headers: {
        "X-Forwarded-For": "192.168.8.168"
      }
    });
    const handshakeText = await handshakeRes.text();
    console.log("  ✅ Status Code:", handshakeRes.status);
    console.log("  ✅ ADMS Handshake Headers Returned:\n", handshakeText.trim());
    if (handshakeText.includes("GET OPTION FROM: BJ8936001") && handshakeText.includes("Realtime=1")) {
      console.log("  🎉 Handshake Response matches ZKTeco MB360 firmware protocol requirements!");
    } else {
      console.error("  ❌ Handshake response format incorrect!");
    }
  } catch (err) {
    console.error("  ❌ Handshake error:", err.message);
  }

  // Test 3: ZKTeco MB360 ADMS Heartbeat (GET /iclock/getrequest)
  console.log("\n[Test 3] Testing ZKTeco Heartbeat (GET /iclock/getrequest)...");
  try {
    const pollRes = await fetch("http://localhost:4370/iclock/getrequest?SN=BJ8936001");
    const pollText = await pollRes.text();
    console.log("  ✅ Heartbeat Response:", pollText.trim());
  } catch (err) {
    console.error("  ❌ Heartbeat error:", err.message);
  }

  // Test 4: ZKTeco MB360 Real-Time Punch Push from Ordering Kiosk (192.168.8.168)
  console.log("\n[Test 4] Testing ZKTeco POST Punch Push from Ordering Kiosk (192.168.8.168)...");
  try {
    const rawPunch = "EMP001\t2026-10-05 14:35:00\t1\t1\t0\t0\t0\t0\t0";
    const postRes = await fetch("http://localhost:4370/iclock/cdata?SN=BJ8936001&table=ATTLOG&Stamp=9999", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Forwarded-For": "192.168.8.168"
      },
      body: rawPunch
    });
    const postText = await postRes.text();
    console.log("  ✅ MB360 POST Punch Response:", postText.trim());
  } catch (err) {
    console.error("  ❌ MB360 POST error:", err.message);
  }

  // Test 5: ZKTeco MB360 Real-Time Punch Push from Receiving Kiosk (192.168.8.160)
  console.log("\n[Test 5] Testing ZKTeco POST Punch Push from Receiving Kiosk (192.168.8.160)...");
  try {
    const rawPunch = "EMP002\t2026-10-05 14:35:05\t1\t1\t0\t0\t0\t0\t0";
    const postRes = await fetch("http://localhost:4370/iclock/cdata?SN=BJ8936002&table=ATTLOG&Stamp=9999", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Forwarded-For": "192.168.8.160"
      },
      body: rawPunch
    });
    const postText = await postRes.text();
    console.log("  ✅ MB360 POST Punch Response:", postText.trim());
  } catch (err) {
    console.error("  ❌ MB360 POST error:", err.message);
  }

  // Test 6: Verify Live Scan Logs categorization & target routes
  console.log("\n[Test 6] Verifying Kiosk Log Classification in Middleware...");
  try {
    const logsRes = await fetch("http://localhost:4370/api/logs");
    const logs = await logsRes.json();
    console.log(`  ✅ Captured ${logs.logs?.length || 0} scan logs:`);
    (logs.logs || []).slice(0, 4).forEach((l, idx) => {
      console.log(`     [Log ${idx + 1}] Source: ${l.sourceIp}:${l.port} | Kiosk: ${l.kioskName} (${l.kioskRole}) | Action: ${l.targetAction} (${l.targetRoute}) | Employee: ${l.employeeId}`);
    });
  } catch (err) {
    console.error("  ❌ Log verification error:", err.message);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL ZKTECO MB360 PROTOCOL TESTS COMPLETED!");
  console.log("==================================================");
}

runVerification();
