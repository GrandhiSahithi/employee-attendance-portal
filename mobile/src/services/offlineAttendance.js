/**
 * Offline Attendance Service
 * ==========================
 * Handles offline attendance syncing
 * When internet is unavailable, stores attendance locally
 * When internet returns, automatically syncs all queued actions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

// Storage key for queued attendance actions
const QUEUE_KEY='attendanceQueue';

/**
 * Read all queued attendance actions from local storage
 * @returns {array} Array of queued attendance items
 */
async function readQueue(){
  try{
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))||'[]');
  }catch{
    return [];
  }
}

/**
 * Save attendance queue to local storage
 * @param {array} items - Array of attendance items to save
 */
async function writeQueue(items){
  await AsyncStorage.setItem(QUEUE_KEY,JSON.stringify(items));
}

/**
 * Queue an attendance action when offline
 * @param {string} type - 'check-in' or 'check-out'
 * @param {object} payload - {latitude, longitude, capturedAt}
 * @returns {number} Total items in queue
 */
export async function queueAttendanceAction(type,payload){
  const items=await readQueue();
  // Add new item with unique ID
  items.push({
    id:`${Date.now()}-${Math.random()}`,
    type,
    payload
  });
  await writeQueue(items);
  return items.length;
}

/**
 * Sync all queued attendance actions to the server
 * Only works when internet is available
 * @returns {object} {synced: number, remaining: number}
 */
export async function syncQueuedAttendance(){
  // Check network connectivity
  const state=await NetInfo.fetch();
  if(!state.isConnected)return {synced:0,remaining:(await readQueue()).length};
  
  const items=await readQueue();
  const remaining=[];
  let synced=0;
  
  // Try to sync each queued item
  for(const item of items){
    try{
      // Send to API
      await api.post(`/attendance/${item.type}`,item.payload);
      synced++;
    }catch(e){
      // Special case: 409 conflict (already checked in) is considered success
      if(item.type==='check-in'&&e?.response?.status===409){
        synced++;
      }else{
        // Keep failed items in queue for retry
        remaining.push(item);
      }
    }
  }
  
  // Update queue with only failed items
  await writeQueue(remaining);
  return {synced,remaining:remaining.length};
}

/**
 * Start listening for network connectivity changes
 * Automatically syncs attendance when internet returns
 * @returns {function} Unsubscribe function
 */
export function startAttendanceSyncListener(){
  return NetInfo.addEventListener((state)=>{
    if(state.isConnected)syncQueuedAttendance().catch(()=>{});
  });
}
