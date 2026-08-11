import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import DatePickerField, { todayDateString, toDateString } from '../src/components/DatePickerField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateString(date);
}

function coordinate(latitude, longitude) {
  if (latitude == null || longitude == null) return '—';
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

export default function HistoryScreen() {
  return <RequireAuth roles={['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER']}><History /></RequireAuth>;
}

function History() {
  const { colors } = useTheme();
  const today = todayDateString();
  const [range, setRange] = useState('7');
  const [custom, setCustom] = useState({ from: daysAgoString(6), to: today });
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (requestedRange = range) => {
    setError('');
    setLoading(true);
    try {
      const params = requestedRange === 'custom' ? { from: custom.from, to: custom.to } : { range: requestedRange };
      const { data } = await api.get('/attendance/history', { params });
      setRecords(data.records || []);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, [range, custom]);

  useEffect(() => { load('7'); }, []);

  const setFrom = (value) => {
    setCustom((current) => ({
      ...current,
      from: value,
      to: current.to && current.to >= value ? current.to : value,
    }));
  };

  const summary = useMemo(() => {
    if (range === 'custom') return `${custom.from || '—'} through ${custom.to || '—'}`;
    return range === '30' ? 'Last 30 days' : 'Last 7 days';
  }, [range, custom]);

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Attendance History" subtitle="Review check-in/out times, working hours, and GPS coordinates." />

      <View style={styles.chips}>
        {[
          ['7', 'Last 7 Days'],
          ['30', 'Last 30 Days'],
          ['custom', 'Custom Range'],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => {
              setRange(value);
              if (value !== 'custom') load(value);
            }}
            style={[
              styles.chip,
              {
                borderColor: range === value ? colors.primary : colors.border,
                backgroundColor: range === value ? colors.primarySoft : colors.surface,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {range === 'custom' && (
        <View style={[styles.custom, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calendarTitleRow}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>Choose attendance dates</Text>
              <Text style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>Use the calendar icons. Future attendance dates are disabled.</Text>
            </View>
          </View>
          <View style={styles.two}>
            <DatePickerField
              style={styles.field}
              label="From"
              value={custom.from}
              onChange={setFrom}
              maxDate={today}
              helperText="Select any previous attendance date"
            />
            <DatePickerField
              style={styles.field}
              label="To"
              value={custom.to}
              onChange={(value) => setCustom((current) => ({ ...current, to: value }))}
              minDate={custom.from || null}
              maxDate={today}
              helperText="Cannot be before From or after today"
            />
          </View>
          <AppButton title={loading ? 'Loading...' : 'Apply Custom Range'} disabled={loading} onPress={() => load('custom')} />
        </View>
      )}

      <View style={[styles.summary, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="funnel-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: '800' }}>{summary}</Text>
        <Text style={{ color: colors.muted }}>{records.length} record{records.length === 1 ? '' : 's'}</Text>
      </View>

      {!!error && <MessageBox type="danger">{error}</MessageBox>}

      {records.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="calendar-clear-outline" size={30} color={colors.muted} />
          <Text style={{ color: colors.text, fontWeight: '900' }}>No attendance records</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>No check-in records were found for this period.</Text>
        </View>
      ) : records.map((record) => (
        <View key={record.id} style={[styles.record, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.recordHeader}>
            <View>
              <Text style={[styles.date, { color: colors.text }]}>{record.workDate?.slice(0, 10)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{record.totalWorkingHours || 'Still checked in'}</Text>
            </View>
            <View style={[styles.hoursBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="time-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '900' }}>{record.totalWorkingHours || 'Active'}</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <Detail label="Check-In Time" value={record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '—'} colors={colors} icon="log-in-outline" />
            <Detail label="Check-Out Time" value={record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : '—'} colors={colors} icon="log-out-outline" />
            <Detail label="Check-In GPS" value={coordinate(record.checkInLatitude, record.checkInLongitude)} colors={colors} icon="location-outline" />
            <Detail label="Check-Out GPS" value={coordinate(record.checkOutLatitude, record.checkOutLongitude)} colors={colors} icon="navigate-outline" />
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Detail({ label, value, colors, icon }) {
  return (
    <View style={[styles.detail, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <View style={styles.detailLabel}>
        <Ionicons name={icon} size={16} color={colors.primary} />
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>{label}</Text>
      </View>
      <Text selectable style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 980, width: '100%', alignSelf: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  custom: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 14 },
  calendarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 240 },
  summary: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  record: { borderWidth: 1, borderRadius: 19, padding: 17, gap: 14 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  date: { fontSize: 17, fontWeight: '900' },
  hoursBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detail: { flexGrow: 1, flexBasis: 210, borderWidth: 1, borderRadius: 14, padding: 12 },
  detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { borderWidth: 1, borderRadius: 19, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
});
