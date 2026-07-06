import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditDiary } from "@/lib/auth/permissions";
import { getDiaryDetailForRequestUser } from "@/lib/diary/queries";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DiaryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getDiaryDetailForRequestUser(id);

  if (!detail) {
    notFound();
  }

  const { diary, role } = detail;
  const canEdit = canEditDiary(role);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{diary.title}</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              role: {role} · visibility: {diary.is_public ? "public" : "private"} · base currency: {diary.base_currency}
            </p>
          </div>

          {canEdit ? (
            <Link
              href={`/diary/${diary.id}/edit`}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              수정 화면으로
            </Link>
          ) : null}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          최소 구조 구현 상태입니다. 다음 단계에서 통계 차트/하이라키 그리드/엑셀 붙여넣기를 실제 DB 데이터와 연결하면 됩니다.
        </div>
      </section>
    </main>
  );
}
