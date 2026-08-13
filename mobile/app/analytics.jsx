import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';
import { authStorage } from '../src/services/authStorage';

const RANGES = [
  [7, 'Last 7 Days'],
  [30, 'Last 30 Days'],
  [90, 'Last 90 Days'],
];

const LEAVE_STATUS_META = {
  LOW: { label: 'Low balance', color: 'rose' },
  NORMAL: { label: 'Normal', color: 'primary' },
  HIGH: { label: 'High / underused', color: 'gold' },
};

export default function AnalyticsScreen() {
  return <RequireAuth roles={['MANAGER', 'HEAD_MANAGER']}><Analytics /></RequireAuth>;
}

function Analytics() {
  const { colors } = useTheme();
  const [range, setRange] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const [token, setToken] = useState(null);

  const load = useCallback(async (selectedRange) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/management/analytics', { params: { range: selectedRange } });
      setAnalytics(data);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);
  // Pre-load the token so the export click below can call Linking.openURL
  // with zero `await`s before it — calling it after an await breaks the
  // browser's "was this a direct user gesture" check and gets silently
  // popup-blocked instead of opening the download.
  useEffect(() => { authStorage.getItem('authToken').then(setToken); }, []);

  const exportReport = (format) => {
    setExporting(format);
    setError('');
    try {
      const url = `${api.defaults.baseURL}/management/analytics/export?format=${format}&range=${range}&token=${encodeURIComponent(token || '')}`;
      Linking.openURL(url);
    } catch (e) {
      setError('Unable to open the export link.');
    } finally {
      setExporting('');
    }
  };

  const teamAverage = analytics?.employees?.length
    ? Math.round((analytics.employees.reduce((sum, e) => sum + e.attendancePercent, 0) / analytics.employees.length) * 10) / 10
    : 0;
  const lowBalanceCount = analytics?.employees?.filter((e) => e.leaveBalanceStatus === 'LOW').length || 0;

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Analytics" subtitle="Attendance %, punctuality, and leave balances for the people assigned to you." />
      {!!error && <MessageBox type="danger">{error}</MessageBox>}

      <View style={styles.chips}>
        {RANGES.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setRange(value)}
            style={[styles.chip, { borderColor: range === value ? colors.primary : colors.border, backgroundColor: range === value ? colors.primarySoft : colors.surface }]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <LoadingView label="Crunching the numbers..." /> : !!analytics && (
        <>
          <View style={styles.summaryRow}>
            <SummaryCard colors={colors} icon="bar-chart-outline" label="Team avg. attendance" value={`${teamAverage}%`} tint="primary" />
            <SummaryCard colors={colors} icon="calendar-outline" label="Working days in range" value={String(analytics.workingDays)} tint="lilac" />
            <SummaryCard colors={colors} icon="alert-circle-outline" label="Low leave balance" value={String(lowBalanceCount)} tint="rose" />
            <SummaryCard colors={colors} icon="people-outline" label="People in view" value={String(analytics.employees.length)} tint="gold" />
          </View>

          <View style={styles.exportRow}>
            <AppButton style={{ flex: 1 }} title={exporting === 'csv' ? 'Opening...' : '⬇️ Export CSV'} variant="secondary" loading={exporting === 'csv'} onPress={() => exportReport('csv')} />
            <AppButton style={{ flex: 1 }} title={exporting === 'pdf' ? 'Opening...' : '⬇️ Export PDF'} variant="secondary" loading={exporting === 'pdf'} onPress={() => exportReport('pdf')} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Export uses the same date range selected above, ready for payroll.</Text>

          {analytics.employees.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="bar-chart-outline" size={30} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: '900' }}>No one assigned to you yet</Text>
            </View>
          ) : analytics.employees.map((employee) => {
            const leaveMeta = LEAVE_STATUS_META[employee.leaveBalanceStatus] || LEAVE_STATUS_META.NORMAL;
            return (
              <View key={employee.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1.4 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{employee.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{employee.role.replaceAll('_', ' ')} · {employee.team || employee.department || '—'}</Text>
                </View>
                <Metric colors={colors} label="Attendance" value={`${employee.attendancePercent}%`} />
                <Metric colors={colors} label="Punctuality" value={employee.punctualityPercent == null ? '—' : `${employee.punctualityPercent}%`} />
                <View style={[styles.leavePill, { backgroundColor: colors[`${leaveMeta.color}Soft`] }]}>
                  <Text style={{ color: colors[leaveMeta.color], fontWeight: '800', fontSize: 12 }}>{employee.availableLeaveDays}d · {leaveMeta.label}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function SummaryCard({ colors, icon, label, value, tint }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors[`${tint}Soft`], borderColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={colors[tint]} />
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Metric({ colors, label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 900, width: '100%', alignSelf: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: 150, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '700' },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { borderWidth: 1, borderRadius: 18, padding: 30, alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, flexWrap: 'wrap' },
  metric: { minWidth: 80, alignItems: 'flex-start' },
  leavePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
});
