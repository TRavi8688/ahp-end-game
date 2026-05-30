# Hospyn Disaster Recovery

## Restoring from a Backup

The `backup.sh` script creates compressed tarballs containing the PostgreSQL database dump and the Redis data dump. To restore the system from a backup, follow these steps:

### 1. Extract the Backup
```bash
tar -xzf hospyn_backup_YYYYMMDD_HHMMSS.tar.gz
```
This will extract `hospyn_db_YYYYMMDD_HHMMSS.dump` and `redis_dump_YYYYMMDD_HHMMSS.rdb`.

### 2. Stop Application Services
Stop all services *except* the database and redis to ensure no new data is being written during the restore.
```bash
docker-compose stop auth_service healthcare_core nginx_gateway
```

### 3. Restore PostgreSQL
We use `pg_restore` to restore the custom-format dump. It's recommended to drop and recreate the database to ensure a clean state (WARNING: This destroys current data).

```bash
# Drop and recreate the database
docker exec hospyn_postgres psql -U postgres -c "DROP DATABASE IF EXISTS hospyn;"
docker exec hospyn_postgres psql -U postgres -c "CREATE DATABASE hospyn;"

# Copy the dump file into the container
docker cp hospyn_db_YYYYMMDD_HHMMSS.dump hospyn_postgres:/tmp/hospyn_db.dump

# Restore the dump
docker exec hospyn_postgres pg_restore -U postgres -d hospyn -1 "/tmp/hospyn_db.dump"

# Clean up
docker exec hospyn_postgres rm "/tmp/hospyn_db.dump"
```

### 4. Restore Redis
Redis loads data from `dump.rdb` on startup.

```bash
# Stop Redis
docker-compose stop redis

# Replace the dump file
docker cp redis_dump_YYYYMMDD_HHMMSS.rdb hospyn_redis:/data/dump.rdb

# Start Redis
docker-compose start redis
```

### 5. Restart Application Services
Bring everything back up.
```bash
docker-compose start auth_service healthcare_core nginx_gateway
```
