/**
 * Management Screen (Leave Approvals)
 * ===================================
 * Manager/Head Manager screen listing pending leave requests assigned to
 * their approval scope, with Approve/Reject actions. The first authorized
 * decision (by any eligible Manager/Head Manager) is final.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

// Route-guarded entry point: only Managers and Head Managers may view this screen.
export default function ManagementScreen(){return <RequireAuth roles={['MANAGER','HEAD_MANAGER']}><Management/></RequireAuth>}
// Main Management screen: pending leave request list with approve/reject controls.
function Management(){
  const {colors}=useTheme();
  const [requests,setRequests]=useState([]);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busyId,setBusyId]=useState('');
  const load=useCallback(async()=>{setError('');try{setRequests((await api.get('/management/leaves/pending')).data.requests||[]);}catch(e){setError(await getApiError(e));}},[]);
  useEffect(()=>{load();},[load]);
  // Approves or rejects the given leave request, then reloads the pending list.
  const decide=async(id,status)=>{setMessage('');setError('');setBusyId(id);try{const {data}=await api.patch(`/management/leaves/${id}`,{status});setMessage(data.message);await load();}catch(e){setError(await getApiError(e));}finally{setBusyId('');}};
  return <Screen contentStyle={styles.page}><PageHeader title="Leave Approvals" /><Text style={{color:colors.muted,lineHeight:21}}>Only employee leave requests assigned to your approval scope appear here. The first authorized Manager or Head Manager decision is final.</Text>{!!message&&<MessageBox type="success">{message}</MessageBox>}{!!error&&<MessageBox type="danger">{error}</MessageBox>}{requests.length===0?<View style={[styles.empty,{backgroundColor:colors.surface,borderColor:colors.border}]}><Text style={{color:colors.text,fontWeight:'900'}}>No pending requests</Text><Text style={{color:colors.muted,marginTop:5}}>Your approval queue is clear.</Text></View>:requests.map(r=><View key={r.id} style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}><View style={{flex:1,minWidth:220}}><Text style={[styles.name,{color:colors.text}]}>{r.employeeName||r.user?.name||'Employee'}</Text><Text style={{color:colors.muted,marginTop:5}}>{r.leaveType} · {r.days} day(s) · {r.fromDate?.slice(0,10)} → {r.toDate?.slice(0,10)}</Text><Text style={{color:colors.text,lineHeight:20,marginTop:10}}>{r.reason}</Text></View><View style={styles.buttons}><AppButton title="Approve" loading={busyId===r.id} onPress={()=>decide(r.id,'APPROVED')}/><AppButton title="Reject" variant="danger" disabled={!!busyId} onPress={()=>decide(r.id,'REJECTED')}/></View></View>)}</Screen>;
}
const styles=StyleSheet.create({page:{maxWidth:950,width:'100%',alignSelf:'center',gap:14},title:{fontSize:28,fontWeight:'900'},empty:{borderWidth:1,borderRadius:18,padding:18},card:{borderWidth:1,borderRadius:18,padding:18,flexDirection:'row',flexWrap:'wrap',gap:16,justifyContent:'space-between',alignItems:'center'},name:{fontSize:18,fontWeight:'900'},buttons:{flexDirection:'row',gap:8,flexWrap:'wrap'}});
