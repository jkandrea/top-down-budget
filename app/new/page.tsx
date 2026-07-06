import { redirect } from "next/navigation";
import { createDiaryAction } from "@/actions/diary-actions";
import { createClient } from "@/lib/supabase/server";

export default async function NewDiaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">새 가계부 만들기</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          생성 직후 본인 계정에 owner 권한이 자동 부여됩니다.
        </p>

        <form action={createDiaryAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium">
              가계부 이름
            </label>
            <input
              id="title"
              name="title"
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="예: 우리집 7월 가계부"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="base_currency" className="text-sm font-medium">
              기본 통화
            </label>
            <select
              id="base_currency"
              name="base_currency"
              defaultValue="KRW"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input name="is_public" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
            public 가계부로 공개
          </label>

          <button
            type="submit"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            가계부 생성
          </button>
        </form>
      </section>
    </main>
  );
}
