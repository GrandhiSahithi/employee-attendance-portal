import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
const QUEUE_KEY='attendanceQueue';
async function readQueue(){try{return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))||'[]');}catch{return [];}}
async function writeQueue(items){await AsyncStorage.setItem(QUEUE_KEY,JSON.stringify(items));}
export async function queueAttendanceAction(type,payload){const items=await readQueue();items.push({id:`${Date.now()}-${Math.random()}`,type,payload});await writeQueue(items);return items.length;}
export async function syncQueuedAttendance(){const state=await NetInfo.fetch();if(!state.isConnected)return {synced:0,remaining:(await readQueue()).length};const items=await readQueue();const remaining=[];let synced=0;for(const item of items){try{await api.post(`/attendance/${item.type}`,item.payload);synced++;}catch(e){if(item.type==='check-in'&&e?.response?.status===409){synced++;}else{remaining.push(item);}}}await writeQueue(remaining);return {synced,remaining:remaining.length};}
export function startAttendanceSyncListener(){return NetInfo.addEventListener((state)=>{if(state.isConnected)syncQueuedAttendance().catch(()=>{});});}
