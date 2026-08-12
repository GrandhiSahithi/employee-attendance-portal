/**
 * ThemeContext and ThemeProvider
 * =============================
 * Manages app-wide theming (Light/Dark mode)
 * Provides color palette based on current theme
 * Persists user's theme preference to AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Light Theme Color Palette
 * Warm, bright colors suitable for daytime use
 */
const light = {
  mode: 'light', 
  primary: '#557C6B',              // Primary action color (teal/green)
  primarySoft: '#E9F2EC',          // Light background for primary actions
  rose: '#D9A5B3',                 // Accent color for secondary items
  roseSoft: '#FAEEF1',             // Light background for rose accents
  gold: '#D5B36C',                 // Accent color for warnings
  goldSoft: '#FBF4E4',             // Light background for gold accents
  lilac: '#A99BC7',                // Accent color for tertiary items
  lilacSoft: '#F1EDF8',            // Light background for lilac accents
  background: '#F7F5F0',           // Main background
  surface: '#FFFEFB',              // Card/surface background
  surfaceAlt: '#F2F5F1',           // Alternative surface background
  text: '#26322C',                 // Main text color
  muted: '#6D7872',                // Muted/secondary text
  border: '#DDE4DE',               // Border color
  success: '#3E7B5C',              // Success message color
  warning: '#A57A2E',              // Warning message color
  danger: '#B75D67',               // Error/danger message color
  info: '#6687A7',                 // Info message color
};

/**
 * Dark Theme Color Palette
 * Dark, cool colors suitable for nighttime use
 */
const dark = {
  mode: 'dark', 
  primary: '#91B9A5',              // Primary action color (lighter teal)
  primarySoft: '#203329',          // Dark background for primary actions
  rose: '#D9A9B8',                 // Accent color for secondary items
  roseSoft: '#38272D',             // Dark background for rose accents
  gold: '#E0C27D',                 // Accent color for warnings
  goldSoft: '#372F20',             // Dark background for gold accents
  lilac: '#B9ACD4',                // Accent color for tertiary items
  lilacSoft: '#2E2938',            // Dark background for lilac accents
  background: '#101612',           // Main background (very dark)
  surface: '#18201B',              // Card/surface background
  surfaceAlt: '#202A24',           // Alternative surface background
  text: '#F4F5F1',                 // Main text color (light)
  muted: '#ABB7B0',                // Muted/secondary text
  border: '#334139',               // Border color
  success: '#8BC6A4',              // Success message color
  warning: '#E4C577',              // Warning message color
  danger: '#E49AA0',               // Error/danger message color
  info: '#9CB6CC',                 // Info message color
};

/**
 * ThemeContext - provides mode, colors, toggleTheme
 */
const ThemeContext = createContext(null);

/**
 * ThemeProvider Component
 * Wraps the app to provide theme context
 */
export function ThemeProvider({ children }) {
  // Current theme mode: 'light' or 'dark'
  const [mode, setMode] = useState('light');
  
  /**
   * Load saved theme preference from AsyncStorage on app startup
   */
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('themeMode').then((saved) => {
      if (mounted && (saved === 'light' || saved === 'dark')) setMode(saved);
    });
    return () => { mounted = false; };
  }, []);
  
  /**
   * Toggle between light and dark theme
   * Saves preference to AsyncStorage
   */
  const toggleTheme = async () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    await AsyncStorage.setItem('themeMode', next);
  };
  
  // Get color palette based on current mode
  const colors = mode === 'light' ? light : dark;
  
  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ mode, colors, toggleTheme }), [mode]);
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme Hook
 * Get theme context in any component
 */
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
