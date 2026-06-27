# Doctor App — Exact Patches

## BUG-11 FIX: OTP Send Always 422
**File:** `src/services/authService.js`

**FIND:**
```js
sendOTP: async (identifier, method) => {
    return apiClient.post('/auth/send-otp', { identifier, method });
},
```

**REPLACE WITH:**
```js
sendOTP: async (identifier, method) => {
    // BUG-11 FIX: Backend reads 'phone'/'email', never 'identifier'
    const isEmail = identifier.includes('@');
    const body = isEmail
        ? { email: identifier, method: method || 'email' }
        : { phone: identifier, method: method || 'sms' };
    return apiClient.post('/auth/send-otp', body);
},
```

---

## BUG-12 FIX: OTP Login Sends Wrong Field
**File:** `src/services/authService.js`

**FIND:**
```js
login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    return apiClient.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
},
```

**REPLACE WITH:**
```js
login: async (identifier, password) => {
    // BUG-12 FIX: Send as JSON with correct field name
    // Backend accepts: email, phone, phone_number, employee_id, username
    const isEmail = identifier.includes('@');
    const body = isEmail
        ? { email: identifier, password }
        : { phone: identifier, password };
    return apiClient.post('/auth/login', body);
},
```

---

## BUG-13 FIX: Dual-Storage Auth Gate Breaks New Tabs
**File:** `src/App.jsx`

**FIND (around line 98-115):**
```js
const token = sessionStorage.getItem('hospain_access_token');
const isAuthenticated = (localStorage.getItem('isAuthenticated') === 'true') && isDoctor;
```

**REPLACE WITH:**
```js
// BUG-13 FIX: Use sessionStorage only — localStorage breaks new-tab auth
// sessionStorage is per-tab and doesn't cause stale cross-tab state issues
const token = sessionStorage.getItem('hospain_access_token');
const isAuthenticated = !!token && isDoctor;
// Also remove: localStorage.setItem('isAuthenticated', 'true') from login handler
// And remove: localStorage.removeItem('isAuthenticated') from logout handler
```

**Also find and remove all `localStorage.setItem('isAuthenticated'` and `localStorage.removeItem('isAuthenticated'` calls in the login and logout handlers.**

---

## BUG-14 FIX: useAuthStore Dead Code
**File:** `src/pages/LoginScreen.jsx`

After the successful login call, add:
```js
// BUG-14 FIX: Wire the store so it's not dead code
import { useAuthStore } from '../store/useAuthStore';

// Inside handleLogin, after you get the response:
const { login: storeLogin } = useAuthStore.getState();
storeLogin({ token: data.access_token, user: data.user || { role: data.role } });
```

**OR** (simpler) — delete `src/store/useAuthStore.js` entirely if nothing reads from it.

---

## BUG (RC-2): Multiple API Clients Returning Different Shapes
**File:** `src/api.jsx` (bare axios — used by some screens)

The `src/api.jsx` interceptor stub doesn't attach tokens. **Find:**
```js
api.interceptors.request.use(
  async (config) => {
    // Token retrieval stays as-is (uses SecureStore / AsyncStorage)
    return config;
  },
```

**Replace with:**
```js
import AsyncStorage from '@react-native-async-storage/async-storage';
// OR: import * as SecureStore from 'expo-secure-store';

api.interceptors.request.use(
  async (config) => {
    // BUG FIX: Actually attach the token
    const token = await AsyncStorage.getItem('hospain_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```
