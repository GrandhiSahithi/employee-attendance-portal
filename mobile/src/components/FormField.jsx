import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
export default function FormField({label, style, multiline, ...props}){
 const {colors}=useTheme();
 return <View style={[styles.wrap,style]}><Text style={[styles.label,{color:colors.text}]}>{label}</Text><TextInput placeholderTextColor={colors.muted} multiline={multiline} style={[styles.input,{color:colors.text,backgroundColor:colors.surface,borderColor:colors.border},multiline&&styles.multi]} {...props}/></View>;
}
const styles=StyleSheet.create({wrap:{gap:7},label:{fontWeight:'800',fontSize:13},input:{minHeight:48,borderWidth:1,borderRadius:13,paddingHorizontal:14,fontSize:15},multi:{minHeight:110,paddingTop:13,textAlignVertical:'top'}});
