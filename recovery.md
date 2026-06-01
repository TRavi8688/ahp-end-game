# Hospyn Disaster Recovery

## Restoring from a Backup

The `backup.sh` script creates compressed tarballs containing the PostgreSQL
database dump and the Redis data dump. To restore the system from a backup,
follow these steps:

### 1. Extract the Backup
```bash
tar -xzf hospyn_backup_YYYYMMDD_HHMMSS.tar.gz
```
This will extract `hospyn_pg_YYYYMMDD_HHMMSS.dump` and
`hospyn_redis_YYYYMMDD_HHMMSS.rdb`.

### 2. Stop Application Services
Stop all services *except* the database and Redis to ensure no new data is
being written during the restore.
```bash
docker-compose stop <REDACTED> <REDACTED> <REDACTED>
```

### 3. Restore PostgreSQL
We use `pg_restore` to restore the custom-format dump. It is recommended to
drop and recreate the database to ensure a clean state.

**WARNING: This destroys current data. Ensure you have a verified backup.**

```bash
# Drop and recreate the database
docker exec <REDACTED> psql -U <REDACTED> -c "DROP DATABASE IF EXISTS <REDACTED>;"
docker exec <REDACTED> psql -U <REDACTED> -c "CREATE DATABASE <REDACTED>;"

# Copy the dump file into the container
docker cp hospyn_pg_YYYYMMDD_HHMMSS.dump <REDACTED>:/tmp/hospyn_db.dump

# Restore the dump
docker exec <REDACTED> pg_restore -U <REDACTED> -d <REDACTED> -1 "/tmp/hospyn_db.dump"

# Clean up
docker exec <REDACTED> rm "/tmp/hospyn_db.dump"
```

### 4. Restore Redis
Redis loads data from `dump.rdb` on startup.

```bash
# Stop Redis
docker-compose stop <REDACTED>

# Replace the dump file
docker cp hospyn_redis_YYYYMMDD_HHMMSS.rdb <REDACTED>:/data/dump.rdb

# Start Redis
docker-compose start <REDACTED>
```

### 5. Restart Application Services
Bring everything back up.
```bash
docker-compose start <REDACTED> <REDACTED> <REDACTED>
```

### 6. Verify Restoration
After bringing services back up:
- Check the health endpoints return 200
- Verify a known record exists in the database
- Confirm Redis is connected and authenticated

```bash
curl -f https://<REDACTED>/health
```

---

## Contact

For escalation contacts, internal hostnames, service endpoints, and
environment-specific credentials, refer to the **private** Notion wiki or
the team's secure password manager.

**This document must not contain real hostnames, IPs, credentials, or
internal service names.**
