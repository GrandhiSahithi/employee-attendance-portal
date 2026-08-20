/**
 * Index / Entry Route
 * ===================
 * The app's root route ("/"). Shows a loading screen while the stored
 * session is being restored, then redirects to /dashboard if signed in
 * or /login otherwise.
 */

import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import LoadingView from '../src/components/LoadingView';
import Screen from '../src/components/Screen';
export default function Index(){const {user,booting}=useAuth();if(booting)return <Screen scroll={false}><LoadingView label="Opening Dev Employee Portal..."/></Screen>;return <Redirect href={user?'/dashboard':'/login'}/>;}
