/**
 * notifications.js
 * Phase 6 Fix: Patient App — Firebase/Expo push notification setup
 *
 * APPLY TO: patient-app/src/services/notifications.js
 *
 * Install dependencies first:
 *   npx expo install expo-notifications expo-device expo-constants
 *   npx expo install @react-native-async-storage/async-storage
 *
 * Then call registerForPushNotifications() in your App.js useEffect after login.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PUSH_TOKEN_KEY = "hospyn_push_token";
const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";

/**
 * Register the device for push notifications and store the token.
 * Returns the Expo push token string, or null if permission was denied.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn("[Push] Push notifications require a physical device.");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Push] Push notification permission denied by user.");
    return null;
  }

  // Get the Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.error("[Push] No EAS projectId found in app.json. Add extra.eas.projectId.");
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  // Cache token locally
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

  // Register token with Hospyn backend
  await syncTokenWithBackend(token);

  console.log("[Push] Registered push token:", token);
  return token;
}

/**
 * Send the push token to the Hospyn backend so the notification service can use it.
 */
async function syncTokenWithBackend(token) {
  try {
    const authToken = await AsyncStorage.getItem("access_token");
    if (!authToken) return;

    await fetch(`${API_BASE}/api/v1/healthcare/patients/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: token, platform: Device.osName }),
    });
  } catch (err) {
    console.warn("[Push] Failed to sync token with backend:", err.message);
    // Don't throw — push is non-critical
  }
}

/**
 * Add notification listeners. Call in App.js and clean up in useEffect return.
 *
 * Usage in App.js:
 *
 *   useEffect(() => {
 *     const cleanup = addNotificationListeners({
 *       onReceived: (notification) => console.log("Received:", notification),
 *       onResponse: (response) => {
 *         const data = response.notification.request.content.data;
 *         if (data.type === "appointment_reminder") {
 *           navigation.navigate("Appointments");
 *         }
 *       },
 *     });
 *     return cleanup;
 *   }, []);
 */
export function addNotificationListeners({ onReceived, onResponse }) {
  const receivedSub = Notifications.addNotificationReceivedListener(onReceived);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Schedule a local notification (useful for reminders when offline).
 */
export async function scheduleLocalNotification({ title, body, seconds = 5, data = {} }) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: { seconds },
  });
}

/**
 * Clear all notification badges.
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}
