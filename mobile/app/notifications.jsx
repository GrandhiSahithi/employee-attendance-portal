import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import AppButton from '../src/components/AppButton';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';
export default function NotificationsScreen(){return <RequireAuth><Notifications/></RequireAuth>}
function Notifications(){const {colors}=useTheme();const [items,setItems]=useState([]);const load=useCallback(async()=>setItems((await api.get('/notifications')).data.notifications||[]),[]);useEffect(()=>{load();},[load]);const read=async(id)=>{await api.patch(`/notifications/${id}/read`);await load();};return <Screen contentStyle={styles.page}><PageHeader title="Notifications" /><AppButton title="Mark All as Read" variant="secondary" onPress={async()=>{await api.patch('/notifications/read-all');await load();}}/>{items.length===0?<Text style={{color:colors.muted}}>No notifications yet.</Text>:items.map(n=><Pressable key={n.id} onPress={()=>read(n.id)} style={[styles.card,{backgroundColor:n.isRead?colors.surface:colors.primarySoft,borderColor:colors.border}]}><Text style={{color:colors.text,fontWeight:'900'}}>{n.title}</Text><Text style={{color:colors.muted,lineHeight:20,marginTop:5}}>{n.message}</Text><Text style={{color:colors.muted,fontSize:11,marginTop:8}}>{new Date(n.createdAt).toLocaleString()}</Text></Pressable>)}</Screen>}
const styles=StyleSheet.create({page:{maxWidth:820,width:'100%',alignSelf:'center',gap:12},title:{fontSize:28,fontWeight:'900'},card:{borderWidth:1,borderRadius:15,padding:15}});
