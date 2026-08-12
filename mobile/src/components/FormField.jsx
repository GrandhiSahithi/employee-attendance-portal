/**
 * FormField Component
 * ==================
 * A reusable form input field component with label.
 * Features:
 * - Label above input field
 * - Theme-aware colors
 * - Support for multiline text areas
 * - Styled border and background
 */

import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * FormField Component
 * @param {string} label - Label text displayed above the input
 * @param {object} style - Additional styles to apply to container
 * @param {boolean} multiline - Enable multiline input (like textarea)
 * @param {...props} props - All other TextInput props (value, onChangeText, placeholder, etc.)
 */
export default function FormField({label, style, multiline, ...props}){
 const {colors}=useTheme();
 return <View style={[styles.wrap,style]}>
   {/* Label text */}
   <Text style={[styles.label,{color:colors.text}]}>{label}</Text>
   {/* Text input field with theme colors */}
   <TextInput 
     placeholderTextColor={colors.muted} 
     multiline={multiline} 
     style={[styles.input,{color:colors.text,backgroundColor:colors.surface,borderColor:colors.border},multiline&&styles.multi]} 
     {...props}
   />
 </View>;
}

/**
 * StyleSheet Definitions for FormField
 * ===================================
 */
const styles=StyleSheet.create({
  // Container for label and input
  wrap:{gap:7},
  // Label text - bold, small
  label:{fontWeight:'800',fontSize:13},
  // Text input field - 48px min height, border, rounded corners, padding
  input:{minHeight:48,borderWidth:1,borderRadius:13,paddingHorizontal:14,fontSize:15},
  // Multiline field - taller (110px), padding top, align text to top
  multi:{minHeight:110,paddingTop:13,textAlignVertical:'top'}
});
