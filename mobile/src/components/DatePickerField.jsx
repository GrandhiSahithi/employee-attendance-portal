import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getHolidayMap } from '../utils/holidays';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayDateString() {
  return toDateString(new Date());
}

export default function DatePickerField({
  label,
  value,
  onChange,
  minDate = null,
  maxDate = null,
  placeholder = 'YYYY-MM-DD',
  helperText,
  style,
}) {
  const { colors } = useTheme();
  const selected = fromDateString(value);
  const minimum = minDate ? startOfDay(fromDateString(minDate) || new Date(1900, 0, 1)) : null;
  const maximum = maxDate ? startOfDay(fromDateString(maxDate) || new Date(2100, 11, 31)) : null;

  const fallback = selected || maximum || minimum || new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(fallback.getFullYear(), fallback.getMonth(), 1));
  const [previewDate, setPreviewDate] = useState(null);

  const holidayMap = useMemo(() => getHolidayMap(month.getFullYear() - 1, month.getFullYear() + 1), [month]);

  const days = useMemo(() => {
    const firstWeekday = month.getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const openCalendar = () => {
    let base = selected || new Date();
    if (minimum && startOfDay(base) < minimum) base = minimum;
    if (maximum && startOfDay(base) > maximum) base = maximum;
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setPreviewDate(value || null);
    setOpen(true);
  };

  const disabledDate = (date) => {
    const normalized = startOfDay(date);
    return Boolean((minimum && normalized < minimum) || (maximum && normalized > maximum));
  };

  const choose = (date) => {
    if (!date || disabledDate(date)) return;
    const dateString = toDateString(date);
    onChange(dateString);
    setPreviewDate(dateString);
    // Non-holiday picks keep the existing snappy auto-close. A holiday pick
    // stays open so its name shows below the grid, like tapping an event in
    // Google Calendar, until the user explicitly closes.
    if (!holidayMap[dateString]) setOpen(false);
  };

  const previewHolidayName = previewDate ? holidayMap[previewDate] : null;

  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const minimumMonth = minimum ? new Date(minimum.getFullYear(), minimum.getMonth(), 1) : null;
  const maximumMonth = maximum ? new Date(maximum.getFullYear(), maximum.getMonth(), 1) : null;
  const canGoPrevious = !minimumMonth || previousMonth >= minimumMonth;
  const canGoNext = !maximumMonth || nextMonth <= maximumMonth;

  const constraintText = helperText || [
    minimum ? `From ${toDateString(minimum)}` : null,
    maximum ? `Through ${toDateString(maximum)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text }]}
          autoCapitalize="none"
          inputMode="numeric"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${label} calendar`}
          onPress={openCalendar}
          style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {!!constraintText && <Text style={[styles.helper, { color: colors.muted }]}>{constraintText}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.monthHeader}>
              <Pressable
                disabled={!canGoPrevious}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                style={[styles.navButton, !canGoPrevious && styles.disabled]}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                disabled={!canGoNext}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                style={[styles.navButton, !canGoNext && styles.disabled]}
              >
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekday, { color: colors.muted }]}>{day}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((date, index) => {
                if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const dateString = toDateString(date);
                const disabled = disabledDate(date);
                const active = dateString === value;
                const today = dateString === todayDateString();
                const holidayName = holidayMap[dateString];
                return (
                  <View key={dateString} style={styles.dayCell}>
                    <Pressable
                      disabled={disabled}
                      onPress={() => choose(date)}
                      accessibilityLabel={holidayName ? `${dateString}, ${holidayName}` : dateString}
                      style={({ pressed }) => [
                        styles.dayButton,
                        active && { backgroundColor: colors.primary },
                        !active && today && { borderColor: colors.primary, borderWidth: 1 },
                        pressed && !disabled && styles.pressed,
                      ]}
                    >
                      <Text style={{
                        color: disabled ? colors.border : active ? '#FFFFFF' : colors.text,
                        fontWeight: active || today ? '900' : '600',
                      }}>
                        {date.getDate()}
                      </Text>
                      {!!holidayName && (
                        <View style={[styles.holidayDot, { backgroundColor: active ? '#FFFFFF' : colors.rose }]} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {!!previewHolidayName && (
              <View style={[styles.holidayBanner, { backgroundColor: colors.roseSoft, borderColor: colors.rose }]}>
                <Ionicons name="sparkles-outline" size={16} color={colors.rose} />
                <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
                  {previewDate === value ? 'Selected date is a public holiday: ' : ''}{previewHolidayName}
                </Text>
              </View>
            )}

            <View style={styles.modalFooter}>
              {!!constraintText && <Text style={[styles.hint, { color: colors.muted }]}>{constraintText}</Text>}
              <Pressable onPress={() => setOpen(false)} style={[styles.done, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Close Calendar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 7 },
  label: { fontSize: 13, fontWeight: '800' },
  inputRow: { minHeight: 49, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 13, fontSize: 15, outlineStyle: 'none' },
  calendarButton: { width: 50, height: 48, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 11, lineHeight: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 430, borderRadius: 22, borderWidth: 1, padding: 18, gap: 13 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 18, fontWeight: '900' },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  dayButton: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  holidayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  holidayBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  modalFooter: { marginTop: 4, gap: 10 },
  hint: { fontSize: 11, lineHeight: 17 },
  done: { minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.3 },
});
