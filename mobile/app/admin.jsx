import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  jobTitle: '', departmentId: '', supervisorId: '', newTeamName: '',
};

const isManagerRole = (role) => role === 'MANAGER' || role === 'HEAD_MANAGER';

export default function AdminScreen() {
  return <RequireAuth roles={['HEAD_MANAGER']}><Admin /></RequireAuth>;
}

function Admin() {
  const { colors } = useTheme();
  const [tab, setTab] = useState('people');
  const [options, setOptions] = useState({ departments: [], heads: [], managers: [] });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [deptName, setDeptName] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
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
  const changeRole = (role) => setForm((current) => ({ ...current, role, supervisorId: '', newTeamName: '' }));
  const selectedFormManager = options.managers.find((manager) => manager.id === form.supervisorId) || null;

  const openManage = (user) => {
    setSelectedId(user.id);
    setEdit({
      role: user.role,
      supervisorId: user.supervisorId || '',
      departmentId: user.departmentId || '',
      jobTitle: user.jobTitle || 'Team Member',
      newTeamName: '',
    });
    setMessage('');
    setError('');
  };

  const managingUser = users.find((user) => user.id === selectedId) || null;
  const editNeedsNewTeam = !!edit && isManagerRole(edit.role) && !managingUser?.leadsTeamId;
  const editSelectedManager = options.managers.find((manager) => manager.id === edit?.supervisorId) || null;

  const createUser = async () => {
    setError(''); setMessage('');
    if (!form.email.trim().toLowerCase().endsWith('@dev.com')) return setError('Head-created accounts use @dev.com. Gmail users must use public Sign Up and verify their OTP.');
    if (!form.departmentId) return setError('Department is required.');
    if (form.role === 'EMPLOYEE' && !form.supervisorId) return setError('Choose a Manager.');
    if (form.role === 'MANAGER' && !form.supervisorId) return setError('Choose a Head Manager.');
    if (form.role !== 'EMPLOYEE' && !form.newTeamName.trim()) return setError(`Enter a name for the new team this ${form.role === 'MANAGER' ? 'Manager' : 'Head Manager'} will lead.`);
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
    if (!selectedId || !edit || !managingUser) return;
    setSaving(true); setError(''); setMessage('');
    try {
      if (edit.role !== 'HEAD_MANAGER' && !edit.supervisorId) throw new Error(edit.role === 'MANAGER' ? 'Choose a Head Manager.' : 'Choose a Manager.');
      if (editNeedsNewTeam && !edit.newTeamName.trim()) throw new Error(`Enter a name for the new team this ${edit.role === 'MANAGER' ? 'Manager' : 'Head Manager'} will lead.`);
      if (!edit.departmentId || !edit.jobTitle.trim()) throw new Error('Department and job title are required.');

      await api.patch(`/management/users/${selectedId}/role`, {
        role: edit.role,
        supervisorId: edit.role === 'HEAD_MANAGER' ? null : edit.supervisorId,
        newTeamName: editNeedsNewTeam ? edit.newTeamName : undefined,
      });
      const { data } = await api.patch(`/management/users/${selectedId}/assignment`, {
        supervisorId: edit.role === 'HEAD_MANAGER' ? null : edit.supervisorId,
        departmentId: edit.departmentId,
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

  const toggleExpanded = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const searchQuery = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    return users.filter((user) => (
      user.name?.toLowerCase().includes(searchQuery)
      || user.email?.toLowerCase().includes(searchQuery)
      || user.employeeId?.toLowerCase().includes(searchQuery)
    ));
  }, [users, searchQuery]);

  const managers = useMemo(
    () => users.filter((user) => isManagerRole(user.role)).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'HEAD_MANAGER' ? -1 : 1)),
    [users],
  );
  const reportsByManagerId = useMemo(() => {
    const map = new Map();
    for (const user of users) {
      if (!user.supervisorId) continue;
      if (!map.has(user.supervisorId)) map.set(user.supervisorId, []);
      map.get(user.supervisorId).push(user);
    }
    return map;
  }, [users]);

  return (
    <Screen contentStyle={styles.page}>
      <PageHeader title="Organization Administration" subtitle="Only Head Managers can create accounts, change roles, and manage reporting relationships." />

      <View style={styles.tabs}>
        {[
          ['people', 'People & Roles'],
          ['create', 'Create Account'],
          ['structure', 'Departments'],
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
          <View style={styles.choices}>{['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER'].map((role) => <Choice key={role} label={role.replaceAll('_', ' ')} active={form.role === role} onPress={() => changeRole(role)} colors={colors} />)}</View>

          <Label text="Department" colors={colors} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Independent of Manager/Team - any department is valid for any role.</Text>
          <View style={styles.choices}>{options.departments.map((department) => <Choice key={department.id} label={department.name} active={form.departmentId === department.id} onPress={() => update('departmentId', department.id)} colors={colors} />)}</View>

          {form.role === 'EMPLOYEE' && <>
            <Label text="Manager" colors={colors} />
            <View style={styles.choices}>{options.managers.map((manager) => <Choice key={manager.id} label={`${manager.name} — ${manager.teamName}`} active={form.supervisorId === manager.id} onPress={() => update('supervisorId', manager.id)} colors={colors} />)}</View>
            <Label text="Team" colors={colors} />
            <View style={styles.choices}>{options.managers.map((manager) => <Choice key={manager.id} label={manager.teamName} active={form.supervisorId === manager.id} onPress={() => update('supervisorId', manager.id)} colors={colors} />)}</View>
            {!!selectedFormManager && <Text style={{ color: colors.muted, fontSize: 12 }}>Reports to {selectedFormManager.name} on team {selectedFormManager.teamName}.</Text>}
          </>}

          {form.role === 'MANAGER' && <>
            <Label text="Reports to Head Manager" colors={colors} />
            <View style={styles.choices}>{options.heads.map((head) => <Choice key={head.id} label={head.name} active={form.supervisorId === head.id} onPress={() => update('supervisorId', head.id)} colors={colors} />)}</View>
            <FormField label="New Team Name" value={form.newTeamName} onChangeText={(value) => update('newTeamName', value)} placeholder="e.g. Pluto" />
            <Text style={{ color: colors.muted, fontSize: 12 }}>This creates a brand-new team led by this Manager.</Text>
          </>}

          {form.role === 'HEAD_MANAGER' && <>
            <FormField label="New Team Name" value={form.newTeamName} onChangeText={(value) => update('newTeamName', value)} placeholder="e.g. Leadership" />
            <Text style={{ color: colors.muted, fontSize: 12 }}>This creates a brand-new team led by this Head Manager.</Text>
          </>}

          <AppButton title="Create Account" loading={saving} onPress={createUser} />
        </View>
      )}

      {tab === 'structure' && (
        <View style={styles.two}>
          <View style={[styles.card, styles.structure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>New Department</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Departments are independent of Manager/Team - creating one doesn't affect any reporting relationship.</Text>
            <FormField label="Department Name" value={deptName} onChangeText={setDeptName} placeholder="Engineering" />
            <AppButton title="Create Department" onPress={createDept} />
          </View>
          <View style={[styles.card, styles.structure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Teams</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Every team is led by exactly one Manager or Head Manager. New teams are created together with a new Manager/Head Manager account, or when promoting someone into that role - see Create Account and People & Roles.</Text>
            <View style={{ gap: 8 }}>
              {managers.map((manager) => (
                <View key={manager.id} style={[styles.teamRow, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{manager.leadsTeamName || '—'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{manager.name} · {manager.role.replaceAll('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {tab === 'people' && (
        <View style={{ gap: 12 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, email, or employee ID..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {searchResults ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{searchResults.length} result{searchResults.length === 1 ? '' : 's'} for "{search.trim()}"</Text>
              {searchResults.length === 0 ? (
                <EmptyState colors={colors} text="No one matches that search." />
              ) : searchResults.map((user) => (
                <PersonCard
                  key={user.id}
                  user={user}
                  colors={colors}
                  contextLine={isManagerRole(user.role)
                    ? `Leads ${user.leadsTeamName || '—'}${user.supervisorName ? ` · Reports to ${user.supervisorName}` : ''}`
                    : `Reports to ${user.supervisorName || '—'} · Team ${user.team || '—'}`}
                  selected={selectedId === user.id}
                  edit={edit}
                  onManage={() => openManage(user)}
                  onToggleStatus={() => toggleStatus(user)}
                  onCancel={() => { setSelectedId(null); setEdit(null); }}
                  onSave={saveManagedUser}
                  saving={saving}
                  setEdit={setEdit}
                  options={options}
                  editNeedsNewTeam={editNeedsNewTeam}
                  editSelectedManager={editSelectedManager}
                />
              ))}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {managers.map((manager) => {
                const isOpen = expanded.has(manager.id);
                const reports = reportsByManagerId.get(manager.id) || [];
                return (
                  <View key={manager.id} style={[styles.managerGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Pressable onPress={() => toggleExpanded(manager.id)} style={styles.managerHeader}>
                      <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.muted} />
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <View style={styles.nameRow}>
                          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{manager.name}</Text>
                          <View style={[styles.roleBadge, { backgroundColor: manager.role === 'HEAD_MANAGER' ? colors.goldSoft : colors.primarySoft }]}>
                            <Text style={{ color: manager.role === 'HEAD_MANAGER' ? colors.gold : colors.primary, fontWeight: '800', fontSize: 11 }}>{manager.role.replaceAll('_', ' ')}</Text>
                          </View>
                          <View style={[styles.statusDot, { backgroundColor: manager.isActive ? colors.success : colors.danger }]} />
                        </View>
                        <Text style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>
                          Team: {manager.leadsTeamName || '—'} · {manager.department || '—'} · {reports.length} report{reports.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <Pressable onPress={() => openManage(manager)} style={[styles.manageBtn, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                        <Ionicons name="settings-outline" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: '900' }}>Manage</Text>
                      </Pressable>
                    </Pressable>

                    {selectedId === manager.id && edit && (
                      <ManagePanel
                        colors={colors}
                        edit={edit}
                        setEdit={setEdit}
                        options={options}
                        editNeedsNewTeam={editNeedsNewTeam}
                        editSelectedManager={editSelectedManager}
                        onSave={saveManagedUser}
                        onCancel={() => { setSelectedId(null); setEdit(null); }}
                        saving={saving}
                      />
                    )}

                    {isOpen && (
                      <View style={styles.reportsList}>
                        {reports.length === 0 ? (
                          <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 6 }}>No one reports to {manager.name} yet.</Text>
                        ) : reports.map((employee) => (
                          <View key={employee.id}>
                            <View style={[styles.employeeRow, { borderTopColor: colors.border }]}>
                              <View style={{ flex: 1, minWidth: 180 }}>
                                <View style={styles.nameRow}>
                                  <Text style={{ color: colors.text, fontWeight: '800' }}>{employee.name}</Text>
                                  <View style={[styles.statusDot, { backgroundColor: employee.isActive ? colors.success : colors.danger }]} />
                                </View>
                                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{employee.employeeId} · {employee.role.replaceAll('_', ' ')} · Dept: {employee.department || '—'}</Text>
                              </View>
                              <View style={styles.personButtons}>
                                <Pressable onPress={() => openManage(employee)} style={[styles.manageBtn, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                                  <Ionicons name="settings-outline" size={15} color={colors.primary} />
                                  <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13 }}>Manage</Text>
                                </Pressable>
                                <Pressable onPress={() => toggleStatus(employee)} style={[styles.manageBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                                  <Text style={{ color: employee.isActive ? colors.danger : colors.success, fontWeight: '900', fontSize: 13 }}>{employee.isActive ? 'Deactivate' : 'Activate'}</Text>
                                </Pressable>
                              </View>
                            </View>
                            {selectedId === employee.id && edit && (
                              <ManagePanel
                                colors={colors}
                                edit={edit}
                                setEdit={setEdit}
                                options={options}
                                editNeedsNewTeam={editNeedsNewTeam}
                                editSelectedManager={editSelectedManager}
                                onSave={saveManagedUser}
                                onCancel={() => { setSelectedId(null); setEdit(null); }}
                                saving={saving}
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function PersonCard({ user, colors, contextLine, selected, edit, onManage, onToggleStatus, onCancel, onSave, saving, setEdit, options, editNeedsNewTeam, editSelectedManager }) {
  return (
    <View style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.personTop}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={styles.nameRow}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{user.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: user.role === 'HEAD_MANAGER' ? colors.goldSoft : user.role === 'MANAGER' ? colors.primarySoft : colors.surfaceAlt }]}>
              <Text style={{ color: user.role === 'HEAD_MANAGER' ? colors.gold : user.role === 'MANAGER' ? colors.primary : colors.text, fontWeight: '800', fontSize: 11 }}>{user.role.replaceAll('_', ' ')}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: user.isActive ? colors.success : colors.danger }]} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{user.employeeId} · {user.email} · Dept: {user.department || '—'}</Text>
          <Text style={{ color: colors.muted, marginTop: 3 }}>{contextLine}</Text>
        </View>
        <View style={styles.personButtons}>
          <Pressable onPress={onManage} style={[styles.manageBtn, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
            <Ionicons name="settings-outline" size={17} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '900' }}>Manage</Text>
          </Pressable>
          <Pressable onPress={onToggleStatus} style={[styles.manageBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={{ color: user.isActive ? colors.danger : colors.success, fontWeight: '900' }}>{user.isActive ? 'Deactivate' : 'Activate'}</Text>
          </Pressable>
        </View>
      </View>

      {selected && edit && (
        <ManagePanel
          colors={colors}
          edit={edit}
          setEdit={setEdit}
          options={options}
          editNeedsNewTeam={editNeedsNewTeam}
          editSelectedManager={editSelectedManager}
          onSave={onSave}
          onCancel={onCancel}
          saving={saving}
        />
      )}
    </View>
  );
}

function ManagePanel({ colors, edit, setEdit, options, editNeedsNewTeam, editSelectedManager, onSave, onCancel, saving }) {
  const changeRole = (role) => setEdit((current) => ({ ...current, role, supervisorId: '', newTeamName: '' }));
  return (
    <View style={[styles.managePanel, { borderTopColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.text }]}>Change role and assignment</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>A role change keeps the same account, attendance history, leave history, email, and profile picture.</Text>

      <Label text="Role" colors={colors} />
      <View style={styles.choices}>{['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER'].map((role) => <Choice key={role} label={role.replaceAll('_', ' ')} active={edit.role === role} onPress={() => changeRole(role)} colors={colors} />)}</View>

      <Label text="Department" colors={colors} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Independent of Manager/Team.</Text>
      <View style={styles.choices}>{options.departments.map((department) => <Choice key={department.id} label={department.name} active={edit.departmentId === department.id} onPress={() => setEdit((current) => ({ ...current, departmentId: department.id }))} colors={colors} />)}</View>

      {edit.role === 'EMPLOYEE' && <>
        <Label text="Manager" colors={colors} />
        <View style={styles.choices}>{options.managers.map((manager) => <Choice key={manager.id} label={`${manager.name} — ${manager.teamName}`} active={edit.supervisorId === manager.id} onPress={() => setEdit((current) => ({ ...current, supervisorId: manager.id }))} colors={colors} />)}</View>
        <Label text="Team" colors={colors} />
        <View style={styles.choices}>{options.managers.map((manager) => <Choice key={manager.id} label={manager.teamName} active={edit.supervisorId === manager.id} onPress={() => setEdit((current) => ({ ...current, supervisorId: manager.id }))} colors={colors} />)}</View>
        {!!editSelectedManager && <Text style={{ color: colors.muted, fontSize: 12 }}>Reports to {editSelectedManager.name} on team {editSelectedManager.teamName}.</Text>}
      </>}

      {edit.role === 'MANAGER' && <>
        <Label text="Reports to Head Manager" colors={colors} />
        <View style={styles.choices}>{options.heads.map((head) => <Choice key={head.id} label={head.name} active={edit.supervisorId === head.id} onPress={() => setEdit((current) => ({ ...current, supervisorId: head.id }))} colors={colors} />)}</View>
      </>}

      {editNeedsNewTeam && (
        <>
          <FormField label="New Team Name" value={edit.newTeamName} onChangeText={(value) => setEdit((current) => ({ ...current, newTeamName: value }))} placeholder="e.g. Pluto" />
          <Text style={{ color: colors.muted, fontSize: 12 }}>This person doesn't lead a team yet - this creates one for them.</Text>
        </>
      )}

      <FormField label="Job Title" value={edit.jobTitle} onChangeText={(value) => setEdit((current) => ({ ...current, jobTitle: value }))} />
      <View style={styles.panelActions}>
        <AppButton style={{ flex: 1 }} title="Save Role & Assignment" loading={saving} onPress={onSave} />
        <AppButton style={{ flex: 1 }} title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

function EmptyState({ colors, text }) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="people-outline" size={26} color={colors.muted} />
      <Text style={{ color: colors.muted, fontWeight: '700' }}>{text}</Text>
    </View>
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
  teamRow: { borderWidth: 1, borderRadius: 12, padding: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 46, fontSize: 15 },
  person: { borderWidth: 1, borderRadius: 17, padding: 15, gap: 12 },
  personTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  roleBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  personButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  manageBtn: { minHeight: 39, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  managePanel: { borderTopWidth: 1, paddingTop: 14, gap: 11, marginTop: 12 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  managerGroup: { borderWidth: 1, borderRadius: 17, padding: 15 },
  managerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  reportsList: { marginTop: 10, paddingLeft: 26 },
  employeeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingVertical: 10 },
  empty: { borderWidth: 1, borderRadius: 18, padding: 30, alignItems: 'center', gap: 8 },
});
