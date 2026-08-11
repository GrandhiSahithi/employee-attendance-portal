import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
export default function MessageBox({children,type='info'}){const {colors}=useTheme();const c=type==='danger'?colors.danger:type==='success'?colors.success:colors.info;return <View style={[styles.box,{borderColor:c,backgroundColor:colors.surfaceAlt}]}><Text style={{color:colors.text,fontWeight:'700'}}>{children}</Text></View>}
const styles=StyleSheet.create({box:{borderWidth:1,borderRadius:12,padding:12}});
