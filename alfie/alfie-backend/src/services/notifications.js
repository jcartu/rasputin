import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Notification types
export const NotificationType = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
};

// Notification priority levels
export const NotificationPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

// Delivery channels
export const DeliveryChannel = {
  TOAST: 'toast',
  NOTIFICATION_CENTER: 'notification_center',
  DESKTOP: 'desktop',
  SOUND: 'sound',
};

// Default delivery rules based on type and priority
const defaultDeliveryRules = {
  [NotificationType.INFO]: {
    [NotificationPriority.LOW]: [DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.NORMAL]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.HIGH]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.SOUND],
    [NotificationPriority.URGENT]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.DESKTOP, DeliveryChannel.SOUND],
  },
  [NotificationType.WARNING]: {
    [NotificationPriority.LOW]: [DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.NORMAL]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.HIGH]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.SOUND],
    [NotificationPriority.URGENT]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.DESKTOP, DeliveryChannel.SOUND],
  },
  [NotificationType.ERROR]: {
    [NotificationPriority.LOW]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.NORMAL]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.SOUND],
    [NotificationPriority.HIGH]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.DESKTOP, DeliveryChannel.SOUND],
    [NotificationPriority.URGENT]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.DESKTOP, DeliveryChannel.SOUND],
  },
  [NotificationType.SUCCESS]: {
    [NotificationPriority.LOW]: [DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.NORMAL]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER],
    [NotificationPriority.HIGH]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.SOUND],
    [NotificationPriority.URGENT]: [DeliveryChannel.TOAST, DeliveryChannel.NOTIFICATION_CENTER, DeliveryChannel.DESKTOP, DeliveryChannel.SOUND],
  },
};

// Notification class
class Notification {
  constructor({
    id = uuidv4(),
    type = NotificationType.INFO,
    priority = NotificationPriority.NORMAL,
    title,
    message,
    data = {},
    channels = null,
    expiresAt = null,
    createdAt = new Date().toISOString(),
    read = false,
    dismissed = false,
    actions = [],
  }) {
    this.id = id;
    this.type = type;
    this.priority = priority;
    this.title = title;
    this.message = message;
    this.data = data;
    this.channels = channels || defaultDeliveryRules[type]?.[priority] || [DeliveryChannel.TOAST];
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
    this.read = read;
    this.dismissed = dismissed;
    this.actions = actions;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      title: this.title,
      message: this.message,
      data: this.data,
      channels: this.channels,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      read: this.read,
      dismissed: this.dismissed,
      actions: this.actions,
    };
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) < new Date();
  }
}

// User preferences
class UserPreferences {
  constructor({
    userId = 'default',
    doNotDisturb = false,
    doNotDisturbUntil = null,
    doNotDisturbSchedule = null,
    soundEnabled = true,
    desktopEnabled = true,
    toastEnabled = true,
    toastDuration = 5000,
    soundVolume = 0.5,
    customSounds = {},
    mutedTypes = [],
    mutedPriorities = [],
  } = {}) {
    this.userId = userId;
    this.doNotDisturb = doNotDisturb;
    this.doNotDisturbUntil = doNotDisturbUntil;
    this.doNotDisturbSchedule = doNotDisturbSchedule;
    this.soundEnabled = soundEnabled;
    this.desktopEnabled = desktopEnabled;
    this.toastEnabled = toastEnabled;
    this.toastDuration = toastDuration;
    this.soundVolume = soundVolume;
    this.customSounds = customSounds;
    this.mutedTypes = mutedTypes;
    this.mutedPriorities = mutedPriorities;
  }

  isDoNotDisturbActive() {
    if (!this.doNotDisturb) return false;
    
    // Check timed DND
    if (this.doNotDisturbUntil) {
      const until = new Date(this.doNotDisturbUntil);
      if (until > new Date()) return true;
      // DND has expired
      this.doNotDisturb = false;
      this.doNotDisturbUntil = null;
      return false;
    }
    
    // Check scheduled DND
    if (this.doNotDisturbSchedule) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const { start, end } = this.doNotDisturbSchedule;
      
      if (start <= end) {
        return currentTime >= start && currentTime < end;
      } else {
        // Overnight schedule (e.g., 22:00 - 07:00)
        return currentTime >= start || currentTime < end;
      }
    }
    
    return this.doNotDisturb;
  }

  shouldMute(notification) {
    return (
      this.mutedTypes.includes(notification.type) ||
      this.mutedPriorities.includes(notification.priority)
    );
  }

  toJSON() {
    return {
      userId: this.userId,
      doNotDisturb: this.doNotDisturb,
      doNotDisturbUntil: this.doNotDisturbUntil,
      doNotDisturbSchedule: this.doNotDisturbSchedule,
      soundEnabled: this.soundEnabled,
      desktopEnabled: this.desktopEnabled,
      toastEnabled: this.toastEnabled,
      toastDuration: this.toastDuration,
      soundVolume: this.soundVolume,
      customSounds: this.customSounds,
      mutedTypes: this.mutedTypes,
      mutedPriorities: this.mutedPriorities,
    };
  }
}

// Notification Queue with persistence
class NotificationQueue {
  constructor(maxSize = 1000, persistPath = null) {
    this.queue = [];
    this.maxSize = maxSize;
    this.persistPath = persistPath || path.join(__dirname, '../../data/notifications.json');
    this.subscribers = new Map();
    this.preferencesPath = path.join(path.dirname(this.persistPath), 'notification_preferences.json');
    this.preferences = new Map();
    this.deliveryRules = { ...defaultDeliveryRules };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    await this.loadFromDisk();
    await this.loadPreferences();
    this.initialized = true;
    
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async loadFromDisk() {
    try {
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.queue = parsed.map(n => new Notification(n));
      console.log(`[Notifications] Loaded ${this.queue.length} notifications from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Notifications] Failed to load from disk:', error.message);
      }
      this.queue = [];
    }
  }

  async saveToDisk() {
    try {
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
      await fs.writeFile(
        this.persistPath,
        JSON.stringify(this.queue.map(n => n.toJSON()), null, 2)
      );
    } catch (error) {
      console.error('[Notifications] Failed to save to disk:', error.message);
    }
  }

  async loadPreferences() {
    try {
      const data = await fs.readFile(this.preferencesPath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [userId, prefs] of Object.entries(parsed)) {
        this.preferences.set(userId, new UserPreferences(prefs));
      }
      console.log(`[Notifications] Loaded preferences for ${this.preferences.size} users`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Notifications] Failed to load preferences:', error.message);
      }
    }
  }

  async savePreferences() {
    try {
      await fs.mkdir(path.dirname(this.preferencesPath), { recursive: true });
      const data = {};
      for (const [userId, prefs] of this.preferences) {
        data[userId] = prefs.toJSON();
      }
      await fs.writeFile(this.preferencesPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Notifications] Failed to save preferences:', error.message);
    }
  }

  getUserPreferences(userId = 'default') {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, new UserPreferences({ userId }));
    }
    return this.preferences.get(userId);
  }

  async updateUserPreferences(userId, updates) {
    const prefs = this.getUserPreferences(userId);
    Object.assign(prefs, updates);
    await this.savePreferences();
    return prefs;
  }

  // Subscribe to notifications
  subscribe(clientId, callback) {
    this.subscribers.set(clientId, callback);
    return () => this.subscribers.delete(clientId);
  }

  // Notify subscribers
  notifySubscribers(notification, deliveryInfo) {
    for (const callback of this.subscribers.values()) {
      try {
        callback(notification, deliveryInfo);
      } catch (error) {
        console.error('[Notifications] Subscriber callback error:', error.message);
      }
    }
  }

  // Determine delivery channels based on rules and preferences
  getDeliveryChannels(notification, userId = 'default') {
    const prefs = this.getUserPreferences(userId);
    const dndActive = prefs.isDoNotDisturbActive();
    const muted = prefs.shouldMute(notification);
    
    if (muted) {
      return [DeliveryChannel.NOTIFICATION_CENTER]; // Always add to center, just don't alert
    }
    
    let channels = [...notification.channels];
    
    if (dndActive) {
      // In DND mode, only urgent notifications break through
      if (notification.priority !== NotificationPriority.URGENT) {
        channels = [DeliveryChannel.NOTIFICATION_CENTER];
      }
    }
    
    // Apply user preferences
    if (!prefs.soundEnabled) {
      channels = channels.filter(c => c !== DeliveryChannel.SOUND);
    }
    if (!prefs.desktopEnabled) {
      channels = channels.filter(c => c !== DeliveryChannel.DESKTOP);
    }
    if (!prefs.toastEnabled) {
      channels = channels.filter(c => c !== DeliveryChannel.TOAST);
    }
    
    return channels;
  }

  // Add notification to queue
  async push(notificationData, userId = 'default') {
    const notification = new Notification(notificationData);
    
    // Check queue size
    if (this.queue.length >= this.maxSize) {
      // Remove oldest non-unread notifications first
      const oldestReadIndex = this.queue.findIndex(n => n.read);
      if (oldestReadIndex !== -1) {
        this.queue.splice(oldestReadIndex, 1);
      } else {
        this.queue.shift();
      }
    }
    
    this.queue.push(notification);
    
    // Determine delivery channels
    const channels = this.getDeliveryChannels(notification, userId);
    const prefs = this.getUserPreferences(userId);
    
    const deliveryInfo = {
      channels,
      toastDuration: prefs.toastDuration,
      soundVolume: prefs.soundVolume,
      customSound: prefs.customSounds[notification.type],
    };
    
    // Notify subscribers
    this.notifySubscribers(notification, deliveryInfo);
    
    // Persist
    await this.saveToDisk();
    
    return { notification, deliveryInfo };
  }

  // Get all notifications
  getAll(options = {}) {
    const {
      includeRead = true,
      includeDismissed = false,
      type = null,
      priority = null,
      limit = 100,
      offset = 0,
    } = options;

    let result = [...this.queue];
    
    // Filter expired
    result = result.filter(n => !n.isExpired());
    
    // Apply filters
    if (!includeRead) {
      result = result.filter(n => !n.read);
    }
    if (!includeDismissed) {
      result = result.filter(n => !n.dismissed);
    }
    if (type) {
      result = result.filter(n => n.type === type);
    }
    if (priority) {
      result = result.filter(n => n.priority === priority);
    }
    
    // Sort by creation time (newest first)
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const total = result.length;
    result = result.slice(offset, offset + limit);
    
    return { notifications: result, total, limit, offset };
  }

  // Get unread count
  getUnreadCount() {
    return this.queue.filter(n => !n.read && !n.dismissed && !n.isExpired()).length;
  }

  // Get notification by ID
  getById(id) {
    return this.queue.find(n => n.id === id);
  }

  // Mark notification as read
  async markAsRead(id) {
    const notification = this.getById(id);
    if (notification) {
      notification.read = true;
      await this.saveToDisk();
      return true;
    }
    return false;
  }

  // Mark all as read
  async markAllAsRead() {
    for (const notification of this.queue) {
      notification.read = true;
    }
    await this.saveToDisk();
  }

  // Dismiss notification
  async dismiss(id) {
    const notification = this.getById(id);
    if (notification) {
      notification.dismissed = true;
      await this.saveToDisk();
      return true;
    }
    return false;
  }

  // Clear all notifications
  async clear(options = {}) {
    const { onlyRead = false, onlyDismissed = false } = options;
    
    if (onlyRead) {
      this.queue = this.queue.filter(n => !n.read);
    } else if (onlyDismissed) {
      this.queue = this.queue.filter(n => !n.dismissed);
    } else {
      this.queue = [];
    }
    
    await this.saveToDisk();
  }

  // Cleanup expired notifications
  async cleanup() {
    const before = this.queue.length;
    this.queue = this.queue.filter(n => !n.isExpired());
    const removed = before - this.queue.length;
    
    if (removed > 0) {
      console.log(`[Notifications] Cleaned up ${removed} expired notifications`);
      await this.saveToDisk();
    }
  }

  // Shutdown
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.saveToDisk();
    await this.savePreferences();
  }

  // Update delivery rules
  setDeliveryRules(rules) {
    this.deliveryRules = { ...this.deliveryRules, ...rules };
  }
}

// Singleton instance
const notificationQueue = new NotificationQueue();

// Helper functions for creating notifications
export function createNotification(options) {
  return new Notification(options);
}

export function info(title, message, options = {}) {
  return notificationQueue.push({
    type: NotificationType.INFO,
    title,
    message,
    ...options,
  });
}

export function warning(title, message, options = {}) {
  return notificationQueue.push({
    type: NotificationType.WARNING,
    title,
    message,
    ...options,
  });
}

export function error(title, message, options = {}) {
  return notificationQueue.push({
    type: NotificationType.ERROR,
    title,
    message,
    ...options,
  });
}

export function success(title, message, options = {}) {
  return notificationQueue.push({
    type: NotificationType.SUCCESS,
    title,
    message,
    ...options,
  });
}

// Do Not Disturb helpers
export async function enableDoNotDisturb(userId = 'default', durationMinutes = null) {
  const updates = { doNotDisturb: true };
  if (durationMinutes) {
    const until = new Date();
    until.setMinutes(until.getMinutes() + durationMinutes);
    updates.doNotDisturbUntil = until.toISOString();
  }
  return notificationQueue.updateUserPreferences(userId, updates);
}

export async function disableDoNotDisturb(userId = 'default') {
  return notificationQueue.updateUserPreferences(userId, {
    doNotDisturb: false,
    doNotDisturbUntil: null,
  });
}

export async function setDoNotDisturbSchedule(userId, startMinutes, endMinutes) {
  return notificationQueue.updateUserPreferences(userId, {
    doNotDisturbSchedule: { start: startMinutes, end: endMinutes },
  });
}

// Export the singleton and classes
export {
  notificationQueue,
  NotificationQueue,
  Notification,
  UserPreferences,
};

export default {
  queue: notificationQueue,
  NotificationType,
  NotificationPriority,
  DeliveryChannel,
  createNotification,
  info,
  warning,
  error,
  success,
  enableDoNotDisturb,
  disableDoNotDisturb,
  setDoNotDisturbSchedule,
};
