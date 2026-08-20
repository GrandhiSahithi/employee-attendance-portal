/**
 * Attendance Screen
 * =================
 * Lets the signed-in user check in/check out for the day, capturing GPS
 * coordinates with each action. Works offline: if there's no network when
 * marking attendance, the action is queued locally and synced automatically
 * once connectivity returns (see src/services/offlineAttendance.js).
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';
import { queueAttendanceAction, syncQueuedAttendance } from '../src/services/offlineAttendance';

// Formats a latitude/longitude pair for display, or '—' if not captured.
function gps(latitude, longitude) {
  if (latitude == null || longitude == null) return '—';
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

// Route-guarded entry point: any authenticated role may view this screen.
export default function AttendanceScreen() {
  return (
    <RequireAuth roles={['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER']}>
      <Attendance />
    </RequireAuth>
  );
}

// Main Attendance screen: today's status card plus Check In / Check Out buttons.
function Attendance() {
  const { colors } = useTheme();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastCaptured, setLastCaptured] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/today');
      setRecord(data.attendance);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Captures the device's current GPS location and records a check-in or
  // check-out. Queues the action offline via offlineAttendance if there's
  // no network, otherwise posts it immediately and triggers a sync.
  const mark = async (type) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission is required to mark attendance.');

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const payload = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date().toISOString(),
      };
      setLastCaptured({ type, ...payload });

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await queueAttendanceAction(type, payload);
        setMessage(`${type === 'check-in' ? 'Check-in' : 'Check-out'} saved offline with GPS and will sync when internet returns.`);
      } else {
        const { data } = await api.post(`/attendance/${type}`, payload);
        setMessage(data.message);
        await syncQueuedAttendance();
      }
      await load();
    } catch (e) {
      setError(await getApiError(e, e.message || 'Unable to mark attendance.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen scroll={false}><LoadingView label="Loading attendance..." /></Screen>;

  const status = record?.checkOutTime ? 'CHECKED OUT' : record?.checkInTime ? 'CHECKED IN' : 'NOT CHECKED IN';

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Attendance" subtitle="Every attendance action stores date, time, latitude, and longitude." />
      {!!error && <MessageBox type="danger">{error}</MessageBox>}
      {!!message && <MessageBox type="success">{message}</MessageBox>}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>TODAY&apos;S STATUS</Text>
            <Text style={[styles.status, { color: colors.text }]}>{status}</Text>
          </View>
          <View style={[styles.locationIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="location" size={28} color={colors.primary} />
          </View>
        </View>

        <View style={styles.rows}>
          <Row label="Check-In Time" value={record?.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '—'} colors={colors} />
          <Row label="Check-In GPS (Latitude, Longitude)" value={gps(record?.checkInLatitude, record?.checkInLongitude)} colors={colors} mono />
          <Row
            label="Check-Out Time"
            value={record?.checkOutTime ? `${new Date(record.checkOutTime).toLocaleTimeString()}${record.checkoutType === 'AUTOMATIC' ? ' (Auto)' : ''}` : '—'}
            colors={colors}
          />
          <Row label="Check-Out GPS (Latitude, Longitude)" value={gps(record?.checkOutLatitude, record?.checkOutLongitude)} colors={colors} mono />
        </View>

        {!!lastCaptured && (
          <View style={[styles.captureNote, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.muted, flex: 1 }}>
              Last captured GPS: {gps(lastCaptured.latitude, lastCaptured.longitude)}
            </Text>
          </View>
        )}

        <View style={styles.buttons}>
          <AppButton
            style={{ flex: 1 }}
            title="Check In"
            disabled={!!record?.checkInTime}
            loading={busy}
            onPress={() => mark('check-in')}
          />
          <AppButton
            style={{ flex: 1 }}
            title="Check Out"
            variant="secondary"
            disabled={!record?.checkInTime || !!record?.checkOutTime}
            loading={busy}
            onPress={() => mark('check-out')}
          />
        </View>
      </View>
    </Screen>
  );
}

// Renders one labeled value row inside the status card (e.g. Check-In Time).
function Row({ label, value, colors, mono = false }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.muted, flex: 1 }}>{label}</Text>
      <Text selectable style={[styles.rowValue, { color: colors.text }, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 780, width: '100%', alignSelf: 'center', gap: 15 },
  card: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  status: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  locationIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rows: { gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1 },
  rowValue: { fontWeight: '900', textAlign: 'right', flexShrink: 1 },
  mono: { fontVariant: ['tabular-nums'] },
  captureNote: { borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
