/**
 * Team Leave Calendar Screen
 * ==========================
 * Month-view calendar showing who is on approved/pending leave on each
 * day. Scope depends on the signed-in user's role: their own team, or
 * (for Head Managers) the whole organization. Tapping a day shows the
 * list of people out that day.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Route-guarded entry point: any authenticated role may view this screen.
export default function TeamCalendarScreen() {
  return <RequireAuth><TeamCalendar /></RequireAuth>;
}

// Main Team Calendar screen: month navigation, calendar grid with leave markers, and a selected-day detail panel.
function TeamCalendar() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [requests, setRequests] = useState([]);
  const [teamName, setTeamName] = useState(null);
  const [scope, setScope] = useState('TEAM');
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (targetMonth) => {
    setLoading(true);
    setError('');
    try {
      const from = toDateString(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
      const to = toDateString(new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0));
      const { data } = await api.get('/leaves/team-calendar', { params: { from, to } });
      setRequests(data.requests || []);
      setTeamName(data.teamName || null);
      setScope(data.scope || 'TEAM');
      setMessage(data.message || '');
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const days = useMemo(() => {
    const firstWeekday = month.getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  // Returns the leave requests that cover the given date.
  const whoIsOut = useCallback((dateString) => {
    return requests.filter((request) => dateString >= request.fromDate?.slice(0, 10) && dateString <= request.toDate?.slice(0, 10));
  }, [requests]);

  const selectedEntries = selectedDate ? whoIsOut(selectedDate) : [];

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader
        title={scope === 'ORG' ? 'Organization Leave Calendar' : 'Team Leave Calendar'}
        subtitle={scope === 'ORG'
          ? "Who's out across every team in the organization."
          : teamName ? `Who's out on ${teamName} — check before requesting your own dates.` : 'Who else on your team is out before requesting your own dates.'}
      />
      {!!error && <MessageBox type="danger">{error}</MessageBox>}
      {!!message && <MessageBox type="info">{message}</MessageBox>}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.monthHeader}>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.navButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>

        {loading ? <LoadingView label="Loading team calendar..." /> : (
          <>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => <Text key={day} style={[styles.weekday, { color: colors.muted }]}>{day}</Text>)}
            </View>
            <View style={styles.grid}>
              {days.map((date, index) => {
                if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const dateString = toDateString(date);
                const entries = whoIsOut(dateString);
                const active = dateString === selectedDate;
                return (
                  <View key={dateString} style={styles.dayCell}>
                    <Pressable
                      onPress={() => setSelectedDate(dateString)}
                      style={[styles.dayButton, active && { backgroundColor: colors.primary }]}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: active ? '900' : '600' }}>{date.getDate()}</Text>
                      {entries.length > 0 && <View style={[styles.dot, { backgroundColor: active ? '#FFFFFF' : colors.rose }]} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {!!selectedDate && (
              <View style={[styles.detail, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 6 }}>{selectedDate}</Text>
                {selectedEntries.length === 0 ? (
                  <Text style={{ color: colors.muted }}>{scope === 'ORG' ? 'No one is out this day.' : 'No one on your team is out this day.'}</Text>
                ) : selectedEntries.map((entry) => (
                  <View key={entry.id} style={styles.detailRow}>
                    <Ionicons name={entry.status === 'PENDING' ? 'time-outline' : 'checkmark-circle-outline'} size={16} color={entry.status === 'PENDING' ? colors.gold : colors.primary} />
                    <Text style={{ color: colors.text, flex: 1 }}>
                      {entry.employeeName}{scope === 'ORG' && entry.team ? ` (${entry.team})` : ''} · {entry.leaveType} {entry.status === 'PENDING' ? '(pending)' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 700, width: '100%', alignSelf: 'center', gap: 15 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 13 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 18, fontWeight: '900' },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  dayButton: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  detail: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
