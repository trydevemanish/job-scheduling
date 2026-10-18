# Job Scheduling

A small job-scheduling application with a React frontend and a Node.js/TypeScript backend. The backend uses PostgreSQL for job data, RabbitMQ to queue jobs, and Redis to publish live status updates.

## Requirements

- Node.js 22 or newer and npm
- Docker Desktop with Docker Compose

## Setup and start

### 1. Start the backend and its dependencies

In PowerShell, from the project root:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Set-Location .\backend
docker compose up -d
```

Initialize the PostgreSQL tables:

```powershell
Get-Content .\src\db\schema.sql | docker compose exec -T postgres psql -U app -d jobs_db
```

Docker Compose starts the API on `http://localhost:4000` and the background worker, along with PostgreSQL, RabbitMQ, and Redis.

### 2. Start the frontend

Open another PowerShell terminal in the project root:

```powershell
Set-Location .\frontend\my-app
Copy-Item .env.example .env
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

The frontend environment file is configured to connect to the local API at `http://localhost:4000` and its WebSocket at `ws://localhost:4000/ws`. If you change the backend port, update `VITE_API_URL` and `VITE_WS_URL` in `frontend/my-app/.env` to match.

## Stop the services

From the `backend` directory, run:

```powershell
docker compose down
```

To also remove the persisted PostgreSQL data, use `docker compose down -v`.
