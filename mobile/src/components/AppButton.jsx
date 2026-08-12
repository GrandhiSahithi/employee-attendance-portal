/**
 * AppButton Component
 * ==================
 * A reusable button component used throughout the app.
 * Features:
 * - Three variants: primary (blue), danger (red), secondary (light)
 * - Loading state with spinner animation
 * - Disabled state with reduced opacity
 * - Theme-aware colors
 * - Press feedback with opacity change
 */

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * AppButton Component
 * @param {string} title - Button text label
 * @param {function} onPress - Callback when button is pressed
 * @param {boolean} loading - Show loading spinner (disables button)
 * @param {boolean} disabled - Disable the button
 * @param {string} variant - Button style: 'primary' (default), 'danger', or 'secondary'
 * @param {object} style - Additional styles to apply
 */
export default function AppButton({ title, onPress, loading, disabled, variant='primary', style }) {
  const { colors } = useTheme();
  
  // Determine background color based on variant
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surfaceAlt;
  // Determine text color - white for primary/danger, theme text for secondary
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.text;
  
  return <Pressable disabled={disabled || loading} onPress={onPress} style={({pressed})=>[styles.btn,{backgroundColor:bg,borderColor:colors.border,opacity:(disabled||loading)?0.55:pressed?0.78:1},style]}>{loading?<ActivityIndicator color={fg}/>:<Text style={[styles.text,{color:fg}]}>{title}</Text>}</Pressable>;
}

/**
 * StyleSheet Definitions for AppButton
 * ====================================
 */
const styles=StyleSheet.create({
  // Button container - 48px minimum height, rounded corners with border
  btn:{minHeight:48,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',paddingHorizontal:18},
  // Button text - bold, 14px
  text:{fontWeight:'900',fontSize:14}
});
