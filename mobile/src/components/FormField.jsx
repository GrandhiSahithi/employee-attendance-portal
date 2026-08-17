/**
 * FormField Component
 * ==================
 * A reusable form input field component with label.
 * Features:
 * - Label above input field
 * - Theme-aware colors
 * - Support for multiline text areas
 * - Styled border and background
 * - secureTextEntry fields get a show/hide toggle button
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * FormField Component
 * @param {string} label - Label text displayed above the input
 * @param {object} style - Additional styles to apply to container
 * @param {boolean} multiline - Enable multiline input (like textarea)
 * @param {boolean} secureTextEntry - Masks input; renders a show/hide eye toggle
 * @param {...props} props - All other TextInput props (value, onChangeText, placeholder, etc.)
 */
export default function FormField({label, style, multiline, secureTextEntry, ...props}){
 const {colors}=useTheme();
 const [visible,setVisible]=useState(false);

 if(!secureTextEntry){
   return <View style={[styles.wrap,style]}>
     <Text style={[styles.label,{color:colors.text}]}>{label}</Text>
     <TextInput
       placeholderTextColor={colors.muted}
       multiline={multiline}
       style={[styles.input,{color:colors.text,backgroundColor:colors.surface,borderColor:colors.border},multiline&&styles.multi]}
       {...props}
     />
   </View>;
 }

 return <View style={[styles.wrap,style]}>
   {/* Label text */}
   <Text style={[styles.label,{color:colors.text}]}>{label}</Text>
   {/* Password field: input + show/hide toggle share one bordered row */}
   <View style={[styles.row,{backgroundColor:colors.surface,borderColor:colors.border}]}>
     <TextInput
       placeholderTextColor={colors.muted}
       secureTextEntry={!visible}
       style={[styles.rowInput,{color:colors.text}]}
       {...props}
     />
     <Pressable
       accessibilityRole="button"
       accessibilityLabel={visible?'Hide password':'Show password'}
       onPress={()=>setVisible((v)=>!v)}
       style={({pressed})=>[styles.toggle,pressed&&styles.pressed]}
     >
       <Ionicons name={visible?'eye-off-outline':'eye-outline'} size={20} color={colors.muted} />
     </Pressable>
   </View>
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
  multi:{minHeight:110,paddingTop:13,textAlignVertical:'top'},
  // Bordered row shared by the password input and its show/hide toggle
  row:{minHeight:48,borderWidth:1,borderRadius:13,flexDirection:'row',alignItems:'center',overflow:'hidden'},
  rowInput:{flex:1,minHeight:46,paddingHorizontal:14,fontSize:15},
  toggle:{width:44,height:46,alignItems:'center',justifyContent:'center'},
  pressed:{opacity:0.6}
});
