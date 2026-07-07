import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditDiary } from "@/lib/auth/permissions";
import { getDiaryDetailForRequestUser, getDiaryEntriesForDiary } from "@/lib/diary/queries";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    type?: string;
    from?: string;
    to?: string;
  }>;
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DiaryDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q, category, type, from, to } = await searchParams;
  const detail = await getDiaryDetailForRequestUser(id);

  if (!detail) {
    notFound();
  }

  const { diary, role } = detail;
  const canEdit = canEditDiary(role);
  const entriesResult = await getDiaryEntriesForDiary(id, {
    q,
    categoryId: category,
    from,
    to,
    entryType: type === "income" || type === "expense" ? type : "",
  });
  const net = entriesResult.incomeTotal - entriesResult.expenseTotal;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{diary.title}</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              role: {role} · visibility: {diary.is_public ? "public" : "private"} · base currency: {diary.base_currency}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/diary/${diary.id}/entries`}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              내역 관리
            </Link>
            {canEdit ? (
              <Link
                href={`/diary/${diary.id}/edit`}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                수정 화면으로
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">조회 건수</p>
            <p className="mt-1 font-semibold">{entriesResult.entries.length}건</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">수입 합계</p>
            <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
              {formatMoney(entriesResult.incomeTotal, diary.base_currency)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">지출 합계</p>
            <p className="mt-1 font-semibold text-rose-600 dark:text-rose-400">
              {formatMoney(entriesResult.expenseTotal, diary.base_currency)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">순금액</p>
            <p className={net >= 0 ? "mt-1 font-semibold text-emerald-600 dark:text-emerald-400" : "mt-1 font-semibold text-rose-600 dark:text-rose-400"}>
              {formatMoney(net, diary.base_currency)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold tracking-tight">검색/필터</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="메모/카테고리 검색"
            className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">전체 카테고리</option>
            {entriesResult.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={type ?? ""}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">수입/지출 전체</option>
            <option value="income">income</option>
            <option value="expense">expense</option>
          </select>
          <input
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="lg:col-span-6 flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              필터 적용
            </button>
            <Link
              href={`/diary/${diary.id}`}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              초기화
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-3 py-3 text-left font-medium">일자</th>
                <th className="px-3 py-3 text-left font-medium">구분</th>
                <th className="px-3 py-3 text-left font-medium">카테고리</th>
                <th className="px-3 py-3 text-left font-medium">메모</th>
                <th className="px-3 py-3 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {entriesResult.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    조건에 맞는 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                entriesResult.entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-3 py-2.5">{entry.entryDate || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          entry.entryType === "income"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }
                      >
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{entry.categoryName ?? "미분류"}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{entry.memo ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(entry.amount, entry.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
