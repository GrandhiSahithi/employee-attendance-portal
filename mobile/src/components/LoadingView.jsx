import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
export default function LoadingView({label='Loading...'}){const {colors}=useTheme();return <View style={styles.wrap}><ActivityIndicator size="large" color={colors.primary}/><Text style={{color:colors.muted,fontWeight:'700'}}>{label}</Text></View>}
const styles=StyleSheet.create({wrap:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:12}});
