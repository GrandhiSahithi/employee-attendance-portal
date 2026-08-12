/**
 * PageHeader Component
 * ===================
 * Header component displayed at the top of most pages
 * Includes a back button and title with optional subtitle
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

/**
 * PageHeader Component
 * @param {string} title - Main heading text
 * @param {string} subtitle - Optional subtitle/description text
 * @param {boolean} dashboardOnly - If true, back button always goes to dashboard
 * @param {string} fallbackRoute - Route to go to if router.back() fails (default: '/dashboard')
 */
export default function PageHeader({ title, subtitle, dashboardOnly = false, fallbackRoute = '/dashboard' }) {
  const { colors } = useTheme();
  
  /**
   * Handle back button press
   * - If dashboardOnly, always navigate to dashboard
   * - Otherwise try to go back, fall back to dashboardOnly
   */
  const goBack = () => {
    if (dashboardOnly) {
      router.replace('/dashboard');
      return;
    }
    try {
      if (router.canGoBack?.()) router.back();
      else router.replace(fallbackRoute);
    } catch {
      router.replace(fallbackRoute);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Back button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={goBack}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="arrow-back" size={21} color={colors.text} />
      </Pressable>
      {/* Title and subtitle */}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/**
 * StyleSheet Definitions for PageHeader
 * ===================================
 */
const styles = StyleSheet.create({
  // Header container - back button + title horizontally
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Back button - circular icon button
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Text container - takes remaining space
  copy: { flex: 1 },
  // Title text - large, bold
  title: { fontSize: 28, fontWeight: '900' },
  // Subtitle text - smaller, muted color
  subtitle: { marginTop: 4, lineHeight: 20 },
  // Pressed state - lower opacity for feedback
  pressed: { opacity: 0.7 },
});
