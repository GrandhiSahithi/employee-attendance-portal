import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { startAttendanceSyncListener } from '../services/offlineAttendance';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null); const [booting,setBooting]=useState(true);
 useEffect(()=>{let alive=true; let stop=()=>{};(async()=>{try{const token=await AsyncStorage.getItem('authToken');if(token){const {data}=await api.get('/auth/me');if(alive)setUser(data.user);}}catch{await AsyncStorage.multiRemove(['authToken','authUser']);}finally{if(alive)setBooting(false);}})();stop=startAttendanceSyncListener();return()=>{alive=false;stop?.();};},[]);
 const persist=async(data)=>{await AsyncStorage.setItem('authToken',data.token);await AsyncStorage.setItem('authUser',JSON.stringify(data.user));setUser(data.user);return data.user;};
 const login=async(email,password)=>persist((await api.post('/auth/login',{email,password})).data);
 const signup=async(payload)=>persist((await api.post('/auth/signup',payload)).data);
 const logout=async()=>{await AsyncStorage.multiRemove(['authToken','authUser']);setUser(null);};
 const refreshUser=async()=>{const {data}=await api.get('/auth/me');setUser(data.user);await AsyncStorage.setItem('authUser',JSON.stringify(data.user));return data.user;};
 const value=useMemo(()=>({user,booting,login,signup,logout,refreshUser}),[user,booting]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const v=useContext(AuthContext);if(!v)throw new Error('useAuth must be used inside AuthProvider');return v;}
