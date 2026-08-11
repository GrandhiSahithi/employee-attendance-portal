import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
const defaultBase=Platform.OS==='web'?'http://localhost:4000/api':'http://localhost:4000/api';
export const api=axios.create({baseURL:process.env.EXPO_PUBLIC_API_URL||defaultBase,timeout:12000});
api.interceptors.request.use(async(config)=>{const token=await AsyncStorage.getItem('authToken');if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
export async function getApiError(error,fallback='Something went wrong.'){return error?.response?.data?.message||error?.message||fallback;}
