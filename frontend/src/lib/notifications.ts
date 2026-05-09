/**
 * Notifications helpers — safe to import in Expo Go.
 *
 * Note: expo-notifications removed remote push support from Expo Go in SDK 53.
 * Even local notifications throw at import time in Go. We lazy-require the
 * module and short-circuit when running in Expo Go or on web.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const SUPPORTED = Platform.OS !== 'web' && !IS_EXPO_GO;

let modPromise: Promise<any> | null = null;
let configured = false;

async function getModule() {
  if (!SUPPORTED) return null;
  if (!modPromise) {
    modPromise = import('expo-notifications').catch(() => null);
  }
  return modPromise;
}

async function configure() {
  if (configured) return;
  const Notifications = await getModule();
  if (!Notifications) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'StudyFlow Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    } catch {}
  }
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = await getModule();
  if (!Notifications) return false;
  await configure();
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  } catch {
    return false;
  }
}

export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  dueDate: string | null | undefined
): Promise<string | null> {
  if (!dueDate) return null;
  const Notifications = await getModule();
  if (!Notifications) return null;
  await configure();

  const target = new Date(`${dueDate}T09:00:00`);
  if (isNaN(target.getTime()) || target.getTime() <= Date.now()) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StudyFlow Reminder',
        body: title,
        sound: 'default',
        data: { taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string) {
  const Notifications = await getModule();
  if (!Notifications) return;
  try { await Notifications.cancelScheduledNotificationAsync(notificationId); } catch {}
}

export async function scheduleInMinutes(title: string, body: string, minutes: number): Promise<string | null> {
  const Notifications = await getModule();
  if (!Notifications) return null;
  await configure();
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
    });
  } catch {
    return null;
  }
}
