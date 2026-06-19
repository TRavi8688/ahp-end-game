# Phase 5 — Frontend Fixes (All Apps)

## What This Fixes
- React Query added to doctor-app (no more raw axios, adds caching + loading states)
- Zustand auth store for doctor-app (replaces ad-hoc useState prop drilling)
- Error boundaries added to ALL 6 web apps (prevents full crash on JS errors)
- Vitest + React Testing Library setup for doctor-app
- VITE_API_BASE_URL env files for all 6 web apps
- HR Portal given actual pages (was previously just App.jsx shell)

---

## Step-by-Step Application

### 1. Doctor App — Install packages
```bash
cd doctor-app
npm install @tanstack/react-query @tanstack/react-query-devtools zustand
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### 2. Copy files to doctor-app
```bash
cp phase5_frontend/doctor-app/src/queryClient.js                  doctor-app/src/queryClient.js
cp phase5_frontend/doctor-app/src/store/useAuthStore.js            doctor-app/src/store/useAuthStore.js
cp phase5_frontend/doctor-app/src/components/ErrorBoundary.jsx    doctor-app/src/components/ErrorBoundary.jsx
cp phase5_frontend/doctor-app/vitest.config.js                    doctor-app/vitest.config.js
mkdir -p doctor-app/src/tests
cp phase5_frontend/doctor-app/src/tests/setup.js                  doctor-app/src/tests/setup.js
cp phase5_frontend/doctor-app/src/tests/LoginScreen.test.jsx      doctor-app/src/tests/LoginScreen.test.jsx
cp phase5_frontend/doctor-app/.env.example                        doctor-app/.env.example
cp phase5_frontend/doctor-app/.env.development                    doctor-app/.env.development
```

### 3. Update doctor-app/src/index.jsx (or main.jsx)
Add these lines (wrap your existing render):
```jsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./queryClient";
import ErrorBoundary from "./components/ErrorBoundary";

root.render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </ErrorBoundary>
);
```

### 4. Add test scripts to doctor-app/package.json
```json
"scripts": {
  ...existing scripts...,
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

### 5. Run tests to verify
```bash
cd doctor-app
npm run test:run
# Expected: all tests pass (green)
```

---

### 6. Copy ErrorBoundary to all other web apps
```bash
for app in staff-portal reception-portal partner-app hospyn-v2-web; do
  mkdir -p $app/src/components
  cp phase5_frontend/$app/src/components/ErrorBoundary.jsx $app/src/components/ErrorBoundary.jsx
  cp phase5_frontend/$app/.env.example $app/.env.example
  cp phase5_frontend/$app/.env.development $app/.env.development
done
```

Then wrap `<App />` with `<ErrorBoundary>` in each app's `main.jsx` / `index.jsx`.

---

### 7. HR Portal — REPLACE App.jsx and add pages
```bash
cp phase5_frontend/hr-portal/src/App.jsx          hr-portal/src/App.jsx
cp phase5_frontend/hr-portal/src/pages/StaffList.jsx  hr-portal/src/pages/StaffList.jsx
mkdir -p hr-portal/src/components
cp phase5_frontend/hr-portal/src/components/ErrorBoundary.jsx  hr-portal/src/components/ErrorBoundary.jsx
cp phase5_frontend/hr-portal/.env.example         hr-portal/.env.example
cp phase5_frontend/hr-portal/.env.development     hr-portal/.env.development
```

Install react-router-dom for HR portal if not present:
```bash
cd hr-portal && npm install react-router-dom
```

---

## Manual Steps Required
- Run `npm install` in each app after copying files
- Update `main.jsx`/`index.jsx` in each app to wrap with `<ErrorBoundary>` and `<QueryClientProvider>` (doctor-app only)
- Update the import path in `LoginScreen.test.jsx` to match your actual LoginScreen file path

## Verify
```bash
# Doctor app tests
cd doctor-app && npm run test:run
# Expected: ✓ all tests pass

# HR Portal builds
cd hr-portal && npm run build
# Expected: no build errors
```
