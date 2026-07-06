"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseRequiredString(formData: FormData, key: string): string {
  const input = formData.get(key);
  const value = typeof input === "string" ? input.trim() : "";

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function toAuthErrorMessage(error: unknown, fallback: string): string {
  const message = toMessage(error, fallback);

  if (message.toLowerCase().includes("invalid path specified in request url")) {
    return "회원가입 리다이렉트 경로 설정이 올바르지 않습니다. Supabase Auth URL 설정의 Site URL을 현재 접속 주소(예: http://localhost:3000)로 맞춰주세요.";
  }

  return message;
}

export async function signInAction(formData: FormData): Promise<void> {
  try {
    const email = parseRequiredString(formData, "email");
    const password = parseRequiredString(formData, "password");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    const message = toMessage(error, "로그인에 실패했습니다.");
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  redirect("/");
}

export async function signUpAction(formData: FormData): Promise<void> {
  try {
    const email = parseRequiredString(formData, "email");
    const password = parseRequiredString(formData, "password");
    const passwordConfirm = parseRequiredString(formData, "password_confirm");

    if (password.length < 8) {
      throw new Error("비밀번호는 최소 8자 이상이어야 합니다.");
    }

    if (password !== passwordConfirm) {
      throw new Error("비밀번호 확인이 일치하지 않습니다.");
    }

    const supabase = await createClient();
    const siteUrl = getSiteUrl();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/login`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    const message = toAuthErrorMessage(error, "회원가입에 실패했습니다.");
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  redirect("/login?signup=ok");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/");
}
