"""
Embedded ZKTeco MB360 ADMS Biometric Protocol Middleware Server
Listens on Port 4370 (and fallback Ports 5000/5050) in a background daemon thread
Provides Live Diagnostic Logging and Real-time Biometric Punch Capture
"""
import http.server
import socketserver
import threading
import json
import re
import socket
import datetime
import sys
from urllib.parse import urlparse, parse_qs

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def _safe_print(text):
    try:
        print(text)
    except Exception:
        try:
            print(text.encode("ascii", "replace").decode("ascii"))
        except Exception:
            pass

def get_local_ip_addresses():
    """Return all active IPv4 addresses of this host machine"""
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                ips.append(ip)
        except Exception:
            pass
    if not ips:
        ips.append("127.0.0.1")
    return ips

def parse_zk_attlog_line(line):
    """
    Parse ZKTeco ATTLOG line or raw PIN data:
    - PIN \t TIMESTAMP \t STATUS \t VERIFY_TYPE
    - PIN=641 / UserPIN=641 / EnrollNumber=641
    - Standalone PIN (e.g. '641', 'EMP002')
    """
    if not line or not line.strip():
        return None
    line = line.strip()

    # Check key=value format (e.g., PIN=641 or UserPIN=641 or EnrollNumber=641)
    kv_match = re.search(r"(?:PIN|UserPIN|EnrollNumber|UserID|emp_id|employeeId)\s*=\s*['\"]?([A-Za-z0-9_-]+)['\"]?", line, re.IGNORECASE)
    if kv_match:
        return {
            "pin": kv_match.group(1).strip(),
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "0",
            "verify_type": "1"
        }

    # Split by tabs or multiple spaces
    parts = re.split(r"\t+|\s{2,}|\s+", line)
    if len(parts) >= 2:
        pin_candidate = parts[0].strip()
        # Verify candidate looks like a pin/id (alphanumeric, not an HTTP header or keyword)
        if pin_candidate and not pin_candidate.lower().startswith(("stamp", "sn=", "table=", "opstamp", "get", "post")):
            return {
                "pin": pin_candidate,
                "timestamp": f"{parts[1]} {parts[2]}" if len(parts) >= 3 and ":" in parts[2] else (parts[1] if ":" in parts[1] else datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                "status": parts[3] if len(parts) > 3 else "0",
                "verify_type": parts[4] if len(parts) > 4 else "1"
            }

    # Single token (e.g. "641" or "EMP001")
    if len(parts) == 1 and re.match(r"^[A-Za-z0-9_-]{1,20}$", parts[0]):
        if not parts[0].lower() in ["ok", "none", "null", "undefined"]:
            return {
                "pin": parts[0].strip(),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "0",
                "verify_type": "1"
            }

    return None

class ZKTecoMiddlewareHandler(http.server.BaseHTTPRequestHandler):
    punch_callback = None
    log_callback = None

    @classmethod
    def emit_log(cls, msg):
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        formatted = f"[{now_str}] {msg}"
        _safe_print(f"[Biometric Middleware] {formatted}")
        if cls.log_callback:
            try:
                cls.log_callback(formatted)
            except Exception as e:
                _safe_print(f"[Log Callback Error]: {e}")

    @classmethod
    def dispatch_punch(cls, pin, client_ip, protocol_type="ZKTECO_ADMS"):
        if cls.punch_callback:
            try:
                cls.punch_callback(pin, client_ip, protocol_type)
            except TypeError:
                try:
                    cls.punch_callback(pin, client_ip)
                except TypeError:
                    cls.punch_callback(pin)
            except Exception as e:
                cls.emit_log(f"❌ [Callback Error]: {e}")

    def log_message(self, format, *args):
        pass  # Handled by custom emit_log

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0])

        # 1. ZKTeco ADMS Handshake
        if path.endswith("/iclock/cdata") or path == "/iclock/cdata":
            sn = query.get("SN", ["ZK_DEVICE"])[0]
            self.emit_log(f"📡 [HANDSHAKE GET] /iclock/cdata from {client_ip} (Serial: {sn})")
            response_text = (
                f"GET OPTION FROM: {sn}\n"
                "Stamp=9999\n"
                "OpStamp=9999\n"
                "ErrorDelay=60\n"
                "Delay=30\n"
                "Realtime=1\n"
                "TransInterval=1\n"
                "TransTimes=00:00;23:59\n"
                "ServerVersion=3.1.1\n"
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(response_text)))
            self.end_headers()
            self.wfile.write(response_text.encode("utf-8"))
            return

        # 2. ZKTeco ADMS Heartbeat
        elif path.endswith("/iclock/getrequest") or path == "/iclock/getrequest":
            self.emit_log(f"💓 [HEARTBEAT GET] /iclock/getrequest from {client_ip}")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK\n")
            return

        # 3. Middleware Status / Health
        elif path in ["/", "/status", "/health"]:
            self.emit_log(f"🔍 [STATUS GET] {path} from {client_ip}")
            status_json = json.dumps({
                "status": "ONLINE",
                "service": "Hayleys Python Kiosk Biometric Middleware",
                "listening_port": getattr(self.server, "server_address", [None, 4370])[1]
            })
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(status_json.encode("utf-8"))
            return

        else:
            self.emit_log(f"ℹ️ [GET] {path} from {client_ip}")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK\n")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8", errors="ignore") if content_length > 0 else ""
        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0])

        self.emit_log(f"📥 [INCOMING POST] {path} from {client_ip} ({content_length} bytes)")

        # 1. REST JSON Punch Webhook (/api/iclock/punch, /punch, /api/punch, or Content-Type application/json)
        is_json = (
            "json" in self.headers.get("Content-Type", "").lower()
            or path in ["/api/iclock/punch", "/punch", "/api/punch"]
            or (path.startswith("/api/") and not path.endswith("/cdata"))
        )
        if is_json:
            try:
                data = json.loads(post_body)
                pin = str(data.get("pin") or data.get("employeeId") or data.get("emp_id") or data.get("id") or "").strip()
                if pin:
                    self.emit_log(f"🎯 [WEBHOOK CAPTURE] PIN: '{pin}' from {client_ip} -> Authenticating...")
                    self.dispatch_punch(pin, client_ip, "REST_JSON")

                resp = json.dumps({"success": True, "pin": pin})
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp.encode("utf-8"))
            except Exception as json_err:
                self.emit_log(f"❌ [JSON Parse Error]: {json_err} -> Body: {post_body[:80]}")
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(str(json_err).encode("utf-8"))
            return

        # 2. ZKTeco Device ADMS Punch Payload (/iclock/cdata or /iclock/devicecmd)
        elif "/iclock/" in path or path.endswith("/cdata"):
            lines = [l.strip() for l in post_body.splitlines() if l.strip()]
            processed_count = 0

            for line in lines:
                parsed = parse_zk_attlog_line(line)
                if parsed and parsed.get("pin"):
                    processed_count += 1
                    pin = parsed["pin"]
                    self.emit_log(f"🎯 [FINGERPRINT CAPTURED] PIN: '{pin}' from {client_ip} -> Authenticating...")
                    self.dispatch_punch(pin, client_ip, "ZKTECO_ADMS")

            if processed_count == 0:
                if lines:
                    preview = post_body[:150].replace("\r", " ").replace("\n", " ")
                    self.emit_log(f"⚠️ [RAW POST PAYLOAD] {client_ip} -> {preview}")
                else:
                    # Check query string for PIN
                    sn = query.get("SN", ["ZK"])[0]
                    self.emit_log(f"ℹ️ [ADMS Device Ping/POST] SN: {sn} from {client_ip}")

            response_body = f"OK: {processed_count or 1}\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body.encode("utf-8"))
            return

        else:
            # Fallback for any other post endpoint
            preview = post_body[:120].replace("\r", " ").replace("\n", " ")
            self.emit_log(f"ℹ️ [GENERIC POST] {path} from {client_ip} -> {preview}")
            # Try to parse any attlog line in body just in case
            lines = [l.strip() for l in post_body.splitlines() if l.strip()]
            for line in lines:
                parsed = parse_zk_attlog_line(line)
                if parsed and parsed.get("pin"):
                    pin = parsed["pin"]
                    self.emit_log(f"🎯 [EXTRACTED PIN] '{pin}' from {client_ip}")
                    if self.punch_callback:
                        self.punch_callback(pin, client_ip, "GENERIC_POST")

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK: 1\n")

class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

class BiometricMiddlewareServer:
    def __init__(self, port=4370, on_punch=None, on_log=None):
        self.port = port
        self.on_punch = on_punch
        self.on_log = on_log
        self.server = None
        self.thread = None
        self.is_running = False

    def start(self):
        handler_class = ZKTecoMiddlewareHandler
        handler_class.punch_callback = self.on_punch
        handler_class.log_callback = self.on_log

        # Try binding primary port 4370, fallback to 5000 / 5050
        bind_ports = [self.port, 5000, 5050]
        bound = False

        for p in bind_ports:
            try:
                self.server = ReusableTCPServer(("0.0.0.0", p), handler_class)
                self.port = p
                bound = True
                local_ips = get_local_ip_addresses()
                ip_str = ", ".join(local_ips)
                msg = f"🚀 [LISTENING] Biometric Middleware active on 0.0.0.0:{self.port} (Host IPs: {ip_str})"
                _safe_print(msg)
                if self.on_log:
                    self.on_log(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")
                break
            except Exception as e:
                _safe_print(f"⚠️ [Biometric Middleware] Could not bind to port {p}: {e}")

        if not bound:
            err_msg = "❌ [ERROR] Failed to bind to any port (4370/5000/5050)."
            _safe_print(err_msg)
            if self.on_log:
                self.on_log(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {err_msg}")
            return False

        self.is_running = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return True

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.is_running = False
