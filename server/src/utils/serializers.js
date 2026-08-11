export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    phone: user.phone || null,
    profilePicture: user.profilePicture || null,
    role: user.role,
    jobTitle: user.jobTitle || null,
    availableLeaveDays: user.availableLeaveDays,
    isActive: user.isActive,
    department: user.department?.name || null,
    departmentId: user.departmentId || null,
    team: user.team?.name || null,
    teamId: user.teamId || null,
    supervisorId: user.supervisorId || null,
    supervisorName: user.supervisor?.name || null,
    supervisorRole: user.supervisor?.role || null,
  };
}

export function attendanceDto(record) {
  if (!record) return null;
  const totalWorkingMinutes = record.checkOutTime
    ? Math.max(0, Math.round((new Date(record.checkOutTime) - new Date(record.checkInTime)) / 60000))
    : null;
  const totalWorkingHours = totalWorkingMinutes == null ? null : `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`;
  return { ...record, totalWorkingMinutes, totalWorkingHours };
}

export function leaveDto(request) {
  if (!request) return null;
  return {
    id: request.id,
    userId: request.userId,
    employeeName: request.user?.name || null,
    employeeId: request.user?.employeeId || null,
    leaveType: request.leaveType,
    fromDate: request.fromDate,
    toDate: request.toDate,
    reason: request.reason,
    days: request.days,
    status: request.status,
    reviewedByName: request.reviewedBy?.name || null,
    reviewedAt: request.reviewedAt,
    createdAt: request.createdAt,
  };
}
