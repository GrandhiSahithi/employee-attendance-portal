/**
 * Profile Screen
 * ==============
 * Shows the signed-in user's work profile (name, employee ID, role, job
 * title, department, team, supervisor, contact info) and lets them edit
 * their name/phone number or upload a new profile picture.
 */

import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import LoadingView from '../src/components/LoadingView';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

// Route-guarded entry point: any authenticated role may view this screen.
export default function ProfileScreen() {
  return <RequireAuth><Profile /></RequireAuth>;
}

// Main Profile screen: avatar/details header, read-only info list, and an editable name/phone form.
function Profile() {
  const { colors } = useTheme();
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/profile');
      setProfile(data.profile);
      setForm({ name: data.profile.name || '', phone: data.profile.phone || '' });
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Discards edits and reverts the form to the last loaded profile values.
  const cancelEdit = () => {
    setForm({ name: profile?.name || '', phone: profile?.phone || '' });
    setEditing(false);
    setError('');
  };

  // Saves the edited name/phone, refreshes the shared auth user, and exits edit mode.
  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.put('/profile', { name: form.name, phone: form.phone });
      setProfile(data.profile);
      setForm({ name: data.profile.name || '', phone: data.profile.phone || '' });
      await refreshUser();
      setMessage(data.message);
      setEditing(false);
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setSaving(false);
    }
  };

  // Opens the device image picker, then uploads the chosen image as the new profile picture.
  const photo = async () => {
    setError('');
    setMessage('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    if (asset.file) {
      formData.append('photo', asset.file, asset.fileName || 'profile.jpg');
    } else {
      formData.append('photo', {
        uri: asset.uri,
        name: asset.fileName || 'profile.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }

    try {
      const { data } = await api.post('/profile/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(data.profile);
      await refreshUser();
      setMessage(data.message);
    } catch (e) {
      setError(await getApiError(e));
    }
  };

  if (loading) return <Screen scroll={false}><LoadingView label="Loading profile..." /></Screen>;

  const image = profile?.profilePicture ? `${api.defaults.baseURL.replace('/api', '')}${profile.profilePicture}` : null;

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Profile" subtitle="Review your work profile and update your name, phone number, or profile picture." />
      {!!error && <MessageBox type="danger">{error}</MessageBox>}
      {!!message && <MessageBox type="success">{message}</MessageBox>}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.header}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.primarySoft }]}>
              <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900' }}>{profile?.name?.slice(0, 1)?.toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={[styles.name, { color: colors.text }]}>{profile?.name}</Text>
            <Text style={{ color: colors.muted }}>{profile?.employeeId} · {profile?.role?.replaceAll('_', ' ')}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{profile?.jobTitle || '—'} · {profile?.department || '—'} · {profile?.team || '—'}</Text>
          </View>
          <Pressable
            onPress={() => (editing ? cancelEdit() : setEditing(true))}
            style={[styles.editButton, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
          >
            <Ionicons name={editing ? 'close-outline' : 'create-outline'} size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '900' }}>{editing ? 'Cancel' : 'Edit Profile'}</Text>
          </Pressable>
        </View>

        <AppButton title="Upload / Change Profile Picture" variant="secondary" onPress={photo} />

        <View style={[styles.infoSection, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Info label="Full Name" value={profile?.name} colors={colors} icon="person-outline" />
          <Info label="Email" value={profile?.email} colors={colors} icon="mail-outline" />
          <Info label="Phone Number" value={profile?.phone || 'Not added'} colors={colors} icon="call-outline" />
          <Info label="Reports To" value={profile?.supervisor?.name || profile?.supervisorName || '—'} colors={colors} icon="git-network-outline" />
          <Info label="Department" value={profile?.department || '—'} colors={colors} icon="business-outline" />
          <Info label="Team / Section" value={profile?.team || '—'} colors={colors} icon="people-outline" />
        </View>

        {editing && (
          <View style={[styles.editor, { borderColor: colors.border }]}>
            <View style={styles.editorHeading}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <View>
                <Text style={{ color: colors.text, fontWeight: '900' }}>Edit profile details</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Only your name and phone number are editable here.</Text>
              </View>
            </View>
            <FormField label="Full Name" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Full name" />
            <FormField label="Phone Number" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" placeholder="Phone number" />
            <AppButton title="Save Profile" loading={saving} onPress={save} />
          </View>
        )}
      </View>
    </Screen>
  );
}

// Renders one read-only labeled row in the profile info section.
function Info({ label, value, colors, icon }) {
  return (
    <View style={[styles.info, { borderBottomColor: colors.border }]}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon} size={17} color={colors.primary} />
        <Text style={{ color: colors.muted }}>{label}</Text>
      </View>
      <Text selectable style={{ color: colors.text, fontWeight: '800', textAlign: 'right', flexShrink: 1 }}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 820, width: '100%', alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  avatar: { width: 88, height: 88, borderRadius: 26 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 25, fontWeight: '900' },
  editButton: { borderWidth: 1, borderRadius: 12, minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoSection: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  infoLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  editor: { borderTopWidth: 1, paddingTop: 16, gap: 13 },
  editorHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
});
