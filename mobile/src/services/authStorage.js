/**
 * Auth Storage
 * ============
 * Where the login session (authToken/authUser) lives, split by platform:
 *
 * - Web: browser sessionStorage. It survives refreshes/navigation within
 *   the same tab, but is cleared the moment the tab/window closes — so
 *   closing the browser and reopening the app requires logging in again.
 * - Native (iOS/Android): AsyncStorage, unchanged. Staying signed in
 *   across app opens is normal, expected mobile behavior.
 *
 * Unrelated to the offline attendance queue, which intentionally keeps
 * using AsyncStorage directly so queued actions survive a browser/app
 * restart even though the session itself won't.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

export const authStorage = {
  async getItem(key) {
    if (isWeb) return window.sessionStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    if (isWeb) {
      window.sessionStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  async multiRemove(keys) {
    if (isWeb) {
      keys.forEach((key) => window.sessionStorage.removeItem(key));
      return;
    }
    return AsyncStorage.multiRemove(keys);
  },
};
