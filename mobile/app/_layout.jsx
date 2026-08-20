/**
 * Root Layout
 * ===========
 * Top-level expo-router layout wrapping every screen in the app.
 * - Provides safe-area insets for all screens
 * - Wraps the app in ThemeProvider and AuthProvider so theming and auth
 *   state are available everywhere
 * - Renders the file-based route stack with headers hidden (each screen
 *   uses its own PageHeader instead)
 */

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
