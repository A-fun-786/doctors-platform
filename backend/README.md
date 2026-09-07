# Doctor Platform — Backend Foundation (Phase 2)

Modular FastAPI backend and database layer supporting the multi-tenant doctor platform.

---

## 1. Prerequisites

- **Python**: 3.12+
- **PostgreSQL**: 16+ (via Docker or local installation)

---

## 2. Environment Setup

Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

Configure `.env` if your PostgreSQL credentials differ from the defaults:

```env
APP_NAME=Doctor Platform API
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/doctor_platform
CORS_ORIGINS=http://localhost:3000
```

---

## 3. Virtual Environment & Dependencies

From the `backend` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 4. Database Setup

### Option A: Using Docker Compose (Recommended)

From the project root:

```bash
docker compose up -d postgres
```

### Option B: Local PostgreSQL Installation

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE doctor_platform;
```

---

## 5. Database Migrations

Apply database migrations:

```bash
# Run migrations to head
alembic upgrade head

# Rollback migration (if needed)
alembic downgrade base
```

---

## 6. Running the Server

Start the FastAPI development server with live reload:

```bash
uvicorn app.main:app --reload --port 8000
```

The server will be available at `http://localhost:8000`.

---

## 7. Available Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Root health check (`{"status": "healthy"}`) |
| `GET` | `/api/v1/health` | API v1 health check (`{"status": "healthy", "service": "doctor-platform-api"}`) |
| `GET` | `/api/v1/health/database` | Database connectivity verification (`{"status": "healthy", "database": "connected"}`) |
| `GET` | `/docs` | Interactive Swagger API documentation |
| `GET` | `/redoc` | ReDoc API documentation |

---

## 8. Database Schema (Phase 2 Foundation)

- **`doctors`**: Platform user identity (`id`, `email`, `full_name`, `phone`, `is_active`, `created_at`, `updated_at`)
- **`tenants`**: Isolated tenant workspace owned 1:1 by a doctor (`id`, `doctor_id`, `slug`, `status`, `created_at`, `updated_at`)
