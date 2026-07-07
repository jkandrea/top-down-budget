import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, type DiaryRole } from "@/lib/auth/permissions";
import type { LedgerNode } from "@/components/ledger/types";

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

type CategoryRow = {
  id: string;
  diary_id: string;
  name: string;
  parent_category_id: string | null;
  sort_order: number;
  parent_amount: string | number | null;
  created_at: string;
};

type EntryRow = {
  category_id: string | null;
  amount: string | number;
};

export type DiaryLedgerResult = {
  nodes: LedgerNode[];
  role: DiaryRole;
};

function toAmount(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDiaryDetailForRequestUser(diaryId: string): Promise<DiaryDetail | null> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: userData }, { data: diary, error: diaryError }] = await Promise.all([
    supabase.auth.getUser(),
    admin
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
    const { data: membership } = await admin
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
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);

  if (!user) {
    const { data: publicDiaries, error } = await admin
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

  const { data: diaries, error: diariesError } = await admin
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
  const { data: memberships } = await admin
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

export async function getDiaryLedgerForRequestUser(diaryId: string): Promise<DiaryLedgerResult | null> {
  const detail = await getDiaryDetailForRequestUser(diaryId);

  if (!detail) {
    return null;
  }

  const supabase = await createClient();

  const [{ data: categories, error: categoriesError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from("categories")
      .select("id,diary_id,name,parent_category_id,sort_order,parent_amount,created_at")
      .eq("diary_id", diaryId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<CategoryRow[]>(),
    supabase
      .from("entries")
      .select("category_id,amount")
      .eq("diary_id", diaryId)
      .eq("entry_type", "expense")
      .returns<EntryRow[]>(),
  ]);

  if (categoriesError || entriesError || !categories) {
    return {
      nodes: [],
      role: detail.role,
    };
  }

  const ownSpentByCategoryId = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (!entry.category_id) {
      continue;
    }

    const prev = ownSpentByCategoryId.get(entry.category_id) ?? 0;
    ownSpentByCategoryId.set(entry.category_id, prev + (toAmount(entry.amount) ?? 0));
  }

  const categoriesByParentId = new Map<string | null, CategoryRow[]>();
  for (const category of categories) {
    const list = categoriesByParentId.get(category.parent_category_id) ?? [];
    list.push(category);
    categoriesByParentId.set(category.parent_category_id, list);
  }

  const buildChildren = (parentId: string | null): LedgerNode[] => {
    const rows = categoriesByParentId.get(parentId) ?? [];

    return rows.map((category) => ({
      id: category.id,
      name: category.name,
      parentAmount: toAmount(category.parent_amount),
      ownSpent: ownSpentByCategoryId.get(category.id) ?? 0,
      children: buildChildren(category.id),
    }));
  };

  return {
    nodes: buildChildren(null),
    role: detail.role,
  };
}
