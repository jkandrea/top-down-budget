import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveRole, type DiaryRole } from "@/lib/auth/permissions";

type DiaryRow = {
  id: string;
  title: string;
  is_public: boolean;
  base_currency: string;
  owner_user_id: string;
  created_at: string;
};

export type DiaryDetail = {
  diary: DiaryRow;
  role: DiaryRole;
};

export type DiaryListItem = {
  diary: DiaryRow;
  role: DiaryRole;
};

export type VisibleDiariesResult = {
  diaries: DiaryListItem[];
  isLoggedIn: boolean;
};

export async function getDiaryDetailForRequestUser(diaryId: string): Promise<DiaryDetail | null> {
  const supabase = await createClient();

  const [{ data: userData }, { data: diary, error: diaryError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("diaries")
      .select("id,title,is_public,base_currency,owner_user_id,created_at")
      .eq("id", diaryId)
      .maybeSingle<DiaryRow>(),
  ]);

  if (diaryError || !diary) {
    return null;
  }

  let membershipRole: "owner" | "manager" | "viewer" | null = null;

  if (userData.user) {
    const { data: membership } = await supabase
      .from("diary_memberships")
      .select("role")
      .eq("diary_id", diaryId)
      .eq("user_id", userData.user.id)
      .maybeSingle<{ role: "owner" | "manager" | "viewer" }>();

    membershipRole = membership?.role ?? null;
  }

  const role = resolveRole({
    isPublic: diary.is_public,
    membershipRole,
  });

  if (!role) {
    return null;
  }

  return {
    diary,
    role,
  };
}

export async function getVisibleDiariesForRequestUser(): Promise<VisibleDiariesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);

  if (!user) {
    const { data: publicDiaries, error } = await supabase
      .from("diaries")
      .select("id,title,is_public,base_currency,owner_user_id,created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<DiaryRow[]>();

    if (error || !publicDiaries) {
      return {
        diaries: [],
        isLoggedIn,
      };
    }

    return {
      diaries: publicDiaries.map((diary) => ({
        diary,
        role: "guest",
      })),
      isLoggedIn,
    };
  }

  const { data: diaries, error: diariesError } = await supabase
    .from("diaries")
    .select("id,title,is_public,base_currency,owner_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(24)
    .returns<DiaryRow[]>();

  if (diariesError || !diaries || diaries.length === 0) {
    return {
      diaries: [],
      isLoggedIn,
    };
  }

  const diaryIds = diaries.map((diary) => diary.id);
  const { data: memberships } = await supabase
    .from("diary_memberships")
    .select("diary_id,role")
    .eq("user_id", user.id)
    .in("diary_id", diaryIds)
    .returns<Array<{ diary_id: string; role: "owner" | "manager" | "viewer" }>>();

  const membershipRoleByDiaryId = new Map<string, "owner" | "manager" | "viewer">(
    (memberships ?? []).map((membership) => [membership.diary_id, membership.role]),
  );

  const diaryItems: DiaryListItem[] = diaries
    .map((diary) => {
      const role = resolveRole({
        isPublic: diary.is_public,
        membershipRole: membershipRoleByDiaryId.get(diary.id) ?? null,
      });

      if (!role) {
        return null;
      }

      return {
        diary,
        role,
      };
    })
    .filter((item): item is DiaryListItem => item !== null);

  return {
    diaries: diaryItems,
    isLoggedIn,
  };
}
