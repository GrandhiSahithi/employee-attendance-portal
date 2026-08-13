/**
 * API Service
 * ===========
 * Configures axios instance for API calls
 * - Handles authentication token injection
 * - Default base URL and timeout
 * - Error handling utility
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';

// Default API base URL (localhost for development)
const defaultBase=Platform.OS==='web'?'http://localhost:4000/api':'http://localhost:4000/api';

/**
 * Axios instance for all API calls
 * - Base URL from env or default
 * - 12 second timeout
 */
export const api=axios.create({
  baseURL:process.env.EXPO_PUBLIC_API_URL||defaultBase,
  timeout:12000
});

/**
 * Request interceptor
 * Automatically injects auth token from storage into Authorization header
 */
api.interceptors.request.use(async(config)=>{
  const token=await authStorage.getItem('authToken');
  if(token)config.headers.Authorization=`Bearer ${token}`;
  return config;
});

/**
 * Extract error message from API response
 * @param {Error} error - Axios error object
 * @param {string} fallback - Default message if none found
 * @returns {string} Error message to display
 */
export async function getApiError(error,fallback='Something went wrong.'){
  return error?.response?.data?.message||error?.message||fallback;
}
