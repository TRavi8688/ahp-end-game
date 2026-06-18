# Hospyn Reception Portal

**Status: 100% Complete — Production Ready**

React + Vite web app for hospital reception staff. All blockers from the system audit have been resolved.

## What Was Fixed (from audit)

| Issue | Fix Applied |
|-------|-------------|
| No `package.json` | ✅ Created with React + Vite + Router + Axios |
| No `index.html` | ✅ Created with font imports and root div |
| No `src/main.jsx` | ✅ Created with `ReactDOM.createRoot()` |
| No `App.jsx` | ✅ Created — mounts `<BrowserRouter>` + all providers |
| `receptionRoutes.jsx` defined but never mounted | ✅ Imported and mounted in App.jsx |
| No walk-in new patient page | ✅ Built `WalkInPage.jsx` — full form with print token |
| `useAuth.js` existed but `LoginPage` didn't call auth | ✅ `LoginPage.jsx` fully wired to `receptionApi.login()` |
| No `AuthContext` (token persistence) | ✅ `AuthContext.jsx` — token stored, validated on mount |
| No `.env` | ✅ `.env` + `.env.example` with production API URL |

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | `LoginPage` | Phone + password login, wired to auth API |
| `/reception/queue` | `QueueBoardPage` | Live queue with WebSocket, call next, skip, complete |
| `/reception/checkin` | `CheckInPage` | Search existing patient, check in, print token |
| `/reception/walkin` | `WalkInPage` | Register brand-new walk-in patient, print token |
| `/reception/appointments` | `TodaysAppointmentsPage` | Today's appointments with status management |
| `/reception/billing` | `BillingPage` | Invoices, payment collection, UPI QR modal |

## Hooks

- `useLiveQueue.js` — WebSocket live queue with auto-reconnect (5 retries)
- `usePatientSearch.js` — debounced patient search (320ms)
- `useAuth.js` — re-exports from AuthContext

## Services

- `receptionApi.js` — all API endpoints, auto-injects Bearer token, 401 → redirect to login
- `printToken.js` — thermal printer-compatible token printing (80mm)

## Components

- `ReceptionLayout` — collapsible sidebar + all nav links
- `ProtectedRoute` — auth guard, redirects to `/login`
- `InvoiceQRModal` — UPI QR code payment modal

## Setup

```bash
# Install dependencies
npm install

# Development server (port 3006)
npm run dev

# Production build
npm run build
```

## Environment Variables

```env
VITE_API_BASE_URL=https://api.hospyn.in
VITE_APP_ENV=production
```

## Project Structure

```
reception-portal/
├── index.html
├── package.json
├── vite.config.js
├── .env
├── .env.example
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx          ← ReactDOM.createRoot entry
    ├── App.jsx           ← BrowserRouter + providers
    ├── index.css         ← Design system + global styles
    ├── contexts/
    │   ├── AuthContext.jsx
    │   └── ToastContext.jsx
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useLiveQueue.js
    │   └── usePatientSearch.js
    ├── services/
    │   ├── receptionApi.js
    │   └── printToken.js
    ├── components/
    │   ├── ReceptionLayout.jsx
    │   ├── ReceptionLayout.module.css
    │   ├── ProtectedRoute.jsx
    │   └── InvoiceQRModal.jsx
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── QueueBoardPage.jsx
    │   ├── CheckInPage.jsx
    │   ├── WalkInPage.jsx
    │   ├── TodaysAppointmentsPage.jsx
    │   └── BillingPage.jsx
    └── routes/
        └── receptionRoutes.jsx
```
