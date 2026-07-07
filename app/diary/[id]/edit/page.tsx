import { notFound } from "next/navigation";
import { updateDiaryAction } from "@/actions/diary-actions";
import { canEditDiary } from "@/lib/auth/permissions";
import { getDiaryDetailForRequestUser } from "@/lib/diary/queries";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DiaryEditPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getDiaryDetailForRequestUser(id);

  if (!detail) {
    notFound();
  }

  const { diary, role } = detail;

  if (!canEditDiary(role)) {
    notFound();
  }

  const ownerOnlyMessage =
    role === "owner"
      ? "공개 범위 변경 포함 전체 수정이 가능합니다."
      : "manager 권한은 제목/기본 통화 수정만 가능합니다. 공개 범위 변경은 owner만 가능합니다.";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">가계부 수정</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          role: {role} · {ownerOnlyMessage}
        </p>

        <form action={updateDiaryAction} className="mt-6 space-y-4">
          <input type="hidden" name="diary_id" value={diary.id} />

          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium">
              가계부 이름
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={diary.title}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="base_currency" className="text-sm font-medium">
              기본 통화
            </label>
            <select
              id="base_currency"
              name="base_currency"
              defaultValue={diary.base_currency}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              name="is_public"
              type="checkbox"
              defaultChecked={diary.is_public}
              disabled={role !== "owner"}
              className="h-4 w-4 rounded border-zinc-300 disabled:opacity-50"
            />
            public 가계부로 공개
          </label>

          <button
            type="submit"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            수정 저장
          </button>
        </form>
      </section>
    </main>
  );
}
