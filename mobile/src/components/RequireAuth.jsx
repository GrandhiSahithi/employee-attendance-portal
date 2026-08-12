/**
 * RequireAuth Component
 * ====================
 * Route guard that ensures a user is authenticated before accessing a route.
 * Also supports role-based access control.
 * Features:
 * - Checks authentication status
 * - Shows loading screen during session restore
 * - Redirects to login if not authenticated
 * - Redirects to dashboard if user lacks required role
 */

import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import Screen from './Screen';
import LoadingView from './LoadingView';

/**
 * RequireAuth Component
 * @param {React.ReactNode} children - Content to show if authenticated
 * @param {array} roles - Optional array of allowed roles (e.g., ['MANAGER', 'HEAD_MANAGER'])
 */
export default function RequireAuth({children,roles}){
  const {user,booting}=useAuth();
  
  // Show loading screen while restoring session from AsyncStorage
  if(booting)return <Screen scroll={false}><LoadingView label="Restoring session..."/></Screen>;
  
  // No user = redirect to login
  if(!user)return <Redirect href="/login"/>;
  
  // User lacks required role = redirect to dashboard
  if(roles&&!roles.includes(user.role))return <Redirect href="/dashboard"/>;
  
  // User is authenticated and authorized - show content
  return children;
}
