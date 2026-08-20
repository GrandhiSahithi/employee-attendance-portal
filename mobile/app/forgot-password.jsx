/**
 * Forgot Password Screen
 * ======================
 * Lets a user request and complete a password reset, branching between
 * @dev.com (Employee ID confirmation) and @gmail.com (OTP email) flows
 * based on the email they enter.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

// Classifies an email as a DEV (@dev.com), GMAIL (@gmail.com), or OTHER address.
function emailType(email) {
  const value = email.trim().toLowerCase();
  if (value.endsWith('@dev.com')) return 'DEV';
  if (value.endsWith('@gmail.com')) return 'GMAIL';
  return 'OTHER';
}

// Main Forgot Password screen component.
export default function ForgotPassword() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Requests a password reset for the entered email; server responds with
  // which flow to use (DEV or GMAIL), stored in `mode`.
  const request = async () => {
    setError(''); setMessage('');
    const type = emailType(email);
    if (type === 'OTHER') return setError('Use the @dev.com or @gmail.com email linked to your account.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/request', { email: email.trim().toLowerCase() });
      setMode(data.mode);
      setMessage(data.message);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  // Validates and submits the new password along with the Employee ID
  // (DEV mode) or OTP (GMAIL mode), then redirects to login on success.
  const reset = async () => {
    setError(''); setMessage('');
    if (newPassword.length < 8) return setError('New password must contain at least 8 characters.');
    if (mode === 'DEV' && !employeeId.trim()) return setError('Enter the Employee ID linked to this @dev.com account.');
    if (mode === 'GMAIL' && !/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code sent to Gmail.');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/reset', {
        email: email.trim().toLowerCase(),
        employeeId: mode === 'DEV' ? employeeId.trim() : null,
        otp: mode === 'GMAIL' ? otp : null,
        newPassword,
      });
      setMessage(data.message);
      setTimeout(() => router.replace('/login'), 800);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Forgot Password" subtitle="Recover your account without losing any employee data." fallbackRoute="/login" />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.goldSoft }]}><Ionicons name="key-outline" size={28} color={colors.gold} /></View>
        <Text style={[styles.title, { color: colors.text }]}>Reset your password</Text>
        <Text style={{ color: colors.muted, lineHeight: 21 }}>@dev.com accounts confirm Employee ID. @gmail.com accounts receive an OTP in the real mailbox.</Text>
        {!!message && <MessageBox type="success">{message}</MessageBox>}
        {!!error && <MessageBox type="danger">{error}</MessageBox>}

        <FormField
          label="Account Email"
          value={email}
          onChangeText={(value) => { setEmail(value.toLowerCase()); setMode(''); setOtp(''); setEmployeeId(''); }}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@dev.com or name@gmail.com"
        />

        {!mode && <AppButton title="Continue" loading={loading} onPress={request} />}

        {mode === 'DEV' && <>
          <View style={[styles.method, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, flex: 1 }}>Internal demo account: confirm the Employee ID, then choose a new password.</Text>
          </View>
          <FormField label="Employee ID" value={employeeId} onChangeText={setEmployeeId} placeholder="EMP-1001" />
          <FormField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Minimum 8 characters" />
          <AppButton title="Change Password" loading={loading} onPress={reset} />
        </>}

        {mode === 'GMAIL' && <>
          <View style={[styles.method, { backgroundColor: colors.roseSoft, borderColor: colors.border }]}>
            <Ionicons name="mail-unread-outline" size={20} color={colors.rose} />
            <Text style={{ color: colors.text, flex: 1 }}>A 6-digit verification code was sent to the Gmail mailbox.</Text>
          </View>
          <FormField label="6-Digit OTP" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" />
          <FormField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Minimum 8 characters" />
          <View style={styles.actions}>
            <AppButton style={{ flex: 1 }} title="Change Password" loading={loading} onPress={reset} />
            <AppButton style={{ flex: 1 }} title="Send New OTP" variant="secondary" onPress={request} />
          </View>
        </>}

        <Pressable onPress={() => router.replace('/login')} style={styles.backLink}>
          <Ionicons name="arrow-back" size={17} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '900' }}>Back to Sign In</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 720, width: '100%', alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 14 },
  icon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '900' },
  method: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  backLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
});
