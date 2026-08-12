/**
 * Screen Component
 * ===============
 * A wrapper component for all screens that provides:
 * - Safe area (handles notches, status bars)
 * - Optional scrolling
 * - Consistent background color from theme
 * - Padding for content
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

/**
 * Screen Component
 * @param {React.ReactNode} children - Screen content
 * @param {boolean} scroll - Enable scrolling (default: true)
 * @param {object} contentStyle - Additional styles for content container
 */
export default function Screen({ children, scroll = true, contentStyle }) {
  const { colors } = useTheme();
  // Render either a ScrollView or View based on scroll prop
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>;
  
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>{body}</SafeAreaView>;
}

/**
 * StyleSheet Definitions for Screen
 * =================================
 */
const styles = StyleSheet.create({ 
  // Root container - fills entire screen
  root: { flex: 1 }, 
  // Content that fills flex space (for non-scroll)
  flex: { flex: 1 }, 
  // Padding for content - 20px padding, extra bottom for tab bars
  content: { padding: 20, paddingBottom: 44 } 
});
