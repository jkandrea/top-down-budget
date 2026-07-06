export type DiaryRole = "owner" | "manager" | "viewer" | "guest";

export function canViewDiary(role: DiaryRole | null): boolean {
  return role !== null;
}

export function canEditDiary(role: DiaryRole | null): boolean {
  return role === "owner" || role === "manager";
}

export function canManageMembers(role: DiaryRole | null): boolean {
  return role === "owner";
}

export function resolveRole(params: {
  isPublic: boolean;
  membershipRole: Exclude<DiaryRole, "guest"> | null;
}): DiaryRole | null {
  const { isPublic, membershipRole } = params;

  if (membershipRole) {
    return membershipRole;
  }

  if (isPublic) {
    return "guest";
  }

  return null;
}
