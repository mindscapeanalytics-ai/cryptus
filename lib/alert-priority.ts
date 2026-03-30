// Task 8.6: Custom sound selection
export const ALERT_SOUNDS = {
  'default': 'Built-in chime',
  'soft': 'Soft notification',
  'urgent': 'Urgent alarm',
  'bell': 'Bell',
  'ping': 'Ping',
} as const

export type AlertSound = keyof typeof ALERT_SOUNDS

// Task 8.2: Priority-based notification behavior
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical'

export interface AlertBehavior {
  sound: string
  persistent: boolean
  requireInteraction: boolean
  vibrate: number[]
  toastDuration: number
}

export function getAlertBehavior(priority: AlertPriority): AlertBehavior {
  switch (priority) {
    case 'low':
      return {
        sound: 'soft',
        persistent: false,
        requireInteraction: false,
        vibrate: [100],
        toastDuration: 5000,
      }
    case 'medium':
      return {
        sound: 'default',
        persistent: false,
        requireInteraction: false,
        vibrate: [200],
        toastDuration: 8000,
      }
    case 'high':
      return {
        sound: 'bell',
        persistent: true,
        requireInteraction: false,
        vibrate: [200, 100, 200],
        toastDuration: 12000,
      }
    case 'critical':
      return {
        sound: 'urgent',
        persistent: true,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        toastDuration: 20000,
      }
  }
}

// Task 8.4: Quiet hours suppression
export function shouldSuppressAlert(
  priority: AlertPriority,
  quietHoursEnabled: boolean,
  quietHoursStart: number, // 0-23
  quietHoursEnd: number,   // 0-23
): boolean {
  if (!quietHoursEnabled) return false
  if (priority === 'high' || priority === 'critical') return false

  const now = new Date()
  const currentHour = now.getHours()

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (quietHoursStart > quietHoursEnd) {
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd
  }
  return currentHour >= quietHoursStart && currentHour < quietHoursEnd
}
