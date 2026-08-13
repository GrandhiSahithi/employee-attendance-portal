/**
 * Data Serializers / DTOs
 * =======================
 * Transform database objects into safe API response formats
 * Excludes sensitive fields and formats data for client consumption
 */

/**
 * Transform user object for public API responses
 * Removes sensitive data like password hashes, includes related data
 * @param {object} user - User object from database
 * @returns {object} Public user DTO with safe fields only
 */
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
    // The team this person owns as its Manager/Head Manager (distinct from
    // `team` above, which is just team membership). Null for Employees and
    // for a Manager/Head Manager whose team hasn't been created yet.
    leadsTeamId: user.managedTeam?.id || null,
    leadsTeamName: user.managedTeam?.name || null,
    supervisorId: user.supervisorId || null,
    supervisorName: user.supervisor?.name || null,
    supervisorRole: user.supervisor?.role || null,
  };
}

/**
 * Transform attendance record for API responses
 * Calculates working hours from check-in/check-out times
 * @param {object} record - Attendance record from database
 * @returns {object} Attendance DTO with calculated working hours
 */
export function attendanceDto(record) {
  if (!record) return null;
  // Calculate total minutes worked
  const totalWorkingMinutes = record.checkOutTime
    ? Math.max(0, Math.round((new Date(record.checkOutTime) - new Date(record.checkInTime)) / 60000))
    : null;
  // Format as human-readable hours and minutes
  const totalWorkingHours = totalWorkingMinutes == null ? null : `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`;
  return { ...record, totalWorkingMinutes, totalWorkingHours };
}

/**
 * Transform leave request for API responses
 * Includes employee name, reviewer name, and status
 * @param {object} request - Leave request from database
 * @returns {object} Leave request DTO with formatted data
 */
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
