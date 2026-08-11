import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
export default function AppButton({ title, onPress, loading, disabled, variant='primary', style }) {
  const { colors } = useTheme();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surfaceAlt;
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.text;
  return <Pressable disabled={disabled || loading} onPress={onPress} style={({pressed})=>[styles.btn,{backgroundColor:bg,borderColor:colors.border,opacity:(disabled||loading)?0.55:pressed?0.78:1},style]}>{loading?<ActivityIndicator color={fg}/>:<Text style={[styles.text,{color:fg}]}>{title}</Text>}</Pressable>;
}
const styles=StyleSheet.create({btn:{minHeight:48,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',paddingHorizontal:18},text:{fontWeight:'900',fontSize:14}});
