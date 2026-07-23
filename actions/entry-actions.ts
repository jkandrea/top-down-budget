"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function parseRequiredString(input: FormDataEntryValue | null, key: string): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`${key} 값이 필요합니다.`);
  }

  return input.trim();
}

function parseAmount(input: FormDataEntryValue | null): number {
  const value = typeof input === "string" ? Number(input) : Number.NaN;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("amount는 0 이상의 숫자여야 합니다.");
  }
  return value;
}

function parseSignedAmount(input: FormDataEntryValue | null): number {
  const value = typeof input === "string" ? Number(input) : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new Error("금액은 숫자여야 합니다.");
  }
  return value;
}

function parseOptionalString(input: FormDataEntryValue | null): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getNextSortOrder(
  diaryId: string,
  parentEntryId: string | null,
): Promise<number> {
  const admin = createAdminClient();

  let query = admin
    .from("entries")
    .select("sort_order")
    .eq("diary_id", diaryId)
    .order("sort_order", { ascending: false })
    .limit(1);

  query = parentEntryId ? query.eq("parent_entry_id", parentEntryId) : query.is("parent_entry_id", null);

  const { data } = await query.maybeSingle<{ sort_order: number }>();
  return (data?.sort_order ?? -1) + 1;
}

async function listSiblingIds(
  diaryId: string,
  parentEntryId: string | null,
): Promise<string[]> {
  const admin = createAdminClient();

  let query = admin
    .from("entries")
    .select("id")
    .eq("diary_id", diaryId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  query = parentEntryId ? query.eq("parent_entry_id", parentEntryId) : query.is("parent_entry_id", null);

  const { data } = await query.returns<Array<{ id: string }>>();
  return (data ?? []).map((row) => row.id);
}

async function resequenceSiblings(
  diaryId: string,
  parentEntryId: string | null,
  orderedIds: string[],
): Promise<void> {
  const admin = createAdminClient();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const entryId = orderedIds[index];
    const { error } = await admin
      .from("entries")
      .update({ parent_entry_id: parentEntryId, sort_order: index })
      .eq("id", entryId)
      .eq("diary_id", diaryId);

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function assertCanEditDiary(diaryId: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("diary_memberships")
    .select("role")
    .eq("diary_id", diaryId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "owner" | "manager" | "viewer" }>();

  if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
    throw new Error("내역 편집 권한이 없습니다.");
  }

  return { userId: user.id };
}

function toSignedAmount(entryType: "income" | "expense", amount: number): number {
  return entryType === "income" ? amount : -amount;
}

function toEntryPatchFromSignedAmount(signedAmount: number): {
  entry_type: "income" | "expense";
  amount: number;
} {
  if (signedAmount > 0) {
    return {
      entry_type: "income",
      amount: Math.abs(signedAmount),
    };
  }

  if (signedAmount < 0) {
    return {
      entry_type: "expense",
      amount: Math.abs(signedAmount),
    };
  }

  return {
    entry_type: "expense",
    amount: 0,
  };
}

export async function createEntryAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const content = parseRequiredString(formData.get("content"), "content");
  const signedAmount = parseSignedAmount(formData.get("signed_amount"));
  const amount = Math.abs(signedAmount);
  const entryType = signedAmount >= 0 ? "income" : "expense";
  const currency = (parseOptionalString(formData.get("currency")) ?? "KRW").toUpperCase();
  const entryDate = parseRequiredString(formData.get("entry_date"), "entry_date");
  const categoryIdInput = formData.get("category_id");
  const newCategoryNameInput = formData.get("new_category_name");
  const insertModeInput = parseOptionalString(formData.get("insert_mode")) ?? "root";
  const targetEntryId = parseOptionalString(formData.get("target_entry_id"));
  const memoInput = formData.get("memo");
  const returnTo = parseOptionalString(formData.get("return_to")) ?? `/diary/${diaryId}/entries`;

  const memo = typeof memoInput === "string" && memoInput.trim() ? memoInput.trim() : null;
  const selectedCategoryId =
    typeof categoryIdInput === "string" && categoryIdInput.trim() ? categoryIdInput.trim() : null;
  const newCategoryName =
    typeof newCategoryNameInput === "string" && newCategoryNameInput.trim() ? newCategoryNameInput.trim() : null;

  const insertMode =
    insertModeInput === "above" || insertModeInput === "below" || insertModeInput === "root"
      ? insertModeInput
      : "root";

  const { userId } = await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  let categoryId = selectedCategoryId;
  if (!categoryId && newCategoryName) {
    const { data: latestRoot } = await admin
      .from("categories")
      .select("sort_order")
      .eq("diary_id", diaryId)
      .is("parent_category_id", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>();

    const sortOrder = (latestRoot?.sort_order ?? -1) + 1;
    const { data: createdCategory, error: categoryError } = await admin
      .from("categories")
      .insert({
        diary_id: diaryId,
        name: newCategoryName,
        parent_category_id: null,
        depth: 0,
        sort_order: sortOrder,
      })
      .select("id")
      .single<{ id: string }>();

    if (categoryError || !createdCategory) {
      throw new Error(categoryError?.message ?? "분류 생성에 실패했습니다.");
    }

    categoryId = createdCategory.id;
  }

  let parentEntryId: string | null = null;
  let sortOrder = 0;

  if (insertMode === "root") {
    parentEntryId = null;
    sortOrder = await getNextSortOrder(diaryId, null);
  } else {
    if (!targetEntryId) {
      throw new Error("삽입 기준 건을 선택해주세요.");
    }

    const { data: target, error: targetError } = await admin
      .from("entries")
      .select("id,parent_entry_id,sort_order")
      .eq("id", targetEntryId)
      .eq("diary_id", diaryId)
      .maybeSingle<{ id: string; parent_entry_id: string | null; sort_order: number }>();

    if (targetError || !target) {
      throw new Error("삽입 기준 건을 찾을 수 없습니다.");
    }

    if (insertMode === "below") {
      parentEntryId = target.id;
      sortOrder = await getNextSortOrder(diaryId, parentEntryId);
    } else {
      parentEntryId = target.parent_entry_id;
      sortOrder = target.sort_order;
    }
  }

  const { data: inserted, error } = await admin
    .from("entries")
    .insert({
      diary_id: diaryId,
      parent_entry_id: parentEntryId,
      sort_order: sortOrder,
      content,
      entry_type: entryType,
      amount,
      currency,
      category_id: categoryId,
      memo,
      entry_date: entryDate,
      created_by: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "건 등록에 실패했습니다.");
  }

  if (insertMode === "above" && targetEntryId) {
    const { error: reparentError } = await admin
      .from("entries")
      .update({ parent_entry_id: inserted.id, sort_order: 0 })
      .eq("id", targetEntryId)
      .eq("diary_id", diaryId);

    if (reparentError) {
      throw new Error(reparentError.message);
    }

    const siblingIds = await listSiblingIds(diaryId, parentEntryId);
    const orderedIds = siblingIds.filter((id) => id !== inserted.id);
    const targetIndex = orderedIds.indexOf(targetEntryId);
    const insertIndex = targetIndex >= 0 ? targetIndex : orderedIds.length;
    orderedIds.splice(insertIndex, 0, inserted.id);
    await resequenceSiblings(diaryId, parentEntryId, orderedIds);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
  redirect(returnTo);
}

export async function moveEntryAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const draggedEntryId = parseRequiredString(formData.get("dragged_entry_id"), "dragged_entry_id");
  const targetEntryId = parseRequiredString(formData.get("target_entry_id"), "target_entry_id");
  const dropPositionInput = parseRequiredString(formData.get("drop_position"), "drop_position");

  if (draggedEntryId === targetEntryId) {
    throw new Error("같은 내역으로는 이동할 수 없습니다.");
  }

  const dropPosition =
    dropPositionInput === "above" || dropPositionInput === "below" || dropPositionInput === "inside"
      ? dropPositionInput
      : null;

  if (!dropPosition) {
    throw new Error("drop_position 값이 올바르지 않습니다.");
  }

  await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("entries")
    .select("id,parent_entry_id,sort_order")
    .eq("diary_id", diaryId)
    .returns<Array<{ id: string; parent_entry_id: string | null; sort_order: number }>>();

  const items = rows ?? [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const dragged = byId.get(draggedEntryId);
  const target = byId.get(targetEntryId);

  if (!dragged || !target) {
    throw new Error("이동할 내역 또는 대상 내역을 찾을 수 없습니다.");
  }

  const childrenByParent = new Map<string | null, string[]>();
  for (const item of items) {
    const list = childrenByParent.get(item.parent_entry_id) ?? [];
    list.push(item.id);
    childrenByParent.set(item.parent_entry_id, list);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(dragged.id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || descendants.has(current)) {
      continue;
    }

    descendants.add(current);
    stack.push(...(childrenByParent.get(current) ?? []));
  }

  let newParentEntryId: string | null = null;
  if (dropPosition === "inside") {
    newParentEntryId = target.id;
  } else {
    newParentEntryId = target.parent_entry_id;
  }

  if (newParentEntryId === dragged.id || (newParentEntryId && descendants.has(newParentEntryId))) {
    throw new Error("자기 하위 내역 아래로는 이동할 수 없습니다.");
  }

  const oldParentEntryId = dragged.parent_entry_id;

  const sortByOrder = (leftId: string, rightId: string): number => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) {
      return 0;
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.id.localeCompare(right.id);
  };

  const oldSiblings = [...(childrenByParent.get(oldParentEntryId) ?? [])]
    .filter((id) => id !== draggedEntryId)
    .sort(sortByOrder);

  const newSiblings = [...(childrenByParent.get(newParentEntryId) ?? [])]
    .filter((id) => id !== draggedEntryId)
    .sort(sortByOrder);

  let insertIndex = newSiblings.length;

  if (dropPosition === "above" || dropPosition === "below") {
    const targetIndex = newSiblings.indexOf(targetEntryId);
    if (targetIndex < 0) {
      throw new Error("대상 내역의 정렬 위치를 계산하지 못했습니다.");
    }

    insertIndex = dropPosition === "above" ? targetIndex : targetIndex + 1;
  }

  newSiblings.splice(insertIndex, 0, draggedEntryId);

  if (oldParentEntryId === newParentEntryId) {
    await resequenceSiblings(diaryId, newParentEntryId, newSiblings);
  } else {
    await resequenceSiblings(diaryId, oldParentEntryId, oldSiblings);
    await resequenceSiblings(diaryId, newParentEntryId, newSiblings);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const entryId = parseRequiredString(formData.get("entry_id"), "entry_id");
  const returnTo = parseOptionalString(formData.get("return_to"));
  const noRedirect = parseOptionalString(formData.get("no_redirect")) === "1";

  await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const { error } = await admin.from("entries").delete().eq("id", entryId).eq("diary_id", diaryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);

  if (!noRedirect) {
    redirect(returnTo ?? `/diary/${diaryId}/entries`);
  }
}

export async function updateEntryAmountAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const entryId = parseRequiredString(formData.get("entry_id"), "entry_id");
  const signedAmount = parseSignedAmount(formData.get("signed_amount"));

  await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const patch = toEntryPatchFromSignedAmount(signedAmount);
  const { error } = await admin
    .from("entries")
    .update(patch)
    .eq("id", entryId)
    .eq("diary_id", diaryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
}

export async function reconcileEntryTotalAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const entryId = parseRequiredString(formData.get("entry_id"), "entry_id");

  await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const [{ data: parent, error: parentError }, { data: children, error: childrenError }] = await Promise.all([
    admin
      .from("entries")
      .select("id,entry_type,amount")
      .eq("id", entryId)
      .eq("diary_id", diaryId)
      .maybeSingle<{ id: string; entry_type: "income" | "expense"; amount: number }>(),
    admin
      .from("entries")
      .select("entry_type,amount")
      .eq("diary_id", diaryId)
      .eq("parent_entry_id", entryId)
      .returns<Array<{ entry_type: "income" | "expense"; amount: number }>>(),
  ]);

  if (parentError || !parent) {
    throw new Error("정산 대상 내역을 찾을 수 없습니다.");
  }

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  const childrenSignedSum = (children ?? []).reduce((acc, child) => {
    return acc + toSignedAmount(child.entry_type, Number(child.amount) || 0);
  }, 0);

  if ((children ?? []).length === 0) {
    throw new Error("하위 내역이 없어 총액 정산을 할 수 없습니다.");
  }

  const nextPatch =
    childrenSignedSum === 0
      ? {
          entry_type: parent.entry_type,
          amount: 0,
        }
      : toEntryPatchFromSignedAmount(childrenSignedSum);

  const { error: updateError } = await admin
    .from("entries")
    .update(nextPatch)
    .eq("id", entryId)
    .eq("diary_id", diaryId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
}

export async function reconcileEntryRemainderAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const entryId = parseRequiredString(formData.get("entry_id"), "entry_id");

  const { userId } = await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const [{ data: parent, error: parentError }, { data: children, error: childrenError }] = await Promise.all([
    admin
      .from("entries")
      .select("id,entry_type,amount,currency,category_id,entry_date")
      .eq("id", entryId)
      .eq("diary_id", diaryId)
      .maybeSingle<{
        id: string;
        entry_type: "income" | "expense";
        amount: number;
        currency: string;
        category_id: string | null;
        entry_date: string;
      }>(),
    admin
      .from("entries")
      .select("id,entry_type,amount,content")
      .eq("diary_id", diaryId)
      .eq("parent_entry_id", entryId)
      .order("sort_order", { ascending: true })
      .returns<Array<{ id: string; entry_type: "income" | "expense"; amount: number; content: string }>>(),
  ]);

  if (parentError || !parent) {
    throw new Error("정산 대상 내역을 찾을 수 없습니다.");
  }

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  const childRows = children ?? [];
  const existingEtc = childRows.find((child) => child.content.trim() === "기타");
  const childrenSignedSumWithoutEtc = childRows
    .filter((child) => child.content.trim() !== "기타")
    .reduce((acc, child) => {
      return acc + toSignedAmount(child.entry_type, Number(child.amount) || 0);
    }, 0);
  const parentSignedAmount = toSignedAmount(parent.entry_type, Number(parent.amount) || 0);
  const diff = parentSignedAmount - childrenSignedSumWithoutEtc;

  const patch = toEntryPatchFromSignedAmount(diff);

  if (existingEtc) {
    const { error: updateError } = await admin
      .from("entries")
      .update({
        ...patch,
        memo: "잔액 정산 자동 계산",
      })
      .eq("id", existingEtc.id)
      .eq("diary_id", diaryId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const sortOrder = await getNextSortOrder(diaryId, entryId);
    const { error: insertError } = await admin.from("entries").insert({
      diary_id: diaryId,
      parent_entry_id: entryId,
      sort_order: sortOrder,
      content: "기타",
      entry_type: patch.entry_type,
      amount: patch.amount,
      currency: parent.currency,
      category_id: parent.category_id,
      memo: "잔액 정산 자동 계산",
      entry_date: parent.entry_date,
      created_by: userId,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const name = parseRequiredString(formData.get("name"), "name");
  const parentCategoryId = parseOptionalString(formData.get("parent_category_id"));
  const parentAmountInput = parseOptionalString(formData.get("parent_amount"));
  const returnTo = parseOptionalString(formData.get("return_to")) ?? `/diary/${diaryId}/entries`;

  await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  let depth = 0;
  if (parentCategoryId) {
    const { data: parent } = await admin
      .from("categories")
      .select("depth")
      .eq("id", parentCategoryId)
      .eq("diary_id", diaryId)
      .maybeSingle<{ depth: number }>();

    depth = (parent?.depth ?? 0) + 1;
  }

  let sortOrder = 0;
  const { data: siblings } = await admin
    .from("categories")
    .select("sort_order")
    .eq("diary_id", diaryId)
    .eq("parent_category_id", parentCategoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .returns<Array<{ sort_order: number }>>();
  sortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const parentAmount = parentAmountInput ? Number(parentAmountInput) : null;
  if (parentAmount !== null && (!Number.isFinite(parentAmount) || parentAmount < 0)) {
    throw new Error("parent_amount는 0 이상의 숫자여야 합니다.");
  }

  const { error: categoryInsertError } = await admin.from("categories").insert({
    diary_id: diaryId,
    name,
    parent_category_id: parentCategoryId,
    depth,
    sort_order: sortOrder,
    parent_amount: parentAmount,
  });

  if (categoryInsertError) {
    throw new Error(categoryInsertError.message);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
  redirect(returnTo);
}

export async function createBalanceSnapshotAction(formData: FormData): Promise<void> {
  const diaryId = parseRequiredString(formData.get("diary_id"), "diary_id");
  const snapshotDate = parseRequiredString(formData.get("snapshot_date"), "snapshot_date");
  const balance = parseAmount(formData.get("balance"));
  const note = parseOptionalString(formData.get("note"));
  const returnTo = parseOptionalString(formData.get("return_to")) ?? `/diary/${diaryId}/entries`;

  const { userId } = await assertCanEditDiary(diaryId);
  const admin = createAdminClient();

  const { error } = await admin.from("diary_balance_snapshots").upsert(
    {
      diary_id: diaryId,
      snapshot_date: snapshotDate,
      balance,
      note,
      created_by: userId,
    },
    { onConflict: "diary_id,snapshot_date" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/diary/${diaryId}`);
  revalidatePath(`/diary/${diaryId}/entries`);
  redirect(returnTo);
}
