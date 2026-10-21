# Carepoint Hospital Management System

Full-stack hospital workspace built with Angular 20, TypeScript, Angular Material, Bootstrap, Express, and MongoDB.

## Features

- Role-based accounts for administrators, doctors, nurses, receptionists, billing staff, and pharmacists
- Patient registration, search, pagination, profile edits, visit history, and deactivation
- Doctor profiles, specializations, departments, consultation fees, and working-hour fields
- Appointment booking, rescheduling, status updates, and duplicate-slot protection
- Clinical notes, diagnosis, treatment, symptoms, and prescription fields
- Invoice creation, partial/full payment tracking, receipt records, and refunds
- Pharmacy batch/expiry tracking, stock counts, and low-stock indicators
- Dashboard metrics, report summary CSV export, and audit entries for successful mutations
- Responsive dashboard and staff screens with reactive forms, route guards, and API authorization
- Input validation, password hashing, JWT sessions, rate limiting, security headers, and role authorization

## Requirements

- Node.js 16.20.2 for the combined root scripts; the standalone backend supports Node.js 20 or 22
- MongoDB 6 or newer (local or hosted)

## Setup

1. Copy `server/.env.example` to `server/.env` and set a private `JWT_SECRET` of at least 32 characters and your MongoDB URI.
2. Install dependencies: `npm install` from the repository root.
3. Create the first administrator with `npm run create-admin --workspace=server` and follow the prompts.
4. Run both applications with `npm run dev` using Node.js 16.20.2.
   - Angular: http://localhost:4200
   - API: http://localhost:3000/api/health

There is no public staff sign-up. The first administrator must be created from the server terminal; after that, an administrator can create staff accounts. The `POST /api/auth/users` endpoint requires an authenticated administrator session and returns `401` when no session is supplied.

## Separate deployment

The backend package is in `server/` and can be deployed independently. See [server deployment instructions](server/README.md). For a Node.js host, set its project root to `server`, install with `npm ci --omit=dev`, and start with `npm start`. Set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` in the host configuration.

The Angular frontend is in `client/`. To host it separately, set `window.CAREPOINT_API_URL` in `client/public/runtime-config.js` to the backend's public origin (for example, `https://api.example.com`), build the frontend, and deploy `client/dist/hospital-client`. The API allows the frontend origin configured through `CLIENT_ORIGIN`.

## Tests and build

- `npm test` runs the MongoDB-backed API integration tests and Angular unit tests (Chrome is required for the Angular test runner).
- `npm run build` builds the Angular production bundle and checks server JavaScript syntax.
- `npm audit --omit=dev` checks production dependencies.

The API is served from `/api`; the Angular dev server proxies these requests to Express.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/patients` | Search/register patients |
| GET/PATCH/DELETE | `/api/patients/:id` | Patient details and updates |
| GET/POST | `/api/appointments` | List/book appointments |
| PATCH | `/api/appointments/:id` | Update schedule/status |
| GET/POST/PATCH | `/api/doctors` | Doctor profiles |
| GET/POST | `/api/departments` | Department list/create |
| GET/POST | `/api/records` | Clinical notes |
| GET/POST | `/api/invoices` | Billing |
| GET | `/api/invoices/:id/pdf` | Download an invoice PDF |
| POST | `/api/invoices/:id/payments` | Record partial/full payment and create a receipt |
| POST | `/api/payments/:id/refund` | Refund a payment |
| GET/POST/PATCH | `/api/pharmacy` | Medicine inventory |
| GET | `/api/reports/summary` | Date-range operations summary |
| GET | `/api/reports/audit` | Recent audit entries (admin only) |
| GET | `/api/dashboard` | Operational dashboard metrics |

Use synthetic patient records during development. The application has not been assessed for production healthcare compliance. MongoDB-backed workflows and database restoration still need verification against the configured deployment database.
