import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import PageHeader from '../src/components/PageHeader';
import DatePickerField, { todayDateString } from '../src/components/DatePickerField';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

const TYPES = ['CASUAL', 'SICK', 'VACATION'];

export default function LeaveScreen() {
  return <RequireAuth><Leave /></RequireAuth>;
}

function Leave() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const today = todayDateString();
  const [form, setForm] = useState({ leaveType: 'CASUAL', fromDate: today, toDate: today, reason: '' });
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [rephrasing, setRephrasing] = useState(false);

  const load = useCallback(async () => {
    try { setRequests((await api.get('/leaves/me')).data.requests || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setFromDate = (value) => setForm((current) => ({
    ...current,
    fromDate: value,
    toDate: current.toDate && current.toDate >= value ? current.toDate : value,
  }));

  const tip = useMemo(() => {
    if (form.leaveType === 'SICK') return 'Suggestion: Keep medical details private. A short professional reason such as “I am unwell and need a day to recover” is enough.';
    if (form.leaveType === 'VACATION') return 'Suggestion: Submit vacation dates as early as possible so your manager can plan team coverage.';
    return 'Suggestion: Keep your reason clear and professional. One or two sentences are usually enough.';
  }, [form.leaveType]);

  const rephrase = async () => {
    setError('');
    setMessage('');
    if (!form.reason.trim()) return setError('Write a reason first, then use Rephrase Reason.');
    setRephrasing(true);
    try {
      const { data } = await api.post('/assist/rephrase', { text: form.reason, leaveType: form.leaveType });
      update('reason', data.rephrased);
      setMessage('Reason rephrased. Review the wording before submitting.');
    } catch (e) {
      setError(await getApiError(e, 'Unable to rephrase the reason.'));
    } finally { setRephrasing(false); }
  };

  const submit = async () => {
    setError('');
    setMessage('');
    if (!form.fromDate || !form.toDate) return setError('From Date and To Date are required.');
    if (form.fromDate < today || form.toDate < today) return setError(`Past dates are not allowed. Choose ${today} or a future date.`);
    if (form.fromDate > form.toDate) return setError('From Date should not exceed To Date.');
    if (!form.reason.trim()) return setError('Reason is mandatory.');
    setSaving(true);
    try {
      const { data } = await api.post('/leaves', form);
      setMessage(data.message);
      setForm({ leaveType: 'CASUAL', fromDate: today, toDate: today, reason: '' });
      await load();
    } catch (e) {
      setError(await getApiError(e));
    } finally { setSaving(false); }
  };

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Apply for Leave" subtitle="Choose your dates from the calendar, add a reason, and submit your request." />
      <Text style={{ color: colors.muted, lineHeight: 21 }}>
        {user?.role === 'EMPLOYEE'
          ? 'Your Manager and that Manager’s Head Manager are notified. The first authorized decision is final.'
          : user?.role === 'MANAGER'
            ? 'Your assigned Head Manager is notified and reviews your leave request.'
            : 'Other active Head Managers are notified. You cannot approve your own leave request.'}
      </Text>

      {!!error && <MessageBox type="danger">{error}</MessageBox>}
      {!!message && <MessageBox type="success">{message}</MessageBox>}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Leave Type</Text>
        <View style={styles.chips}>
          {TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => update('leaveType', type)}
              style={[
                styles.chip,
                {
                  borderColor: form.leaveType === type ? colors.primary : colors.border,
                  backgroundColor: form.leaveType === type ? colors.primarySoft : colors.surfaceAlt,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '800' }}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.tip, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
          <Ionicons name="bulb-outline" size={20} color={colors.gold} />
          <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>{tip}</Text>
        </View>

        <View style={styles.two}>
          <DatePickerField
            style={styles.field}
            label="From Date"
            value={form.fromDate}
            onChange={setFromDate}
            minDate={today}
          />
          <DatePickerField
            style={styles.field}
            label="To Date"
            value={form.toDate}
            onChange={(value) => update('toDate', value)}
            minDate={form.fromDate || today}
          />
        </View>

        <Text style={[styles.dateHelp, { color: colors.muted }]}>
          Today is {today}. Leave can start today or any future date; past dates are disabled in the calendar.
        </Text>

        <FormField
          label="Reason"
          multiline
          value={form.reason}
          onChangeText={(value) => update('reason', value)}
          placeholder="Example: I need leave for a personal appointment."
        />

        <View style={[styles.writingAssist, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={21} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>Writing assistant</Text>
            <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 18, fontSize: 12 }}>
              Write your reason naturally—even broken English is okay—then use Rephrase Reason to make it concise and professional.
            </Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <AppButton style={{ flex: 1 }} title={rephrasing ? 'Rephrasing...' : '✨ Rephrase Reason'} variant="secondary" loading={rephrasing} onPress={rephrase} />
          <AppButton style={{ flex: 1 }} title="Submit Leave Request" loading={saving} onPress={submit} />
        </View>
      </View>

      <Text style={[styles.section, { color: colors.text }]}>Recent requests</Text>
      {requests.slice(0, 5).map((request) => (
        <View key={request.id} style={[styles.request, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={{ color: colors.text, fontWeight: '900' }}>{request.leaveType} · {request.days} day(s)</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{request.fromDate?.slice(0, 10)} → {request.toDate?.slice(0, 10)}</Text>
          </View>
          <Text style={{ color: request.status === 'APPROVED' ? colors.success : request.status === 'REJECTED' ? colors.danger : colors.warning, fontWeight: '900' }}>
            {request.status}
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 900, width: '100%', alignSelf: 'center', gap: 15 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 14 },
  label: { fontSize: 13, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  tip: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 220 },
  dateHelp: { fontSize: 12, lineHeight: 18 },
  writingAssist: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { fontSize: 20, fontWeight: '900', marginTop: 6 },
  request: { borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
