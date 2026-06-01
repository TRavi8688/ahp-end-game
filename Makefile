# Hospyn — Makefile
# Merged: Phase 4 (base) + Phase 11 (tests) + Phase 12 (observability) + Phase 14 (scalability)

.PHONY: help dev docker-up docker-down migrate seed-admin \
        test test-unit test-integration test-redteam test-chaos coverage \
        lint typecheck security format clean \
        gen-secret gen-fernet gen-audit-secret gen-jwt-keys \
        docker-logs docker-restart backup

PYTHON := python
POETRY := poetry run

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ── Dev ───────────────────────────────────────────────────────────────────────
dev: ## Start gateway + services locally
	$(PYTHON) start_api.py

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up: ## Start all services (PG + PgBouncer + Redis + all microservices)
	docker compose up --build -d
	@echo "  Gateway:         http://localhost:8000"
	@echo "  Auth:            http://localhost:8001"
	@echo "  Healthcare:      http://localhost:8002"
	@echo "  AI Service:      http://localhost:8003"

docker-down: ## Stop all containers
	docker compose down

docker-logs: ## Tail all container logs
	docker compose logs -f

docker-restart: ## Rebuild + restart
	docker compose down && docker compose up --build -d

docker-ps: ## Show container status
	docker compose ps

# ── Database ──────────────────────────────────────────────────────────────────
migrate: ## Run all Alembic migrations
	$(POETRY) alembic upgrade head

migrate-down: ## Roll back last migration
	$(POETRY) alembic downgrade -1

migrate-history: ## Show migration history
	$(POETRY) alembic history

migrate-generate: ## Generate new migration (NAME= required)
	$(POETRY) alembic revision --autogenerate -m "$(NAME)"

seed-admin: ## Create/update superadmin user
	$(POETRY) python scripts/create_admin.py

reencrypt: ## Re-encrypt PHI after FERNET_KEY rotation
	$(POETRY) python scripts/reencrypt_phi.py

# ── Testing (Phase 11) ────────────────────────────────────────────────────────
test: ## Full test suite with coverage (minimum 70%)
	$(POETRY) pytest tests/ scripts/ \
		--cov=backend \
		--cov-report=term-missing \
		--cov-report=html:htmlcov \
		--cov-fail-under=70 \
		-v

test-unit: ## Fast unit tests only (no I/O)
	$(POETRY) pytest tests/ -m unit -v

test-integration: ## Integration tests (needs DB + Redis)
	$(POETRY) pytest tests/ -m integration -v

test-redteam: ## Red team RBAC attack simulations (Blueprint 16.2)
	$(POETRY) pytest scripts/red_team/ -v --tb=long

test-chaos: ## Chaos engineering tests (Blueprint 16.2)
	$(POETRY) pytest scripts/chaos_simulation.py -v --tb=long

test-fast: ## All tests, no coverage
	$(POETRY) pytest tests/ -v -q

coverage: ## Open HTML coverage report
	$(POETRY) pytest tests/ --cov=backend --cov-report=html:htmlcov -q
	open htmlcov/index.html 2>/dev/null || xdg-open htmlcov/index.html 2>/dev/null || true

# ── Code quality ──────────────────────────────────────────────────────────────
lint: ## Ruff lint
	$(POETRY) ruff check .

lint-fix: ## Auto-fix lint
	$(POETRY) ruff check . --fix

typecheck: ## mypy type check
	$(POETRY) mypy backend/ start_api.py

security: ## Bandit SAST scan
	$(POETRY) bandit -r backend/ start_api.py -ll

format: ## Ruff format
	$(POETRY) ruff format .

check: lint typecheck security ## Run all quality checks

# ── Secret generation ─────────────────────────────────────────────────────────
gen-secret: ## Generate SECRET_KEY (32 bytes hex)
	@$(PYTHON) -c "import secrets; print(secrets.token_hex(32))"

gen-fernet: ## Generate FERNET_KEY (rotate enc.key)
	@$(PYTHON) -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

gen-audit-secret: ## Generate AUDIT_HMAC_SECRET
	@$(PYTHON) -c "import secrets; print(secrets.token_hex(32))"

gen-jwt-keys: ## Generate RS256 keypair (private_key.pem + public_key.pem)
	@openssl genrsa -out private_key.pem 2048
	@openssl rsa -in private_key.pem -pubout -out public_key.pem
	@echo "Store private_key.pem in Secret Manager. NEVER commit to git."

# ── Backup ────────────────────────────────────────────────────────────────────
backup: ## Run GCS backup manually
	bash scripts/backup.sh

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean: ## Remove caches + build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
