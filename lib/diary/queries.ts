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
  id?: string;
  entry_type?: "income" | "expense";
  parent_entry_id?: string | null;
  sort_order?: number;
  content?: string;
  category_id: string | null;
  amount: string | number;
  currency?: string;
  memo?: string | null;
  entry_date?: string;
};

export type DiaryEntriesQueryFilters = {
  q?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  entryType?: "income" | "expense" | "";
};

export type DiaryEntryListItem = {
  id: string;
  entryType: "income" | "expense";
  amount: number;
  currency: string;
  memo: string | null;
  entryDate: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type DiaryCategoryOption = {
  id: string;
  name: string;
};

export type DiaryEntriesResult = {
  categories: DiaryCategoryOption[];
  entries: DiaryEntryListItem[];
  incomeTotal: number;
  expenseTotal: number;
};

export type DiaryEntryTreeNode = {
  id: string;
  parentEntryId: string | null;
  content: string;
  entryDate: string;
  signedAmount: number;
  currency: string;
  categoryId: string | null;
  categoryName: string | null;
  memo: string | null;
  children: DiaryEntryTreeNode[];
};

export type DiaryEntryTreeResult = {
  categories: DiaryCategoryOption[];
  nodes: DiaryEntryTreeNode[];
};

export type DiaryBalanceSnapshotItem = {
  id: string;
  snapshotDate: string;
  balance: number;
  note: string | null;
};

export type DiaryBalanceSnapshotResult = {
  snapshots: DiaryBalanceSnapshotItem[];
  latest: DiaryBalanceSnapshotItem | null;
  previous: DiaryBalanceSnapshotItem | null;
  delta: number | null;
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
  let effectiveRole: "owner" | "manager" | "viewer" | null = null;

  if (userData.user) {
    if (diary.owner_user_id === userData.user.id) {
      effectiveRole = "owner";
    }

    const { data: membership } = await admin
      .from("diary_memberships")
      .select("role")
      .eq("diary_id", diaryId)
      .eq("user_id", userData.user.id)
      .maybeSingle<{ role: "owner" | "manager" | "viewer" }>();

    membershipRole = membership?.role ?? null;

    if (!effectiveRole && membershipRole) {
      effectiveRole = membershipRole;
    }
  }

  const role = resolveRole({
    isPublic: diary.is_public,
    membershipRole: effectiveRole,
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
      const effectiveMembershipRole: "owner" | "manager" | "viewer" | null =
        diary.owner_user_id === user.id ? "owner" : (membershipRoleByDiaryId.get(diary.id) ?? null);

      const role = resolveRole({
        isPublic: diary.is_public,
        membershipRole: effectiveMembershipRole,
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

export async function getDiaryEntriesForDiary(
  diaryId: string,
  filters: DiaryEntriesQueryFilters,
): Promise<DiaryEntriesResult> {
  const admin = createAdminClient();
  const { q, categoryId, from, to, entryType } = filters;

  const { data: categories } = await admin
    .from("categories")
    .select("id,name")
    .eq("diary_id", diaryId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();

  let entriesQuery = admin
    .from("entries")
    .select("id,entry_type,amount,currency,memo,entry_date,category_id")
    .eq("diary_id", diaryId)
    .order("entry_date", { ascending: false })
    .limit(300);

  if (entryType === "income" || entryType === "expense") {
    entriesQuery = entriesQuery.eq("entry_type", entryType);
  }

  if (categoryId) {
    entriesQuery = entriesQuery.eq("category_id", categoryId);
  }

  if (from) {
    entriesQuery = entriesQuery.gte("entry_date", from);
  }

  if (to) {
    entriesQuery = entriesQuery.lte("entry_date", to);
  }

  const { data: entriesRows } = await entriesQuery.returns<EntryRow[]>();

  const categoryMap = new Map<string, string>((categories ?? []).map((category) => [category.id, category.name]));

  let entries: DiaryEntryListItem[] = (entriesRows ?? []).map((row) => ({
    id: String(row.id ?? crypto.randomUUID()),
    entryType: row.entry_type === "income" ? "income" : "expense",
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? "KRW",
    memo: row.memo ?? null,
    entryDate: row.entry_date ?? "",
    categoryId: row.category_id,
    categoryName: row.category_id ? categoryMap.get(row.category_id) ?? null : null,
  }));

  if (q && q.trim()) {
    const keyword = q.trim().toLowerCase();
    entries = entries.filter((entry) => {
      const memoText = (entry.memo ?? "").toLowerCase();
      const categoryText = (entry.categoryName ?? "").toLowerCase();
      return memoText.includes(keyword) || categoryText.includes(keyword);
    });
  }

  const incomeTotal = entries
    .filter((entry) => entry.entryType === "income")
    .reduce((acc, entry) => acc + entry.amount, 0);
  const expenseTotal = entries
    .filter((entry) => entry.entryType === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0);

  return {
    categories: categories ?? [],
    entries,
    incomeTotal,
    expenseTotal,
  };
}

export async function getDiaryBalanceSnapshotsForDiary(diaryId: string): Promise<DiaryBalanceSnapshotResult> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("diary_balance_snapshots")
    .select("id,snapshot_date,balance,note")
    .eq("diary_id", diaryId)
    .order("snapshot_date", { ascending: false })
    .limit(20)
    .returns<Array<{ id: string; snapshot_date: string; balance: number | string; note: string | null }>>();

  const snapshots: DiaryBalanceSnapshotItem[] = (data ?? []).map((row) => ({
    id: row.id,
    snapshotDate: row.snapshot_date,
    balance: Number(row.balance ?? 0),
    note: row.note,
  }));

  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  return {
    snapshots,
    latest,
    previous,
    delta: latest && previous ? latest.balance - previous.balance : null,
  };
}

export async function getDiaryEntryTreeForDiary(diaryId: string): Promise<DiaryEntryTreeResult> {
  const admin = createAdminClient();

  const [{ data: categories }, { data: rows }] = await Promise.all([
    admin
      .from("categories")
      .select("id,name")
      .eq("diary_id", diaryId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<Array<{ id: string; name: string }>>(),
    admin
      .from("entries")
      .select("id,parent_entry_id,sort_order,content,entry_type,amount,currency,entry_date,category_id,memo")
      .eq("diary_id", diaryId)
      .order("sort_order", { ascending: true })
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<EntryRow[]>(),
  ]);

  const categoryMap = new Map<string, string>((categories ?? []).map((category) => [category.id, category.name]));

  const items: DiaryEntryTreeNode[] = (rows ?? [])
    .filter((row): row is EntryRow & { id: string } => Boolean(row.id))
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      const signedAmount = row.entry_type === "income" ? amount : -amount;

      return {
        id: row.id,
        parentEntryId: row.parent_entry_id ?? null,
        content: row.content ?? row.memo ?? "",
        entryDate: row.entry_date ?? "",
        signedAmount,
        currency: row.currency ?? "KRW",
        categoryId: row.category_id,
        categoryName: row.category_id ? categoryMap.get(row.category_id) ?? null : null,
        memo: row.memo ?? null,
        children: [],
      };
    });

  const byId = new Map<string, DiaryEntryTreeNode>(items.map((item) => [item.id, item]));
  const roots: DiaryEntryTreeNode[] = [];

  for (const item of items) {
    if (item.parentEntryId && byId.has(item.parentEntryId)) {
      byId.get(item.parentEntryId)?.children.push(item);
      continue;
    }

    roots.push(item);
  }

  return {
    categories: categories ?? [],
    nodes: roots,
  };
}
