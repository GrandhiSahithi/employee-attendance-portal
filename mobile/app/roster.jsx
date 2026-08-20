/**
 * Roster Screen ("Who's In Today")
 * =================================
 * Manager/Head Manager screen showing a live roster of everyone assigned
 * to them today: checked in, checked out, on leave, or not checked in yet,
 * plus summary counts per status.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

// Icon and tint color per today's-attendance-status value.
const STATUS_META = {
  'CHECKED IN': { icon: 'checkmark-circle', color: 'primary' },
  'CHECKED OUT': { icon: 'log-out-outline', color: 'lilac' },
  'ON LEAVE': { icon: 'airplane-outline', color: 'gold' },
  'NOT CHECKED IN': { icon: 'alert-circle-outline', color: 'rose' },
};

// Route-guarded entry point: only Managers and Head Managers may view this screen.
export default function RosterScreen() {
  return <RequireAuth roles={['MANAGER', 'HEAD_MANAGER']}><Roster /></RequireAuth>;
}

// Main Roster screen: status summary counts plus a per-employee live status list.
function Roster() {
  const { colors } = useTheme();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/management/team');
      setEmployees(data.employees || []);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const base = { 'CHECKED IN': 0, 'CHECKED OUT': 0, 'ON LEAVE': 0, 'NOT CHECKED IN': 0 };
    employees.forEach((employee) => { base[employee.todayAttendanceStatus] = (base[employee.todayAttendanceStatus] || 0) + 1; });
    return base;
  }, [employees]);

  if (loading) return <Screen scroll={false}><LoadingView label="Loading today's roster..." /></Screen>;

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Who's In Today" subtitle="Live roster of who's checked in, on leave, or hasn't checked in yet." />
      {!!error && <MessageBox type="danger">{error}</MessageBox>}

      <View style={styles.summaryRow}>
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <View key={status} style={[styles.summaryCard, { backgroundColor: colors[`${meta.color}Soft`], borderColor: colors.border }]}>
            <Ionicons name={meta.icon} size={20} color={colors[meta.color]} />
            <Text style={[styles.summaryValue, { color: colors.text }]}>{counts[status]}</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{status}</Text>
          </View>
        ))}
      </View>

      <AppButton title="Refresh" variant="secondary" onPress={load} />

      {employees.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="people-outline" size={30} color={colors.muted} />
          <Text style={{ color: colors.text, fontWeight: '900' }}>No one assigned to you yet</Text>
        </View>
      ) : employees.map((employee) => {
        const meta = STATUS_META[employee.todayAttendanceStatus] || STATUS_META['NOT CHECKED IN'];
        return (
          <View key={employee.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>{employee.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{employee.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                {employee.jobTitle || employee.role.replaceAll('_', ' ')} · {employee.team || employee.department || '—'}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: colors[`${meta.color}Soft`] }]}>
              <Ionicons name={meta.icon} size={14} color={colors[meta.color]} />
              <Text style={{ color: colors[meta.color], fontWeight: '800', fontSize: 12 }}>
                {employee.todayAttendanceStatus}{employee.onLeaveType ? ` (${employee.onLeaveType})` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 820, width: '100%', alignSelf: 'center', gap: 14 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: 130, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'flex-start', gap: 4 },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 18, padding: 30, alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
});
