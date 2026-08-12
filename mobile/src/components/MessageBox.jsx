/**
 * MessageBox Component
 * ===================
 * Displays an alert/message box with different types (info, success, danger)
 * Used throughout the app to show feedback messages
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * MessageBox Component
 * @param {string} children - Message text to display
 * @param {string} type - Message type: 'info' (default), 'success', or 'danger'
 */
export default function MessageBox({children,type='info'}){
  const {colors}=useTheme();
  // Select border color based on message type
  const c=type==='danger'?colors.danger:type==='success'?colors.success:colors.info;
  return <View style={[styles.box,{borderColor:c,backgroundColor:colors.surfaceAlt}]}>
    <Text style={{color:colors.text,fontWeight:'700'}}>{children}</Text>
  </View>
}

/**
 * StyleSheet Definitions for MessageBox
 * ====================================
 */
const styles=StyleSheet.create({
  // Message container - rounded box with colored border
  box:{borderWidth:1,borderRadius:12,padding:12}
});
