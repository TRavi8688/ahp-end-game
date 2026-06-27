# Patient App — Exact Patches

## BUG-24 FIX (CRITICAL): Hospyn ID Validation Always Fails
**File:** `src/screens/AuthScreen.js`

**FIND (around line 38-40):**
```js
const hospyn = hospynId.trim().toUpperCase();
if (!hospyn.startsWith('Hospyn-') || hospyn.length < 8) {
    return Alert.alert('Invalid ID', 'Please enter a valid Hospyn ID.');
}
```

**REPLACE WITH:**
```js
// BUG-24 FIX: .toUpperCase() makes it "HOSPYN-..." but check was for "Hospyn-"
const hospyn = hospynId.trim().toUpperCase();
if (!hospyn.startsWith('HOSPYN-') || hospyn.length < 8) {
    return Alert.alert('Invalid ID', 'Please enter a valid Hospyn ID (e.g. HOSPYN-000001-XYZ).');
}
```

---

## BUG-25 FIX (CRITICAL): Wrong API Path for Patient Login
**File:** `src/screens/AuthScreen.js`

**FIND (around line 43):**
```js
const resp = await axios.post(`${API_BASE_URL}/patient/login-hospyn`, { hospyn_id: hospyn, password });
```

**REPLACE WITH:**
```js
// BUG-25 FIX: healthcare-core mounts at /api/v1/healthcare/* not /api/v1/*
const resp = await axios.post(`${API_BASE_URL}/healthcare/patient/login-hospyn`, { hospyn_id: hospyn, password });
```

---

## BUG-27 FIX: Auth Interceptor Does Nothing
**File:** `src/api.js`

**FIND:**
```js
api.interceptors.request.use(
  async (config) => {
    // Token retrieval stays as-is (uses SecureStore / AsyncStorage)
    return config;
  },
```

**REPLACE WITH:**
```js
import * as SecureStore from 'expo-secure-store';
// OR: import AsyncStorage from '@react-native-async-storage/async-storage';

api.interceptors.request.use(
  async (config) => {
    // BUG-27 FIX: Actually attach the Bearer token
    try {
      const token = await SecureStore.getItemAsync('hospain_access_token');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) { /* SecureStore not available — skip */ }
    return config;
  },
  (error) => Promise.reject(error)
);
```

---

## BUG-28 FIX: isAuthenticated Set Before Token Verified
**File:** `src/contexts/AuthContext.js`

**FIND (around line 35-45):**
```js
const storedToken = await SecureStore.getItemAsync('token');
if (storedToken) {
    setToken(storedToken);
    setIsAuthenticated(true);   // ← set immediately, before profile verification
    // then async fetch happens...
    const profileData = await patientService.getProfile();
```

**REPLACE WITH:**
```js
// BUG-28 FIX: Only set isAuthenticated=true AFTER profile fetch succeeds
const storedToken = await SecureStore.getItemAsync('token');
if (storedToken) {
    setToken(storedToken);
    // Don't set isAuthenticated yet — verify first
    try {
        const profileData = await patientService.getProfile();
        // Only now mark as authenticated
        setIsAuthenticated(true);
        setUser(profileData);
    } catch (err) {
        // Token expired or invalid — clear it
        await SecureStore.deleteItemAsync('token');
        setToken(null);
        setIsAuthenticated(false);
    }
}
```

---

## BUG-26 NOTE: Social Login Stub
**File:** `src/screens/AuthScreen.js`

The backend `POST /api/v1/auth/google` endpoint exists and works. To wire it:

```js
import * as Google from 'expo-auth-session/providers/google';

// Replace handleSocialLogin with:
const handleGoogleLogin = async () => {
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: 'YOUR_GOOGLE_CLIENT_ID',
    });

    const result = await promptAsync();
    if (result?.type === 'success') {
        const { id_token } = result.params;
        const resp = await api.post('/api/v1/auth/google', { token: id_token });
        // Same as regular login from here
        await AuthContext.login(resp.data.access_token, resp.data.user);
    }
};
```
