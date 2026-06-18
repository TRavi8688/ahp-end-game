import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const EAS_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId ?? '3ef75e8f-0000-0000-0000-000000000000';

// How foreground notifications appear while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers device for push notifications and wires up foreground +
 * tap listeners. Returns { expoPushToken, notification, permissionStatus }.
 *
 * Call inside the auth-protected navigator so the token is only
 * registered after the patient is logged in.
 *
 * @param {object} options
 * @param {function} options.onNotificationTap  - called with (response) on tap
 * @param {function} options.onTokenRegistered  - called with (token) after backend POST
 * @param {string}   options.authToken          - JWT for the /register-token API call
 */
export function usePushNotifications({ onNotificationTap, onTokenRegistered, authToken } = {}) {
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [error, setError] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  // ─── Permission + token registration ───────────────────────────────────────
  useEffect(() => {
    if (!Device.isDevice) {
      console.warn('[PushNotifications] Must run on a physical device to get a push token.');
      return;
    }

    (async () => {
      try {
        // 1. Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        setPermissionStatus(finalStatus);

        if (finalStatus !== 'granted') {
          console.warn('[PushNotifications] Permission not granted.');
          return;
        }

        // 2. Android: create notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0ea5e9',
          });
        }

        // 3. Get Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: EAS_PROJECT_ID,
        });
        const token = tokenData.data;
        setExpoPushToken(token);

        // 4. POST token to backend
        await registerTokenWithBackend(token, authToken);
        onTokenRegistered?.(token);
      } catch (err) {
        console.error('[PushNotifications] Setup error:', err);
        setError(err);
      }
    })();
  }, [authToken]);

  // ─── Listeners ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
    });

    // User tapped a notification (foreground OR background)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      onNotificationTap?.(data, response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [onNotificationTap]);

  return { expoPushToken, notification, permissionStatus, error };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerTokenWithBackend(token, authToken) {
  if (!API_URL) {
    console.warn('[PushNotifications] EXPO_PUBLIC_API_URL is not set — skipping token registration.');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  const res = await fetch(`${API_URL}/api/v1/notifications/register-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? 'unknown',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[PushNotifications] Backend registration failed: ${res.status} ${body}`);
  }

  console.log('[PushNotifications] Token registered with backend ✓');
}
