// patient-app/src/hooks/usePushNotifications.js
//
// FIX: Line 8 used process.env.EXPO_PUBLIC_API_URL which was never
// defined in .env — only EXPO_PUBLIC_API_BASE_URL exists.
// Result: API_URL was always undefined, token registration was always
// silently skipped, and push notifications never reached patients.

import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── FIX: Changed EXPO_PUBLIC_API_URL → EXPO_PUBLIC_API_BASE_URL ───────────────
const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        registerTokenWithBackend(token);
      }
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Handle notification tap — navigate to relevant screen
        const data = response.notification.request.content.data;
        console.log("[Push] Notification tapped:", data);
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log("[Push] Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission not granted for push notifications");
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("[Push] Expo push token:", token);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0D9488",
      });
    }

    return token;
  } catch (error) {
    console.error("[Push] Failed to get push token:", error);
    return null;
  }
}

async function registerTokenWithBackend(token) {
  try {
    const authToken = await AsyncStorage.getItem("access_token");
    if (!authToken) {
      console.log("[Push] No auth token — skipping push token registration");
      return;
    }

    const response = await fetch(`${API_URL}/patients/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: token, platform: Platform.OS }),
    });

    if (response.ok) {
      console.log("[Push] Push token registered with backend");
    } else {
      console.warn("[Push] Backend rejected push token:", response.status);
    }
  } catch (error) {
    console.error("[Push] Failed to register push token with backend:", error);
  }
}
