/**
 * AuthContext and AuthProvider
 * ============================
 * Manages user authentication state and provides auth functions throughout the app.
 * Features:
 * - Persists auth token and user data in AsyncStorage
 * - Auto-loads user session on app startup
 * - Provides login, signup, logout, and refreshUser functions
 * - Starts attendance sync listener on boot
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { startAttendanceSyncListener } from '../services/offlineAttendance';

/**
 * AuthContext - provides user, booting, login, signup, logout, refreshUser
 */
const AuthContext=createContext(null);

/**
 * AuthProvider Component
 * Wraps the app to provide authentication context
 */
export function AuthProvider({children}){
 // User object (null when logged out)
 const [user,setUser]=useState(null);
 // Booting flag - true while loading saved session from storage
 const [booting,setBooting]=useState(true);
 
 /**
  * Initialize auth on app startup
  * - Load saved token from AsyncStorage
  * - Fetch current user data from API
  * - Start offline attendance sync listener
  */
 useEffect(()=>{
   let alive=true;
   let stop=()=>{};
   (async()=>{
     try{
       // Try to get saved token from local storage
       const token=await AsyncStorage.getItem('authToken');
       if(token){
         // If token exists, fetch current user
         const {data}=await api.get('/auth/me');
         if(alive)setUser(data.user);
       }
     }catch{
       // If error, clear auth storage (token expired)
       await AsyncStorage.multiRemove(['authToken','authUser']);
     }finally{
       if(alive)setBooting(false);
     }
   })();
   // Start listening for offline attendance sync
   stop=startAttendanceSyncListener();
   return()=>{alive=false;stop?.();}
 },[]);
 
 /**
  * Persist auth data (token and user) to storage
  */
 const persist=async(data)=>{
   await AsyncStorage.setItem('authToken',data.token);
   await AsyncStorage.setItem('authUser',JSON.stringify(data.user));
   setUser(data.user);
   return data.user;
 };
 
 /**
  * Login function
  * @param {string} email - User email
  * @param {string} password - User password
  */
 const login=async(email,password)=>persist((await api.post('/auth/login',{email,password})).data);
 
 /**
  * Signup function
  * @param {object} payload - Signup form data
  */
 const signup=async(payload)=>persist((await api.post('/auth/signup',payload)).data);
 
 /**
  * Logout function
  * - Clears auth from storage
  * - Sets user to null
  */
 const logout=async()=>{
   await AsyncStorage.multiRemove(['authToken','authUser']);
   setUser(null);
 };
 
 /**
  * Refresh user data from API
  * Called when user profile changes
  */
 const refreshUser=async()=>{
   const {data}=await api.get('/auth/me');
   setUser(data.user);
   await AsyncStorage.setItem('authUser',JSON.stringify(data.user));
   return data.user;
 };
 
 // Memoize context value to prevent unnecessary re-renders
 const value=useMemo(()=>({user,booting,login,signup,logout,refreshUser}),[user,booting]);
 
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook
 * Get auth context in any component
 */
export function useAuth(){
  const v=useContext(AuthContext);
  if(!v)throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
