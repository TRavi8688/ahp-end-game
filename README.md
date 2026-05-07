# ahp-end-game
this is the final codeing

# AI Health Passport (AHP) 2.0 Enterprise

Official Enterprise-Grade Backend for the Nirixa Healthcare Platform.

## 🚀 Key Architectural Upgrades

- **Modular Design**: Transitioned from a monolithic 2.6k line `main.py` to a clear, layered architecture following the Repository/Service Pattern.
- **SQLAlchemy 2.0 & Alembic**: Industry-standard data layer with structured migrations.
- **Async Task Queue (Celery + Redis)**: AI processing (OCR, Summarization) is offloaded from the API process to dedicated workers, ensuring 99.9% API availability.
- **Distributed Cache (Redis)**: OTP, session state, and rate limiting are handled via Redis, enabling horizontal scaling across multiple pods/instances.
- **Strict Security**: JWT Access/Refresh pairs with rotation and Redis-backed revocation. Fine-grained RBAC (Role-Based Access Control).
- **Observability**: Structured JSON logging and OpenTelemetry-ready hooks.

## 📁 Repository Structure

```text
app/
├── api/             # FastAPI Routers (Auth, Patient, Doctor)
├── core/            # Config, Security, Database, Logging
├── models/          # SQLAlchemy Table Definitions
├── repositories/    # Data Access Layer (Repository Pattern)
├── services/        # Business Logic & AI Orchestration (Service Layer)
├── schemas/         # Pydantic V2 Models
└── workers/         # Celery Task Definitions
```

## 🛠️ Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL + SQLAlchemy 2.0 + Alembic
- **Caching**: Redis
- **Task Queue**: Celery
- **AI Logic**: Gemini Pro Vision / Groq / Claude 3 (Preserved Pipeline)
- **Dependency Management**: Poetry
- **CI/CD**: GitHub Actions

## 🚦 Getting Started

1. **Clone and Install**:
```bash
poetry install
```

2. **Environment Setup**:
Create a `.env` file based on `app/core/config.py`.

3. **Infrastructure**:
```bash
docker-compose up -d
```

4. **Migrations**:
```bash
alembic upgrade head
```

5. **Run API**:
```bash
uvicorn app.main:app --reload
```

## 🧪 Testing

```bash
pytest --cov=app tests/
```
