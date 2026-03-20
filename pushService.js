// ─────────────────────────────────────────────────────────────────
// pushService.js — Push értesítések (EAS Build ready)
// ─────────────────────────────────────────────────────────────────
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { savePushToken } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export async function registerForPushNotifications(uid) {
  if (!Device.isDevice) {
    console.log("Push: csak fizikai eszközön fut");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log("Push engedély megtagadva");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("Push token:", token);

  if (uid) await savePushToken(uid, token);
  return token;
}

export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null,
  });
}

export async function sendPushToUser(token, title, body, data = {}) {
  if (!token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  });
}

export function setupNotificationListeners(onNotification, onResponse) {
  const n = Notifications.addNotificationReceivedListener(onNotification);
  const r = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => { n.remove(); r.remove(); };
}
