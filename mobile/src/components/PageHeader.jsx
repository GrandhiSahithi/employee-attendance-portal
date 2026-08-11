import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export default function PageHeader({ title, subtitle, dashboardOnly = false, fallbackRoute = '/dashboard' }) {
  const { colors } = useTheme();
  const goBack = () => {
    if (dashboardOnly) {
      router.replace('/dashboard');
      return;
    }
    try {
      if (router.canGoBack?.()) router.back();
      else router.replace(fallbackRoute);
    } catch {
      router.replace(fallbackRoute);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={goBack}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="arrow-back" size={21} color={colors.text} />
      </Pressable>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
