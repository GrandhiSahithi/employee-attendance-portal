/**
 * LoadingView Component
 * ====================
 * Displays a centered loading spinner with optional label text
 * Used when loading data or processing requests
 */

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * LoadingView Component
 * @param {string} label - Loading message text (default: 'Loading...')
 */
export default function LoadingView({label='Loading...'}){
  const {colors}=useTheme();
  return <View style={styles.wrap}>
    {/* Large spinner animation in theme primary color */}
    <ActivityIndicator size="large" color={colors.primary}/>
    {/* Label text below spinner */}
    <Text style={{color:colors.muted,fontWeight:'700'}}>{label}</Text>
  </View>
}

/**
 * StyleSheet Definitions for LoadingView
 * ====================================
 */
const styles=StyleSheet.create({
  // Centered loading container
  wrap:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:12}
});
