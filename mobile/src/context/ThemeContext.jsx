import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const light = {
  mode: 'light', primary: '#557C6B', primarySoft: '#E9F2EC', rose: '#D9A5B3', roseSoft: '#FAEEF1',
  gold: '#D5B36C', goldSoft: '#FBF4E4', lilac: '#A99BC7', lilacSoft: '#F1EDF8',
  background: '#F7F5F0', surface: '#FFFEFB', surfaceAlt: '#F2F5F1', text: '#26322C', muted: '#6D7872',
  border: '#DDE4DE', success: '#3E7B5C', warning: '#A57A2E', danger: '#B75D67', info: '#6687A7',
};
const dark = {
  mode: 'dark', primary: '#91B9A5', primarySoft: '#203329', rose: '#D9A9B8', roseSoft: '#38272D',
  gold: '#E0C27D', goldSoft: '#372F20', lilac: '#B9ACD4', lilacSoft: '#2E2938',
  background: '#101612', surface: '#18201B', surfaceAlt: '#202A24', text: '#F4F5F1', muted: '#ABB7B0',
  border: '#334139', success: '#8BC6A4', warning: '#E4C577', danger: '#E49AA0', info: '#9CB6CC',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light');
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('themeMode').then((saved) => {
      if (mounted && (saved === 'light' || saved === 'dark')) setMode(saved);
    });
    return () => { mounted = false; };
  }, []);
  const toggleTheme = async () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    await AsyncStorage.setItem('themeMode', next);
  };
  const colors = mode === 'light' ? light : dark;
  const value = useMemo(() => ({ mode, colors, toggleTheme }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
