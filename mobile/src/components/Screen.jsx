import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function Screen({ children, scroll = true, contentStyle }) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>;
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>{body}</SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, flex: { flex: 1 }, content: { padding: 20, paddingBottom: 44 } });
