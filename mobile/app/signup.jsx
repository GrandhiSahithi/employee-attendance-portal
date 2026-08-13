import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Screen from '../src/components/Screen';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

const EMPTY = {
  name: '', employeeId: '', email: '', password: 'password-123', phone: '',
  jobTitle: '', departmentId: '', supervisorId: '', departmentName: '', teamName: '',
};

function domainType(email) {
  const value = email.trim().toLowerCase();
  if (value.endsWith('@dev.com')) return 'DEV';
  if (value.endsWith('@gmail.com')) return 'GMAIL';
  return 'OTHER';
}

export default function Signup() {
  const { signup } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/auth/signup-options');
        if (alive) setOptions(data);
      } catch (e) {
        if (alive) setError(await getApiError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const managers = options?.managers || [];
  const selectedManager = managers.find((manager) => manager.id === form.supervisorId) || null;
  const emailType = domainType(form.email);

  const changeEmail = (value) => {
    setForm((current) => ({ ...current, email: value.toLowerCase() }));
    setMessage('');
  };

  const submit = async () => {
    setError(''); setMessage('');
    if (emailType === 'OTHER') return setError('Use either a @dev.com company email or a @gmail.com email.');
    if (form.password.length < 8) return setError('Password must contain at least 8 characters.');
    if (!form.name.trim() || !form.employeeId.trim() || !form.jobTitle.trim()) return setError('Name, employee ID, and job title are required.');

    if (options?.needsSetup) {
      if (!form.departmentName.trim() || !form.teamName.trim()) return setError('Department and team are required for the first account.');
    } else {
      if (!form.departmentId) return setError('Select a department.');
      if (!form.supervisorId) return setError('Select a Manager.');
    }

    setSaving(true);
    try {
      const payload = { ...form, email: form.email.trim().toLowerCase() };
      await signup(payload);
      router.replace('/dashboard');
    } catch (e) {
      setError(await getApiError(e, 'Unable to create account.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen scroll={false}><LoadingView label="Preparing signup..." /></Screen>;

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.top}>
        <Pressable onPress={() => router.replace('/login')} style={[styles.smallBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Sign In</Text>
        </Pressable>
        <Pressable onPress={toggleTheme} style={[styles.smallBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>{mode === 'dark' ? 'Light' : 'Dark'} mode</Text>
        </Pressable>
      </View>

      <View style={[styles.layout, wide && styles.wide]}>
        <View style={[styles.intro, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <View style={[styles.bigIcon, { backgroundColor: colors.surface }]}><Ionicons name="person-add-outline" size={42} color={colors.primary} /></View>
          <Text style={[styles.title, { color: colors.text }]}>Create your employee portal profile</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {options?.needsSetup
              ? 'This is the first account, so it becomes the first Head Manager and creates the first department and team.'
              : 'Join as an Employee reporting to an existing Manager. Manager and Team accounts are set up by your Head Manager.'}
          </Text>
          <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>Email accounts</Text>
            <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 5 }}>You can create an account using either @dev.com or @gmail.com. Gmail OTP is only used later for Forgot Password recovery.</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!!message && <MessageBox type="success">{message}</MessageBox>}
          {!!error && <MessageBox type="danger">{error}</MessageBox>}

          <View style={styles.two}>
            <FormField style={styles.field} label="Full Name" value={form.name} onChangeText={(value) => update('name', value)} placeholder="Full name" />
            <FormField style={styles.field} label="Employee ID" value={form.employeeId} onChangeText={(value) => update('employeeId', value)} placeholder="EMP-1001" />
          </View>

          <FormField label="Email" value={form.email} onChangeText={changeEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@dev.com or name@gmail.com" />

          <FormField label="Password" value={form.password} onChangeText={(value) => update('password', value)} secureTextEntry placeholder="Minimum 8 characters" />
          <View style={styles.two}>
            <FormField style={styles.field} label="Phone" value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" placeholder="Optional" />
            <FormField style={styles.field} label="Job Title" value={form.jobTitle} onChangeText={(value) => update('jobTitle', value)} placeholder="Software Engineer" />
          </View>

          {options?.needsSetup ? (
            <>
              <View style={[styles.roleBanner, { backgroundColor: colors.goldSoft, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark-outline" size={21} color={colors.gold} />
                <Text style={{ color: colors.text, fontWeight: '900' }}>First account role: Head Manager</Text>
              </View>
              <View style={styles.two}>
                <FormField style={styles.field} label="Department" value={form.departmentName} onChangeText={(value) => update('departmentName', value)} placeholder="Engineering" />
                <FormField style={styles.field} label="Team / Section" value={form.teamName} onChangeText={(value) => update('teamName', value)} placeholder="Leadership" />
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                New accounts join as an Employee. Department is independent of your reporting Manager - pick any department, and any team.
              </Text>
              <Label text="Department" colors={colors} />
              <View style={styles.choices}>{options?.departments?.map((department) => <Choice key={department.id} label={department.name} active={form.departmentId === department.id} onPress={() => update('departmentId', department.id)} colors={colors} />)}</View>

              <Label text="Manager" colors={colors} />
              <View style={styles.choices}>{managers.map((manager) => <Choice key={manager.id} label={`${manager.name} — ${manager.teamName}`} active={form.supervisorId === manager.id} onPress={() => update('supervisorId', manager.id)} colors={colors} />)}</View>

              <Label text="Team" colors={colors} />
              <View style={styles.choices}>{managers.map((manager) => <Choice key={manager.id} label={manager.teamName} active={form.supervisorId === manager.id} onPress={() => update('supervisorId', manager.id)} colors={colors} />)}</View>
              {!!selectedManager && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  You will report to <Text style={{ fontWeight: '900', color: colors.text }}>{selectedManager.name}</Text> on team <Text style={{ fontWeight: '900', color: colors.text }}>{selectedManager.teamName}</Text>.
                </Text>
              )}
            </>
          )}

          <AppButton title="Create Account & Sign In" loading={saving} onPress={submit} />
        </View>
      </View>
    </Screen>
  );
}

function Label({ text, colors }) {
  return <Text style={[styles.label, { color: colors.text }]}>{text}</Text>;
}

function Choice({ label, active, onPress, colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: active ? '900' : '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1220, width: '100%', alignSelf: 'center', gap: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  smallBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', gap: 7, alignItems: 'center' },
  layout: { gap: 20 },
  wide: { flexDirection: 'row', alignItems: 'flex-start' },
  intro: { flex: 0.82, borderWidth: 1, borderRadius: 26, padding: 28, gap: 12 },
  bigIcon: { width: 66, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '900' },
  sub: { fontSize: 15, lineHeight: 24 },
  note: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 8 },
  card: { flex: 1.18, borderWidth: 1, borderRadius: 26, padding: 22, gap: 13 },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 220 },
  label: { fontSize: 13, fontWeight: '900' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  roleBanner: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpBox: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 10 },
  otpHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
