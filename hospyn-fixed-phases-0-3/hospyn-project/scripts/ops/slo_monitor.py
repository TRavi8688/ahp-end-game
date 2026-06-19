#!/usr/bin/env python3
"""
Hospyn Production SLO Monitor
==============================
Runs as a scheduled job (cron every 1 minute) or as a one-shot probe.

SLO Targets:
  - Availability  : 99.9% (error budget = 43.8 min/month)
  - p99 Latency   : < 3 000 ms
  - Error Rate    : < 0.5% of requests
  - Auth Latency  : < 2 000 ms

On breach:
  1. Fires PagerDuty P1/P2 alert
  2. Posts to Slack #alerts-production
  3. Writes structured incident record to ./logs/slo_incidents.jsonl
"""

import os
import sys
import json
import time
import datetime
import statistics
import urllib.request
import urllib.error

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
BASE_URL          = os.getenv("HOSPYN_API_URL", "https://hospyn-495906-api-xxxx-uc.a.run.app")
PAGERDUTY_KEY     = os.getenv("PAGERDUTY_ROUTING_KEY", "")
SLACK_WEBHOOK     = os.getenv("SLACK_WEBHOOK_URL", "")
PROBE_COUNT       = int(os.getenv("SLO_PROBE_COUNT", "5"))         # requests per cycle
PROBE_TIMEOUT_S   = int(os.getenv("SLO_PROBE_TIMEOUT", "10"))
LOG_DIR           = os.getenv("SLO_LOG_DIR", "./logs")
ENVIRONMENT       = os.getenv("ENVIRONMENT", "production")

# SLO thresholds
SLO_P99_LATENCY_MS   = 3000
SLO_ERROR_RATE_PCT   = 0.5
SLO_AUTH_LATENCY_MS  = 2000

PROBE_ENDPOINTS = [
    {"path": "/health",            "method": "GET",  "name": "Health"},
    {"path": "/api/v1/auth/me",    "method": "GET",  "name": "Auth-Me"},
    {"path": "/api/v1/patients",   "method": "GET",  "name": "Patients"},
    {"path": "/api/v1/appointments","method": "GET", "name": "Appointments"},
]


# ─────────────────────────────────────────────
# HTTP prober
# ─────────────────────────────────────────────
def probe(endpoint: dict) -> dict:
    url    = f"{BASE_URL}{endpoint['path']}"
    start  = time.monotonic()
    status = 0
    error  = None
    try:
        req = urllib.request.Request(url, method=endpoint["method"])
        req.add_header("User-Agent", "Hospyn-SLO-Monitor/1.0")
        with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT_S) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:
        error  = str(e)
        status = 0
    latency_ms = (time.monotonic() - start) * 1000
    return {
        "endpoint":   endpoint["name"],
        "url":        url,
        "status":     status,
        "latency_ms": round(latency_ms, 2),
        "error":      error,
        "ts":         datetime.datetime.utcnow().isoformat() + "Z",
    }


# ─────────────────────────────────────────────
# Alert dispatchers
# ─────────────────────────────────────────────
def _post_json(url: str, payload: dict) -> bool:
    try:
        data = json.dumps(payload).encode()
        req  = urllib.request.Request(url, data=data,
                                      headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10):
            return True
    except Exception as exc:
        print(f"[WARN] Alert dispatch failed: {exc}", file=sys.stderr)
        return False


def alert_pagerduty(summary: str, severity: str, details: dict):
    if not PAGERDUTY_KEY:
        print("[INFO] PagerDuty key not configured — skipping alert.")
        return
    payload = {
        "routing_key":  PAGERDUTY_KEY,
        "event_action": "trigger",
        "payload": {
            "summary":  summary,
            "severity": severity,          # critical | error | warning | info
            "source":   "hospyn-slo-monitor",
            "custom_details": details,
        },
        "client":     "Hospyn SLO Monitor",
        "client_url": BASE_URL,
    }
    ok = _post_json("https://events.pagerduty.com/v2/enqueue", payload)
    print(f"[ALERT] PagerDuty dispatch → {'OK' if ok else 'FAILED'}: {summary}")


def alert_slack(message: str, color: str = "danger", details: dict = None):
    if not SLACK_WEBHOOK:
        print("[INFO] Slack webhook not configured — skipping notification.")
        return
    fields = [{"title": k, "value": str(v), "short": True}
              for k, v in (details or {}).items()]
    payload = {
        "attachments": [{
            "color":   color,
            "title":   "🚨 Hospyn SLO Breach Detected",
            "text":    message,
            "fields":  fields,
            "footer":  f"Hospyn SLO Monitor | {ENVIRONMENT}",
            "ts":      int(time.time()),
        }]
    }
    ok = _post_json(SLACK_WEBHOOK, payload)
    print(f"[ALERT] Slack dispatch → {'OK' if ok else 'FAILED'}")


# ─────────────────────────────────────────────
# Incident logger
# ─────────────────────────────────────────────
def log_incident(incident: dict):
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, "slo_incidents.jsonl")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(incident) + "\n")
    print(f"[LOG] Incident written → {log_file}")


# ─────────────────────────────────────────────
# SLO evaluation
# ─────────────────────────────────────────────
def evaluate_cycle(results: list[dict]) -> list[dict]:
    """Returns list of breach dicts (empty = healthy)."""
    breaches = []

    latencies  = [r["latency_ms"] for r in results if r["status"] != 0]
    errors     = [r for r in results if r["status"] == 0 or r["status"] >= 500]
    error_rate = (len(errors) / len(results)) * 100 if results else 100

    # 1. Error rate breach
    if error_rate > SLO_ERROR_RATE_PCT:
        breaches.append({
            "type":      "ERROR_RATE",
            "severity":  "critical",
            "value":     round(error_rate, 2),
            "threshold": SLO_ERROR_RATE_PCT,
            "message":   f"Error rate {error_rate:.1f}% exceeds SLO {SLO_ERROR_RATE_PCT}%",
            "failed_endpoints": [r["endpoint"] for r in errors],
        })

    # 2. p99 latency breach
    if len(latencies) >= 2:
        p99 = sorted(latencies)[int(len(latencies) * 0.99)] if len(latencies) >= 100 \
              else max(latencies)
        if p99 > SLO_P99_LATENCY_MS:
            breaches.append({
                "type":      "P99_LATENCY",
                "severity":  "error",
                "value":     round(p99, 1),
                "threshold": SLO_P99_LATENCY_MS,
                "message":   f"p99 latency {p99:.0f}ms exceeds SLO {SLO_P99_LATENCY_MS}ms",
            })

    # 3. Auth endpoint latency breach
    auth_results = [r for r in results if r["name"] == "Auth-Me" or "auth" in r.get("endpoint","").lower()]
    if auth_results:
        auth_p99 = max(r["latency_ms"] for r in auth_results)
        if auth_p99 > SLO_AUTH_LATENCY_MS:
            breaches.append({
                "type":      "AUTH_LATENCY",
                "severity":  "warning",
                "value":     round(auth_p99, 1),
                "threshold": SLO_AUTH_LATENCY_MS,
                "message":   f"Auth p99 {auth_p99:.0f}ms exceeds SLO {SLO_AUTH_LATENCY_MS}ms",
            })

    return breaches


# ─────────────────────────────────────────────
# Main probe loop
# ─────────────────────────────────────────────
def run_probe_cycle():
    print(f"\n{'='*60}")
    print(f"[{datetime.datetime.utcnow().isoformat()}Z] Hospyn SLO Probe Cycle")
    print(f"  Target: {BASE_URL}")
    print(f"  Probes: {PROBE_COUNT} rounds × {len(PROBE_ENDPOINTS)} endpoints")
    print(f"{'='*60}")

    all_results = []
    for _ in range(PROBE_COUNT):
        for ep in PROBE_ENDPOINTS:
            r = probe(ep)
            all_results.append(r)
            status_icon = "✅" if 200 <= r["status"] < 400 else "❌"
            print(f"  {status_icon} [{r['endpoint']:20s}] HTTP {r['status']:3d} | {r['latency_ms']:7.1f}ms"
                  + (f" | ERROR: {r['error']}" if r["error"] else ""))
        time.sleep(0.5)

    # Aggregate stats
    successful = [r for r in all_results if 200 <= r["status"] < 400]
    latencies  = [r["latency_ms"] for r in successful]
    avg_ms     = statistics.mean(latencies) if latencies else 0
    p99_ms     = sorted(latencies)[int(len(latencies)*0.99)] if len(latencies) >= 100 \
                 else max(latencies, default=0)
    error_rate = ((len(all_results) - len(successful)) / len(all_results) * 100) if all_results else 100

    print(f"\n{'─'*60}")
    print(f"  Cycle Summary:")
    print(f"    Total requests : {len(all_results)}")
    print(f"    Successful     : {len(successful)}")
    print(f"    Error rate     : {error_rate:.2f}%")
    print(f"    Avg latency    : {avg_ms:.1f}ms")
    print(f"    Max latency    : {max(latencies, default=0):.1f}ms")
    print(f"    p99 latency    : {p99_ms:.1f}ms")
    print(f"{'─'*60}")

    # Evaluate SLOs
    breaches = evaluate_cycle(all_results)

    if not breaches:
        print("  ✅ ALL SLOs HEALTHY — No breach detected.\n")
        return 0

    # Handle breaches
    print(f"\n  🚨 {len(breaches)} SLO BREACH(ES) DETECTED:\n")
    for b in breaches:
        print(f"    [{b['severity'].upper()}] {b['message']}")

    # Aggregate incident record
    incident = {
        "ts":          datetime.datetime.utcnow().isoformat() + "Z",
        "environment": ENVIRONMENT,
        "breaches":    breaches,
        "cycle_stats": {
            "total_requests": len(all_results),
            "error_rate_pct": round(error_rate, 2),
            "avg_latency_ms": round(avg_ms, 1),
            "p99_latency_ms": round(p99_ms, 1),
        },
    }
    log_incident(incident)

    # Fire alerts for critical/error
    critical_breaches = [b for b in breaches if b["severity"] in ("critical", "error")]
    if critical_breaches:
        summary = f"Hospyn PROD SLO breach: {critical_breaches[0]['message']}"
        alert_pagerduty(summary, critical_breaches[0]["severity"], incident["cycle_stats"])
        alert_slack(summary, "danger", incident["cycle_stats"])
    else:
        # warning-only: Slack only
        alert_slack(breaches[0]["message"], "warning", incident["cycle_stats"])

    return 1  # exit code 1 on breach


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Hospyn Production SLO Monitor")
    parser.add_argument("--loop", action="store_true",
                        help="Run continuously every 60s (for cron-less environments)")
    parser.add_argument("--interval", type=int, default=60,
                        help="Loop interval in seconds (default: 60)")
    args = parser.parse_args()

    if args.loop:
        print(f"🔄 Starting continuous SLO monitor (interval: {args.interval}s)")
        while True:
            try:
                run_probe_cycle()
            except KeyboardInterrupt:
                print("\n[STOP] SLO monitor stopped.")
                sys.exit(0)
            except Exception as exc:
                print(f"[ERROR] Probe cycle crashed: {exc}", file=sys.stderr)
            time.sleep(args.interval)
    else:
        sys.exit(run_probe_cycle())
