import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import Screen from './Screen';
import LoadingView from './LoadingView';
export default function RequireAuth({children,roles}){const {user,booting}=useAuth();if(booting)return <Screen scroll={false}><LoadingView label="Restoring session..."/></Screen>;if(!user)return <Redirect href="/login"/>;if(roles&&!roles.includes(user.role))return <Redirect href="/dashboard"/>;return children;}
