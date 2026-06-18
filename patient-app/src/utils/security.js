/**
 * src/utils/security.js
 *
 * FIX: Added getRefreshToken() and saveRefreshToken() — used by apiClient.js
 *      for silent token refresh on 401. Were missing, causing apiClient to crash
 *      when trying to call SecurityUtils.getRefreshToken().
 *
 * NOTE: Uses AsyncStorage (not SecureStore) for cross-platform compatibility
 *       with Expo Go. For production builds, swap to expo-secure-store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TOKEN:            'hospyn_access_token',
  REFRESH_TOKEN:    'hospyn_refresh_token',
  HOSPYN_ID:        'hospyn_user_id',
  ACTIVE_MEMBER_ID: 'hospyn_active_member_id',
};

export const SecurityUtils = {

  // ── Access Token ────────────────────────────────────────────────────────────

  async getToken() {
    try { return await AsyncStorage.getItem(KEYS.TOKEN); }
    catch { return null; }
  },

  async saveToken(token) {
    try { await AsyncStorage.setItem(KEYS.TOKEN, token); }
    catch (e) { console.error('[Security] saveToken failed:', e); }
  },

  async deleteToken() {
    try { await AsyncStorage.removeItem(KEYS.TOKEN); }
    catch (e) { console.error('[Security] deleteToken failed:', e); }
  },

  // ── Refresh Token (NEW) ──────────────────────────────────────────────────────

  async getRefreshToken() {
    try { return await AsyncStorage.getItem(KEYS.REFRESH_TOKEN); }
    catch { return null; }
  },

  async saveRefreshToken(token) {
    try { await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token); }
    catch (e) { console.error('[Security] saveRefreshToken failed:', e); }
  },

  async deleteRefreshToken() {
    try { await AsyncStorage.removeItem(KEYS.REFRESH_TOKEN); }
    catch (e) { console.error('[Security] deleteRefreshToken failed:', e); }
  },

  // ── Hospyn ID ───────────────────────────────────────────────────────────────

  async getHospynId() {
    try { return await AsyncStorage.getItem(KEYS.HOSPYN_ID); }
    catch { return null; }
  },

  async saveHospynId(id) {
    try {
      if (id) await AsyncStorage.setItem(KEYS.HOSPYN_ID, id);
      else     await AsyncStorage.removeItem(KEYS.HOSPYN_ID);
    } catch (e) { console.error('[Security] saveHospynId failed:', e); }
  },

  // ── Active Family Member ─────────────────────────────────────────────────────

  async getActiveMemberId() {
    try { return await AsyncStorage.getItem(KEYS.ACTIVE_MEMBER_ID); }
    catch { return null; }
  },

  async saveActiveMemberId(memberId) {
    try {
      if (memberId) await AsyncStorage.setItem(KEYS.ACTIVE_MEMBER_ID, memberId);
      else           await AsyncStorage.removeItem(KEYS.ACTIVE_MEMBER_ID);
    } catch (e) { console.error('[Security] saveActiveMemberId failed:', e); }
  },

  // ── Session Clear (call on logout) ──────────────────────────────────────────

  async clearSession() {
    try {
      await AsyncStorage.multiRemove([
        KEYS.TOKEN,
        KEYS.REFRESH_TOKEN,
        KEYS.ACTIVE_MEMBER_ID,
      ]);
    } catch (e) { console.error('[Security] clearSession failed:', e); }
  },

  // ── Biometrics (native only) ─────────────────────────────────────────────────

  async authenticateWithBiometrics() {
    try {
      // expo-local-authentication is optional — graceful no-op if not installed
      const LocalAuth = require('expo-local-authentication');
      const compatible = await LocalAuth.hasHardwareAsync();
      if (!compatible) return false;
      const enrolled = await LocalAuth.isEnrolledAsync();
      if (!enrolled) return false;
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Verify your identity to access Hospyn',
        fallbackLabel: 'Use Passcode',
      });
      return result.success;
    } catch {
      // expo-local-authentication not available (Expo Go, web)
      return false;
    }
  },
};
