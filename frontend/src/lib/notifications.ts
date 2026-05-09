import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

async function configure() {
  if (configured) return;
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
    await Notifications.setNotificationChannelAsync('default', {
      name: 'StudyFlow Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await configure();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

/**
 * Schedule a reminder notification for a given task.
 * If due_date is in the past, returns null (no schedule).
 */
export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  dueDate: string | null | undefined
): Promise<string | null> {
  if (Platform.OS === 'web' || !dueDate) return null;
  await configure();

  // Schedule at 9 AM on the due date (local time).
  const target = new Date(`${dueDate}T09:00:00`);
  if (isNaN(target.getTime())) return null;
  if (target.getTime() <= Date.now()) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StudyFlow Reminder',
        body: title,
        sound: 'default',
        data: { taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target } as any,
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string) {
  if (Platform.OS === 'web') return;
  try { await Notifications.cancelScheduledNotificationAsync(notificationId); } catch {}
}

/** Schedule a quick reminder N minutes from now (used for pomodoro). */
export async function scheduleInMinutes(title: string, body: string, minutes: number): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  await configure();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 } as any,
    });
    return id;
  } catch {
    return null;
  }
}
