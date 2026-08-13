/**
 * Login Screen Component
 * =====================
 * This is the main login page for the Employee Attendance Portal mobile app.
 * Users can sign in with their email and password (minimum 8 characters).
 * Features:
 * - Email validation (@dev.com or Gmail)
 * - Password validation (minimum 8 characters)
 * - Theme toggle (Light/Dark mode)
 * - Link to sign up and forgot password screens
 * - Responsive design for mobile and tablet
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '../src/components/Screen';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import FeatureCarousel from '../src/components/FeatureCarousel';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { getApiError } from '../src/services/api';

const FEATURE_SLIDES = [
  {
    image: require('../assets/illustrations/hero-gps.png'),
    icon: 'location',
    badge: 'GPS Attendance',
    title: 'Check in from anywhere',
    description: 'Your live location is captured automatically the moment you check in or out.',
  },
  {
    image: require('../assets/illustrations/hero-leave.png'),
    icon: 'calendar',
    badge: 'Leave Calendar',
    title: 'Plan time off with ease',
    description: 'Request leave, track approvals, and see your remaining balance at a glance.',
  },
  {
    image: require('../assets/illustrations/hero-team.png'),
    icon: 'git-network',
    badge: 'Team Hierarchy',
    title: 'See how your team connects',
    description: 'Departments, teams, and supervisors organized the way your company actually works.',
  },
  {
    image: require('../assets/illustrations/hero-secure.png'),
    icon: 'shield-checkmark',
    badge: 'Secure Accounts',
    title: 'Your account, fully protected',
    description: 'Email verification, OTP recovery, and role-based access on every login.',
  },
];

/**
 * Login Component
 * Main login form component that handles user authentication
 */
export default function Login() {
  // Get authentication context to call login API
  const { login } = useAuth();
  // Get theme colors and toggle function
  const { colors, mode, toggleTheme } = useTheme();
  // Get window width to determine responsive layout (wide = 880px or more)
  const { width } = useWindowDimensions();
  const wide = width >= 880;
  
  // State management for form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Submit handler for login form
   * Validates email and password, then calls login API
   */
  const submit = async () => {
    setError('');
    // Email validation using regex pattern
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    // Password must be at least 8 characters
    if (password.length < 8) return setError('Password must contain at least 8 characters.');
    setLoading(true);
    try {
      // Call login API with trimmed and lowercased email
      await login(email.trim().toLowerCase(), password);
      // Navigate to dashboard on successful login
      router.replace('/dashboard');
    } catch (e) {
      // Display error message from API or fallback
      setError(await getApiError(e, 'Unable to sign in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}><Ionicons name="people" size={25} color="#fff" /></View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>Dev Employee Portal</Text>
            <Text style={{ color: colors.muted }}>Attendance · Leave · Workforce</Text>
          </View>
        </View>
        <Pressable onPress={toggleTheme} style={[styles.theme, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>{mode === 'dark' ? 'Light' : 'Dark'} mode</Text>
        </Pressable>
      </View>

      <View style={[styles.layout, wide && styles.wide]}>
        <View style={[styles.hero, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>EMPLOYEE ATTENDANCE & LEAVE</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>One elegant portal for the entire workday.</Text>
          <Text style={[styles.heroText, { color: colors.muted }]}>GPS attendance, leave approvals, calendars, organization hierarchy, profile management, notifications, offline sync, and secure account recovery.</Text>
          <FeatureCarousel slides={FEATURE_SLIDES} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.loginIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="log-in-outline" size={25} color={colors.primary} /></View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome back</Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>Sign in with your existing @dev.com or verified @gmail.com account.</Text>
          {!!error && <MessageBox type="danger">{error}</MessageBox>}
          <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@dev.com" />
          <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimum 8 characters" />

          <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgot}>
            <Ionicons name="key-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '900' }}>Forgot Password?</Text>
          </Pressable>

          <AppButton title="Sign In" onPress={submit} loading={loading} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.muted, textAlign: 'center' }}>Need a new portal account?</Text>
          <AppButton title="Sign Up" variant="secondary" onPress={() => router.push('/signup')} />
        </View>
      </View>
    </Screen>
  );
}

/**
 * StyleSheet Definitions for Login Screen
 * ========================================
 * This defines all the styles used in the login page with explanations:
 */
const styles = StyleSheet.create({
  // Main page container - centered, max width 1240, responsive
  page: { maxWidth: 1240, width: '100%', alignSelf: 'center' },
  
  // Top section - brand logo and theme toggle button
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  
  // Brand section - logo icon and text
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  
  // Logo circle - 52x52, displays the app icon (people)
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  
  // Brand title text - "Dev Employee Portal"
  brandTitle: { fontSize: 20, fontWeight: '900' },
  
  // Theme toggle button - shows "Light/Dark mode" with icon
  theme: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  
  // Main layout container
  layout: { gap: 20 },
  
  // Wide layout (desktop) - displays hero and card side by side
  wide: { flexDirection: 'row', alignItems: 'stretch' },
  
  // Hero section - shows features (left side on desktop)
  hero: { flex: 1.2, borderWidth: 1, borderRadius: 26, padding: 30, justifyContent: 'center' },
  
  // Small text label for features
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  
  // Main heading text - "One elegant portal for the entire workday."
  heroTitle: { fontSize: 38, lineHeight: 46, fontWeight: '900', marginTop: 12, maxWidth: 600 },
  
  // Description text under hero title
  heroText: { fontSize: 15, lineHeight: 24, marginTop: 12, maxWidth: 600 },
  
  // Login card (right side) - contains email/password form
  card: { flex: 0.8, borderWidth: 1, borderRadius: 26, padding: 24, gap: 15, justifyContent: 'center' },
  
  // Icon above "Welcome back" text
  loginIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  
  // Card heading - "Welcome back"
  cardTitle: { fontSize: 28, fontWeight: '900' },
  
  // "Forgot Password?" link button
  forgot: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  
  // Horizontal divider line between Sign In and Sign Up buttons
  divider: { height: 1, marginVertical: 2 },
});
