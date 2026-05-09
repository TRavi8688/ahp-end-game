# Chapter 16: Troubleshooting Guide

## 16.1 Diagnostics Philosophy
Hospyn 2.0 provides deep forensic visibility. Before troubleshooting, always check the `audit_logs` and the `correlation_id` in the system logs.

## 16.2 Common Issue Matrix
| Issue | Potential Cause | Verification Command/Step |
| :--- | :--- | :--- |
| **AI Processing Delay** | LLM Rate Limits (Groq) | Check `app/services/ai_service.py` logs for 429 errors. |
| **WebSocket Disconnect** | CORS Mismatch | Verify `ALLOWED_ORIGINS` in `config.py`. |
| **Worker Not Consuming** | Redis Connectivity | Run `ping` on the Redis container or check `arq stats`. |
| **403 Forbidden on Record** | IDOR Protection | Verify the token `sub` matches the record owner in DB. |
| **Migration Failure** | Schema Out of Sync | Run `alembic current` to check migration head. |

## 16.3 Health Probes
- **`/health`:** If this returns 500, the FastAPI process has crashed. Check Gunicorn logs.
- **`/ready`:** If this returns 503, either Redis, Postgres, or the AI Service is unreachable.

## 16.4 Emergency Restoration
1. **Restart API/Workers:** `docker-compose restart api worker`
2. **Flush AI Cache (if stuck):** `redis-cli FLUSHDB` (Warning: Clears all current tasks).
3. **Database Restore:** Trigger WAL-restore from off-site storage.
