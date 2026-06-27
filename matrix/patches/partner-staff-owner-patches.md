# Partner App & Staff Portal — Exact Patches

---

## PARTNER APP

### BUG-21 FIX (HIGH): All API Calls 404 — Missing `/healthcare` Prefix
**File:** `src/services/apiClient.js`

Add the same healthcare prefix interceptor that doctor-app uses.

**ADD this interceptor after creating your axios instance:**
```js
// BUG-21 FIX: All non-auth paths must be prefixed with /healthcare
// Backend (healthcare-core) mounts everything under /api/v1/healthcare/*
apiClient.interceptors.request.use((config) => {
    const url = config.url || '';
    // Don't prefix auth routes (handled by auth-service directly)
    const isAuthRoute = url.startsWith('/auth/') || url.startsWith('/api/v1/auth/');
    if (!isAuthRoute && !url.includes('/healthcare/')) {
        config.url = url.startsWith('/api/v1')
            ? url.replace('/api/v1', '/api/v1/healthcare')
            : `/api/v1/healthcare${url.startsWith('/') ? url : '/' + url}`;
    }
    return config;
});
```

---

### BUG-22 FIX: No Role Check After Login
**File:** `src/pages/Login.jsx`

After successful login, **add a role check**:
```js
const data = response.data;
const role = (data.role || data.user?.role || '').toLowerCase();

// BUG-22 FIX: Verify this is actually a pharmacist/partner account
const ALLOWED_PARTNER_ROLES = ['pharmacist', 'lab', 'partner'];
if (!ALLOWED_PARTNER_ROLES.includes(role)) {
    setError(`Access denied. This portal is for pharmacists and lab partners only. Your role (${role}) is not authorized.`);
    return;
}

// Proceed with storing token and navigating
localStorage.setItem('token', data.access_token);
navigate('/dashboard');
```

---

### BUG-23 FIX: Hardcoded Production URL
**File:** `src/api.js`

**FIND:**
```js
return "https://hospyn-495906-api-625745217419.asia-south1.run.app";
```

**REPLACE WITH:**
```js
// BUG-23 FIX: No hardcoded fallback — fail loudly if env var not set
if (!import.meta.env.VITE_API_BASE_URL) {
    console.error('[CONFIG ERROR] VITE_API_BASE_URL is not set. Add it to your .env file.');
    // Return empty string — requests will fail with a clear network error
    return '';
}
return import.meta.env.VITE_API_BASE_URL;
```

---

## STAFF PORTAL

### BUG-29 FIX (MEDIUM): PHI Alerts Stored in localStorage
**File:** `src/store/useStore.ts`

**FIND:**
```ts
storage: createJSONStorage(() => localStorage),
partialize: (state) => ({
    alerts: state.alerts,
    systemStatus: state.systemStatus,
}),
```

**REPLACE WITH:**
```ts
// BUG-29 FIX: alerts contain PHI (patient names, zones, events)
// HIPAA: PHI must NOT persist in localStorage (accessible after browser close, XSS-exposed)
// Only persist systemStatus (non-PHI operational config)
storage: createJSONStorage(() => sessionStorage),
partialize: (state) => ({
    // alerts REMOVED — PHI must not persist between sessions
    systemStatus: state.systemStatus,
}),
```

---

### BUG-30 FIX (LOW): Misleading Security Footer
**File:** `src/pages/Login.tsx`

**FIND:**
```tsx
<p className="text-xs text-slate-500">
    Protected by Hospain Security Engine (RS256 / HS256)
</p>
```

**REPLACE WITH:**
```tsx
{/* BUG-30 FIX: System uses RS256 only. Showing HS256 is incorrect and causes audit confusion */}
<p className="text-xs text-slate-500">
    Protected by Hospain Security Engine · RS256 · HIPAA Compliant
</p>
```

---

### BUG-42 FIX (LOW): Email/Phone Detection Fragile
**File:** `src/context/AuthContext.tsx`

**FIND (around line 55-63):**
```ts
const isEmail = identifier.includes('@');
```

**REPLACE WITH:**
```ts
// BUG-42 FIX: Use proper email regex instead of @ check
// Edge case: copy-pasted phone numbers with @ won't misdirect
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
```

---

## HOSPYN-V2-WEB (Owner Dashboard)

### BUG-16 FIX (HIGH): branches Never Passed to saveSession
**File:** `src/components/Modals.jsx`

**FIND (around line 119-127):**
```js
onLoginSuccess({
    access_token: data.access_token,
    name:         data.user?.name || email.trim(),
    owner_email:  data.user?.email || email.trim(),
    // branches NOT included
});
```

**REPLACE WITH:**
```js
// BUG-16 FIX: Fetch branches after login (or extract from login response)
// Option A — if backend returns branches in login response:
onLoginSuccess({
    access_token: data.access_token,
    name:         data.user?.name || email.trim(),
    owner_email:  data.user?.email || email.trim(),
    branches:     data.branches || data.user?.branches || [],
});

// Option B — if not in login response, fetch separately:
// const dashData = await api.get('/api/v1/healthcare/owner/dashboard', {
//   headers: { Authorization: `Bearer ${data.access_token}` }
// });
// onLoginSuccess({ ..., branches: dashData.branches });
```

---

### BUG-17 FIX (HIGH): Owner Token in localStorage (PHI Risk)
**File:** `src/App.jsx` and `src/pages/OwnerDashboard.jsx`

**In App.jsx — FIND:**
```js
localStorage.setItem('hospyn_owner_token', access_token);
```
**REPLACE WITH:**
```js
// BUG-17 FIX: sessionStorage — token does not persist after browser close (PHI risk)
sessionStorage.setItem('hospyn_owner_token', access_token);
```

**In OwnerDashboard.jsx — FIND:**
```js
const token = localStorage.getItem('hospyn_owner_token');
```
**REPLACE WITH:**
```js
// BUG-17 FIX: Match the sessionStorage write above
const token = sessionStorage.getItem('hospyn_owner_token');
```

**Also in App.jsx logout handler:**
```js
// Change:
localStorage.removeItem('hospyn_owner_token');
// To:
sessionStorage.removeItem('hospyn_owner_token');
```
