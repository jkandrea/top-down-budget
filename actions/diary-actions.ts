"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function parseBaseCurrency(input: FormDataEntryValue | null): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    return "KRW";
  }

  return input.trim().toUpperCase();
}

export async function createDiaryAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  const titleInput = formData.get("title");
  const title = typeof titleInput === "string" ? titleInput.trim() : "";

  if (!title) {
    throw new Error("가계부 이름을 입력해주세요.");
  }

  const isPublic = formData.get("is_public") === "on";
  const baseCurrency = parseBaseCurrency(formData.get("base_currency"));

  // Use server-only key for write bootstrap flow after explicit user verification.
  const admin = createAdminClient();

  const { data: diary, error: diaryError } = await admin
    .from("diaries")
    .insert({
      owner_user_id: user.id,
      title,
      is_public: isPublic,
      base_currency: baseCurrency,
    })
    .select("id")
    .single<{ id: string }>();

  if (diaryError || !diary) {
    throw new Error(diaryError?.message ?? "가계부 생성에 실패했습니다.");
  }

  const { error: membershipError } = await admin.from("diary_memberships").insert({
    diary_id: diary.id,
    user_id: user.id,
    role: "owner",
  });

  if (membershipError) {
    throw new Error(`owner 권한 부여에 실패했습니다: ${membershipError.message}`);
  }

  revalidatePath("/");
  redirect(`/diary/${diary.id}`);
}
