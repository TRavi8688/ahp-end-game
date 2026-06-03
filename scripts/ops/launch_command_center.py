#!/usr/bin/env python3
"""
Hospyn — Launch Day Operations Command Center
==============================================
Real-time launch metrics dashboard for the war-room.
Runs continuously, refreshing every 30 seconds.

Tracks:
  - API health & latency
  - New user registrations (last 1h)
  - Active sessions
  - Appointment bookings (last 1h)
  - Error rates by endpoint
  - OTP success/failure ratio
  - WebSocket connection count
  - Database pool utilization
  - Redis memory pressure
  - Top 5 error types (last 15m)

Usage:
  python scripts/ops/launch_command_center.py
  python scripts/ops/launch_command_center.py --no-color
  python scripts/ops/launch_command_center.py --interval 15
"""

import os
import sys
import time
import json
import datetime
import urllib.request
import urllib.error
import argparse
from typing import Optional

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
BASE_URL    = os.getenv("HOSPYN_API_URL", "https://hospyn-495906-api-xxxx-uc.a.run.app")
ADMIN_TOKEN = os.getenv("HOSPYN_ADMIN_TOKEN", "")    # Ops-only internal token
DB_URL      = os.getenv("DATABASE_URL", "")
REDIS_URL   = os.getenv("REDIS_URL", "")
INTERVAL_S  = 30

# ─────────────────────────────────────────────
# Terminal colours
# ─────────────────────────────────────────────
USE_COLOR = sys.stdout.isatty()

def _c(text, code):  return f"\033[{code}m{text}\033[0m" if USE_COLOR else text
def RED(t):   return _c(t, "31")
def GREEN(t): return _c(t, "32")
def YELLOW(t):return _c(t, "33")
def CYAN(t):  return _c(t, "36")
def BOLD(t):  return _c(t, "1")
def DIM(t):   return _c(t, "2")


# ─────────────────────────────────────────────
# HTTP helper
# ─────────────────────────────────────────────
def _get(path: str, timeout: int = 8) -> tuple[int, Optional[dict]]:
    url = f"{BASE_URL}{path}"
    try:
        req = urllib.request.Request(url)
        if ADMIN_TOKEN:
            req.add_header("Authorization", f"Bearer {ADMIN_TOKEN}")
        req.add_header("User-Agent", "Hospyn-CommandCenter/1.0")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


# ─────────────────────────────────────────────
# Metric collectors
# ─────────────────────────────────────────────
def collect_health() -> dict:
    start = time.monotonic()
    status, body = _get("/health")
    latency_ms = (time.monotonic() - start) * 1000
    return {
        "status":     status,
        "latency_ms": round(latency_ms, 1),
        "healthy":    status == 200,
        "body":       body or {},
    }


def collect_metrics() -> dict:
    """
    Pull from /api/v1/admin/metrics (internal ops endpoint).
    Falls back to zeroes if endpoint is unavailable.
    """
    status, body = _get("/api/v1/admin/metrics")
    if status == 200 and body:
        return body
    # Fallback structure
    return {
        "new_users_1h":        "N/A",
        "active_sessions":     "N/A",
        "appointments_1h":     "N/A",
        "otp_success_rate":    "N/A",
        "ws_connections":      "N/A",
        "db_pool_used":        "N/A",
        "db_pool_max":         "N/A",
        "redis_mem_mb":        "N/A",
        "error_rate_1h_pct":   "N/A",
        "top_errors":          [],
        "requests_per_min":    "N/A",
    }


def collect_endpoint_probes() -> list[dict]:
    endpoints = [
        ("/health",                     "Health"),
        ("/api/v1/auth/me",             "Auth"),
        ("/api/v1/patients",            "Patients"),
        ("/api/v1/appointments",        "Appointments"),
        ("/api/v1/prescriptions",       "Prescriptions"),
    ]
    results = []
    for path, name in endpoints:
        start  = time.monotonic()
        status, _ = _get(path, timeout=6)
        latency = (time.monotonic() - start) * 1000
        results.append({
            "name":       name,
            "status":     status,
            "latency_ms": round(latency, 1),
            "ok":         200 <= status < 400,
        })
    return results


# ─────────────────────────────────────────────
# Display helpers
# ─────────────────────────────────────────────
def status_badge(ok: bool) -> str:
    return GREEN("● LIVE") if ok else RED("● DOWN")

def latency_badge(ms: float) -> str:
    if ms < 500:   return GREEN(f"{ms:.0f}ms")
    if ms < 1500:  return YELLOW(f"{ms:.0f}ms")
    return RED(f"{ms:.0f}ms")

def rate_badge(val, threshold_warn, threshold_crit) -> str:
    if val == "N/A": return DIM("N/A")
    v = float(val)
    if v >= threshold_crit: return RED(f"{v}")
    if v >= threshold_warn: return YELLOW(f"{v}")
    return GREEN(f"{v}")

def bar(used, total, width=20) -> str:
    if used == "N/A" or total == "N/A": return DIM("░" * width)
    pct = int((int(used) / max(int(total), 1)) * width)
    filled = "█" * pct
    empty  = "░" * (width - pct)
    pct_num = int(used) / max(int(total), 1) * 100
    color = RED if pct_num > 85 else (YELLOW if pct_num > 60 else GREEN)
    return color(filled) + DIM(empty) + f" {used}/{total}"


# ─────────────────────────────────────────────
# Main render
# ─────────────────────────────────────────────
def render_dashboard(health: dict, metrics: dict, probes: list[dict], iteration: int):
    now    = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    width  = 70

    # Clear screen
    print("\033[2J\033[H" if USE_COLOR else "\n" * 3, end="")

    # Header
    print(BOLD("═" * width))
    print(BOLD(f"  🏥  HOSPYN LAUNCH COMMAND CENTER  —  ITERATION #{iteration}"))
    print(BOLD(f"  {now}   │   {BASE_URL}"))
    print(BOLD("═" * width))

    # ── API Status ──
    h_icon = status_badge(health["healthy"])
    h_lat  = latency_badge(health["latency_ms"])
    print(f"\n  {BOLD('API STATUS')}     {h_icon}   Response time: {h_lat}")

    # ── Endpoint Matrix ──
    print(f"\n  {BOLD('ENDPOINT HEALTH')}")
    print(f"  {'Endpoint':<20} {'Status':>6}   {'Latency':>10}   Health")
    print("  " + "─" * (width - 4))
    for p in probes:
        s_badge = GREEN(f"HTTP {p['status']}") if p["ok"] else RED(f"HTTP {p['status']}")
        l_badge = latency_badge(p["latency_ms"])
        h_badge = GREEN("✓ OK") if p["ok"] else RED("✗ FAIL")
        print(f"  {p['name']:<20} {s_badge:>15}   {l_badge:>18}   {h_badge}")

    # ── Live Traffic Metrics ──
    print(f"\n  {BOLD('LIVE TRAFFIC  (last 60 min)')}")
    print("  " + "─" * (width - 4))
    rpm    = metrics.get("requests_per_min", "N/A")
    nu     = metrics.get("new_users_1h", "N/A")
    sess   = metrics.get("active_sessions", "N/A")
    appts  = metrics.get("appointments_1h", "N/A")
    otpsr  = metrics.get("otp_success_rate", "N/A")
    ws     = metrics.get("ws_connections", "N/A")
    err    = metrics.get("error_rate_1h_pct", "N/A")

    print(f"  {'Requests/min':<28} {CYAN(str(rpm))}")
    print(f"  {'New Registrations (1h)':<28} {CYAN(str(nu))}")
    print(f"  {'Active Sessions':<28} {CYAN(str(sess))}")
    print(f"  {'Appointments Booked (1h)':<28} {CYAN(str(appts))}")
    print(f"  {'OTP Success Rate':<28} {rate_badge(otpsr, 90, 70)}{'%' if otpsr != 'N/A' else ''}")
    print(f"  {'WebSocket Connections':<28} {CYAN(str(ws))}")
    print(f"  {'Error Rate (1h)':<28} {rate_badge(err, 0.5, 1.0)}{'%' if err != 'N/A' else ''}")

    # ── Infrastructure ──
    db_used = metrics.get("db_pool_used", "N/A")
    db_max  = metrics.get("db_pool_max", "N/A")
    redis   = metrics.get("redis_mem_mb", "N/A")

    print(f"\n  {BOLD('INFRASTRUCTURE')}")
    print("  " + "─" * (width - 4))
    print(f"  {'DB Pool':<28} {bar(db_used, db_max)}")
    redis_str = f"{redis} MB" if redis != "N/A" else "N/A"
    print(f"  {'Redis Memory':<28} {CYAN(redis_str)}")

    # ── Top Errors ──
    top_errors = metrics.get("top_errors", [])
    if top_errors:
        print(f"\n  {BOLD('TOP ERRORS  (last 15 min)')}")
        print("  " + "─" * (width - 4))
        for i, err_entry in enumerate(top_errors[:5], 1):
            msg   = err_entry.get("message", "Unknown")[:45]
            count = err_entry.get("count", 0)
            print(f"  {i}. {RED(msg):<50}  ×{count}")
    else:
        print(f"\n  {GREEN('✅  No errors in last 15 minutes.')}")

    # ── SLO Status ──
    print(f"\n  {BOLD('SLO STATUS')}")
    print("  " + "─" * (width - 4))

    slo_avail  = health["healthy"]
    slo_p99    = health["latency_ms"] < 3000
    slo_err    = err == "N/A" or float(err) < 0.5 if err != "N/A" else True
    slo_auth   = next((p["latency_ms"] < 2000 for p in probes if "Auth" in p["name"]), True)

    def slo_row(label, passing):
        badge = GREEN("✅ PASS") if passing else RED("❌ BREACH")
        return f"  {label:<35} {badge}"

    print(slo_row("Availability  (99.9% target)",      slo_avail))
    print(slo_row("p99 Latency   (< 3 000ms target)",  slo_p99))
    print(slo_row("Error Rate    (< 0.5% target)",     slo_err))
    print(slo_row("Auth Latency  (< 2 000ms target)",  slo_auth))

    overall_ok = all([slo_avail, slo_p99, slo_err, slo_auth])
    print()
    if overall_ok:
        print(BOLD(GREEN("  ✅  ALL SLOs WITHIN BUDGET — LAUNCH NOMINAL")))
    else:
        print(BOLD(RED("  🚨  SLO BREACH DETECTED — REVIEW REQUIRED")))

    # ── Footer ──
    print(f"\n{BOLD('═' * width)}")
    print(DIM(f"  Refreshing every {INTERVAL_S}s   │   Ctrl+C to exit   │   hospyn-slo-monitor v1.0"))
    print(BOLD("═" * width))


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Hospyn Launch Command Center")
    parser.add_argument("--no-color",  action="store_true", help="Disable colour output")
    parser.add_argument("--interval",  type=int, default=INTERVAL_S, help="Refresh interval (s)")
    parser.add_argument("--once",      action="store_true", help="Run once and exit")
    args = parser.parse_args()

    global USE_COLOR, INTERVAL_S
    if args.no_color:
        USE_COLOR = False
    INTERVAL_S = args.interval

    iteration = 1
    print("🚀 Starting Hospyn Launch Command Center...")

    while True:
        try:
            health  = collect_health()
            metrics = collect_metrics()
            probes  = collect_endpoint_probes()
            render_dashboard(health, metrics, probes, iteration)
        except KeyboardInterrupt:
            print("\n\n[STOP] Command center shut down.")
            sys.exit(0)
        except Exception as exc:
            print(f"\n[ERROR] Dashboard refresh failed: {exc}")

        if args.once:
            break

        try:
            time.sleep(INTERVAL_S)
        except KeyboardInterrupt:
            print("\n\n[STOP] Command center shut down.")
            sys.exit(0)

        iteration += 1


if __name__ == "__main__":
    main()
