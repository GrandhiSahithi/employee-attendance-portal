import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '../src/components/Screen';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { getApiError } from '../src/services/api';

export default function Login() {
  const { login } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 880;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must contain at least 8 characters.');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/dashboard');
    } catch (e) {
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
          <View style={styles.tiles}>
            {[
              ['location-outline', 'GPS Attendance', colors.primarySoft, colors.primary],
              ['calendar-outline', 'Leave Calendar', colors.roseSoft, colors.rose],
              ['git-network-outline', 'Team Hierarchy', colors.lilacSoft, colors.lilac],
              ['shield-checkmark-outline', 'Secure Accounts', colors.goldSoft, colors.gold],
            ].map(([icon, title, background, color]) => (
              <View key={title} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.tileIcon, { backgroundColor: background }]}><Ionicons name={icon} size={21} color={color} /></View>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text>
              </View>
            ))}
          </View>
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

const styles = StyleSheet.create({
  page: { maxWidth: 1240, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 20, fontWeight: '900' },
  theme: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  layout: { gap: 20 },
  wide: { flexDirection: 'row', alignItems: 'stretch' },
  hero: { flex: 1.2, borderWidth: 1, borderRadius: 26, padding: 30, justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 38, lineHeight: 46, fontWeight: '900', marginTop: 12, maxWidth: 600 },
  heroText: { fontSize: 15, lineHeight: 24, marginTop: 12, maxWidth: 600 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 24 },
  tile: { width: '47%', minWidth: 180, borderWidth: 1, borderRadius: 16, padding: 14, gap: 9 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 0.8, borderWidth: 1, borderRadius: 26, padding: 24, gap: 15, justifyContent: 'center' },
  loginIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 28, fontWeight: '900' },
  forgot: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  divider: { height: 1, marginVertical: 2 },
});
