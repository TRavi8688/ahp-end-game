# Phase 6 — Patient App Fixes

## What This Fixes
- **AppointmentBookingScreen** — was entirely missing. Patients had no way to book future appointments with doctors.
- **Push Notifications** — NotificationsScreen existed but FCM/Expo setup was absent.

---

## Step-by-Step Application

### 1. Install expo packages (MANUAL — required)
```bash
cd patient-app
npx expo install expo-notifications expo-device expo-constants
npx expo install @react-native-async-storage/async-storage
```

### 2. Copy files
```bash
cp phase6_patient_app/src/screens/AppointmentBookingScreen.js  patient-app/src/screens/AppointmentBookingScreen.js
cp phase6_patient_app/src/services/notifications.js            patient-app/src/services/notifications.js
```

### 3. Register the screen in your navigator (MANUAL)
Open your `patient-app/src/navigation/AppNavigator.js` (or similar) and add:

```javascript
import AppointmentBookingScreen from "../screens/AppointmentBookingScreen";

// Inside your Stack.Navigator:
<Stack.Screen name="AppointmentBooking" component={AppointmentBookingScreen} />
```

Add a button in your HomeScreen to navigate there:
```javascript
<TouchableOpacity onPress={() => navigation.navigate("AppointmentBooking")}>
  <Text>Book Appointment</Text>
</TouchableOpacity>
```

### 4. Wire push notifications in App.js (MANUAL)
In `patient-app/App.js` or your root component:

```javascript
import { registerForPushNotifications, addNotificationListeners } from "./src/services/notifications";

// Inside your root component, after the user logs in:
useEffect(() => {
  registerForPushNotifications(); // Request permission + sync token to backend

  const cleanup = addNotificationListeners({
    onReceived: (notification) => {
      console.log("Push received:", notification.request.content.title);
    },
    onResponse: (response) => {
      const data = response.notification.request.content.data;
      // Navigate based on notification type
      if (data.type === "appointment_reminder") {
        // navigate to appointments
      } else if (data.type === "lab_result") {
        // navigate to lab results
      }
    },
  });

  return cleanup;
}, [isLoggedIn]);
```

### 5. Add to app.json (MANUAL)
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3b82f6",
          "sounds": ["./assets/notification.wav"]
        }
      ]
    ]
  }
}
```

### 6. Backend endpoint needed (MANUAL — backend work)
The push token sync calls `POST /api/v1/healthcare/patients/push-token`.
Add this to healthcare-core if it doesn't exist:
```python
@router.post("/patients/push-token")
async def save_push_token(payload: dict, current_user=Depends(get_current_user), db=Depends(get_db)):
    # Update patient record with push_token
    await db.execute(
        update(Patient).where(Patient.user_id == current_user.id)
        .values(push_token=payload["push_token"])
    )
    await db.commit()
    return {"status": "ok"}
```

## Manual Steps Required
1. `npx expo install ...` (can't run in your environment)
2. Register screen in navigator
3. Wire `registerForPushNotifications()` in App.js after login
4. Add EAS projectId to app.json
5. Backend push-token endpoint

## Verify
```bash
# Run on device/simulator
npx expo start
# Navigate to booking screen — should show doctor list
# On physical device — should prompt for notification permission
```
