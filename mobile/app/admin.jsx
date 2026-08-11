import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RequireAuth from '../src/components/RequireAuth';
import Screen from '../src/components/Screen';
import PageHeader from '../src/components/PageHeader';
import FormField from '../src/components/FormField';
import AppButton from '../src/components/AppButton';
import MessageBox from '../src/components/MessageBox';
import { useTheme } from '../src/context/ThemeContext';
import { api, getApiError } from '../src/services/api';

const EMPTY = {
  name: '', employeeId: '', email: '', password: 'password-123', phone: '', role: 'EMPLOYEE',
  jobTitle: '', departmentId: '', teamId: '', supervisorId: '',
};

export default function AdminScreen() {
  return <RequireAuth roles={['HEAD_MANAGER']}><Admin /></RequireAuth>;
}

function Admin() {
  const { colors } = useTheme();
  const [tab, setTab] = useState('people');
  const [options, setOptions] = useState({ departments: [], teams: [], heads: [], managers: [], employees: [] });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [deptName, setDeptName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [optionResponse, userResponse] = await Promise.all([
        api.get('/organization/options'),
        api.get('/management/users'),
      ]);
      setOptions(optionResponse.data);
      setUsers(userResponse.data.users || []);
    } catch (e) {
      setError(await getApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const createTeams = useMemo(() => options.teams.filter((team) => team.departmentId === form.departmentId), [options, form.departmentId]);
  const createSupervisors = form.role === 'EMPLOYEE' ? options.managers : form.role === 'MANAGER' ? options.heads : [];

  const openManage = (user) => {
    setSelectedId(user.id);
    setEdit({
      role: user.role,
      supervisorId: user.supervisorId || '',
      departmentId: user.departmentId || '',
      teamId: user.teamId || '',
      jobTitle: user.jobTitle || 'Team Member',
    });
    setMessage('');
    setError('');
  };

  const editTeams = useMemo(
    () => options.teams.filter((team) => team.departmentId === edit?.departmentId),
    [options, edit?.departmentId],
  );
  const editSupervisors = edit?.role === 'EMPLOYEE' ? options.managers : edit?.role === 'MANAGER' ? options.heads : [];

  const createUser = async () => {
    setError(''); setMessage('');
    if (!form.email.trim().toLowerCase().endsWith('@dev.com')) return setError('Head-created accounts use @dev.com. Gmail users must use public Sign Up and verify their OTP.');
    if (!form.departmentId || !form.teamId) return setError('Department and team are required.');
    if (form.role !== 'HEAD_MANAGER' && !form.supervisorId) return setError(form.role === 'MANAGER' ? 'Choose a Head Manager.' : 'Choose a Manager.');
    setSaving(true);
    try {
      const { data } = await api.post('/management/users', { ...form, email: form.email.trim().toLowerCase() });
      setMessage(data.message);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setError(await getApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const saveManagedUser = async () => {
    if (!selectedId || !edit) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const selected = users.find((user) => user.id === selectedId);
      if (!selected) throw new Error('User not found.');
      if (edit.role !== 'HEAD_MANAGER' && !edit.supervisorId) throw new Error(edit.role === 'MANAGER' ? 'Choose a Head Manager.' : 'Choose a Manager.');
      if (!edit.departmentId || !edit.teamId || !edit.jobTitle.trim()) throw new Error('Department, team and job title are required.');

      await api.patch(`/management/users/${selectedId}/role`, {
        role: edit.role,
        supervisorId: edit.role === 'HEAD_MANAGER' ? null : edit.supervisorId,
      });
      const { data } = await api.patch(`/management/users/${selectedId}/assignment`, {
        supervisorId: edit.role === 'HEAD_MANAGER' ? null : edit.supervisorId,
        departmentId: edit.departmentId,
        teamId: edit.teamId,
        jobTitle: edit.jobTitle,
      });
      setMessage(`Role and assignment updated for ${data.user.name}.`);
      setSelectedId(null);
      setEdit(null);
      await load();
    } catch (e) {
      setError(await getApiError(e, e.message || 'Unable to update user.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    setError(''); setMessage('');
    try {
      const { data } = await api.patch(`/management/users/${user.id}/status`, { isActive: !user.isActive });
      setMessage(data.message);
      await load();
    } catch (e) {
      setError(await getApiError(e));
    }
  };

  const createDept = async () => {
    setError(''); setMessage('');
    try {
      const { data } = await api.post('/organization/departments', { name: deptName });
      setMessage(data.message); setDeptName(''); await load();
    } catch (e) { setError(await getApiError(e)); }
  };

  const createTeam = async () => {
    setError(''); setMessage('');
    try {
      const { data } = await api.post('/organization/teams', { name: teamName, departmentId: teamDept });
      setMessage(data.message); setTeamName(''); await load();
    } catch (e) { setError(await getApiError(e)); }
  };

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Organization Administration" subtitle="Only Head Managers can create accounts, change roles, and manage reporting relationships." />

      <View style={styles.tabs}>
        {[
          ['people', 'People & Roles'],
          ['create', 'Create Account'],
          ['structure', 'Departments & Teams'],
        ].map(([value, label]) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, { borderColor: tab === value ? colors.primary : colors.border, backgroundColor: tab === value ? colors.primarySoft : colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {!!message && <MessageBox type="success">{message}</MessageBox>}
      {!!error && <MessageBox type="danger">{error}</MessageBox>}

      {tab === 'create' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Create company account</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>Head-created accounts use @dev.com. A Gmail user creates their own account through Sign Up so the mailbox can be verified by OTP.</Text>
          <View style={styles.two}>
            <FormField style={styles.field} label="Full Name" value={form.name} onChangeText={(value) => update('name', value)} />
            <FormField style={styles.field} label="Employee ID" value={form.employeeId} onChangeText={(value) => update('employeeId', value)} />
          </View>
          <FormField label="Email" value={form.email} onChangeText={(value) => update('email', value.toLowerCase())} autoCapitalize="none" placeholder="name@dev.com" />
          <FormField label="Password" value={form.password} onChangeText={(value) => update('password', value)} secureTextEntry />
          <View style={styles.two}>
            <FormField style={styles.field} label="Phone" value={form.phone} onChangeText={(value) => update('phone', value)} />
            <FormField style={styles.field} label="Job Title" value={form.jobTitle} onChangeText={(value) => update('jobTitle', value)} />
          </View>
          <Label text="Role" colors={colors} />
          <View style={styles.choices}>{['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER'].map((role) => <Choice key={role} label={role.replaceAll('_', ' ')} active={form.role === role} onPress={() => update('role', role)} colors={colors} />)}</View>
          <Label text="Department" colors={colors} />
          <View style={styles.choices}>{options.departments.map((department) => <Choice key={department.id} label={department.name} active={form.departmentId === department.id} onPress={() => { update('departmentId', department.id); update('teamId', ''); }} colors={colors} />)}</View>
          <Label text="Team / Section" colors={colors} />
          <View style={styles.choices}>{createTeams.map((team) => <Choice key={team.id} label={team.name} active={form.teamId === team.id} onPress={() => update('teamId', team.id)} colors={colors} />)}</View>
          {form.role !== 'HEAD_MANAGER' && <>
            <Label text={form.role === 'MANAGER' ? 'Head Manager' : 'Manager'} colors={colors} />
            <View style={styles.choices}>{createSupervisors.map((supervisor) => <Choice key={supervisor.id} label={supervisor.name} active={form.supervisorId === supervisor.id} onPress={() => update('supervisorId', supervisor.id)} colors={colors} />)}</View>
          </>}
          <AppButton title="Create Account" loading={saving} onPress={createUser} />
        </View>
      )}

      {tab === 'structure' && (
        <View style={styles.two}>
          <View style={[styles.card, styles.structure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>New Department</Text>
            <FormField label="Department Name" value={deptName} onChangeText={setDeptName} placeholder="Engineering" />
            <AppButton title="Create Department" onPress={createDept} />
          </View>
          <View style={[styles.card, styles.structure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>New Team / Section</Text>
            <FormField label="Team Name" value={teamName} onChangeText={setTeamName} placeholder="Platform" />
            <Label text="Department" colors={colors} />
            <View style={styles.choices}>{options.departments.map((department) => <Choice key={department.id} label={department.name} active={teamDept === department.id} onPress={() => setTeamDept(department.id)} colors={colors} />)}</View>
            <AppButton title="Create Team" onPress={createTeam} />
          </View>
        </View>
      )}

      {tab === 'people' && (
        <View style={{ gap: 10 }}>
          {users.map((user) => (
            <View key={user.id} style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.personTop}>
                <View style={{ flex: 1, minWidth: 220 }}>
                  <View style={styles.nameRow}>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{user.name}</Text>
                    <View style={[styles.statusDot, { backgroundColor: user.isActive ? colors.success : colors.danger }]} />
                  </View>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>{user.employeeId} · {user.role?.replaceAll('_', ' ')} · {user.department || '—'} / {user.team || '—'}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>Reports to: {user.supervisorName || '—'}</Text>
                </View>
                <View style={styles.personButtons}>
                  <Pressable onPress={() => openManage(user)} style={[styles.manageBtn, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                    <Ionicons name="settings-outline" size={17} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '900' }}>Manage</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleStatus(user)} style={[styles.manageBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Text style={{ color: user.isActive ? colors.danger : colors.success, fontWeight: '900' }}>{user.isActive ? 'Deactivate' : 'Activate'}</Text>
                  </Pressable>
                </View>
              </View>

              {selectedId === user.id && edit && (
                <View style={[styles.managePanel, { borderTopColor: colors.border }]}>
                  <Text style={[styles.panelTitle, { color: colors.text }]}>Change role and assignment</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>A role change keeps the same account, attendance history, leave history, email, and profile picture.</Text>

                  <Label text="Role" colors={colors} />
                  <View style={styles.choices}>{['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER'].map((role) => <Choice key={role} label={role.replaceAll('_', ' ')} active={edit.role === role} onPress={() => setEdit((current) => ({ ...current, role, supervisorId: role === 'HEAD_MANAGER' ? '' : current.supervisorId }))} colors={colors} />)}</View>

                  {edit.role !== 'HEAD_MANAGER' && <>
                    <Label text={edit.role === 'MANAGER' ? 'Reports to Head Manager' : 'Reports to Manager'} colors={colors} />
                    <View style={styles.choices}>{editSupervisors.filter((supervisor) => supervisor.id !== user.id).map((supervisor) => <Choice key={supervisor.id} label={supervisor.name} active={edit.supervisorId === supervisor.id} onPress={() => setEdit((current) => ({ ...current, supervisorId: supervisor.id }))} colors={colors} />)}</View>
                  </>}

                  <Label text="Department" colors={colors} />
                  <View style={styles.choices}>{options.departments.map((department) => <Choice key={department.id} label={department.name} active={edit.departmentId === department.id} onPress={() => setEdit((current) => ({ ...current, departmentId: department.id, teamId: '' }))} colors={colors} />)}</View>

                  <Label text="Team / Section" colors={colors} />
                  <View style={styles.choices}>{editTeams.map((team) => <Choice key={team.id} label={team.name} active={edit.teamId === team.id} onPress={() => setEdit((current) => ({ ...current, teamId: team.id }))} colors={colors} />)}</View>

                  <FormField label="Job Title" value={edit.jobTitle} onChangeText={(value) => setEdit((current) => ({ ...current, jobTitle: value }))} />
                  <View style={styles.panelActions}>
                    <AppButton style={{ flex: 1 }} title="Save Role & Assignment" loading={saving} onPress={saveManagedUser} />
                    <AppButton style={{ flex: 1 }} title="Cancel" variant="secondary" onPress={() => { setSelectedId(null); setEdit(null); }} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Label({ text, colors }) {
  return <Text style={[styles.label, { color: colors.text }]}>{text}</Text>;
}

function Choice({ label, active, onPress, colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: active ? '900' : '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1120, width: '100%', alignSelf: 'center', gap: 14 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 13 },
  cardTitle: { fontSize: 19, fontWeight: '900' },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 220 },
  structure: { flex: 1, minWidth: 280 },
  label: { fontSize: 13, fontWeight: '900' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  person: { borderWidth: 1, borderRadius: 17, padding: 15, gap: 12 },
  personTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  personButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  manageBtn: { minHeight: 39, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  managePanel: { borderTopWidth: 1, paddingTop: 14, gap: 11 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
});
