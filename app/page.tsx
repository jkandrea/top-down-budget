import Link from "next/link";
import { HierarchyBudgetGrid } from "@/components/ledger/hierarchy-budget-grid";
import { getDiaryLedgerForRequestUser, getVisibleDiariesForRequestUser } from "@/lib/diary/queries";

function RoleBadge({ role }: { role: "owner" | "manager" | "viewer" | "guest" }) {
  const toneClassName =
    role === "owner"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : role === "manager"
        ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
        : role === "viewer"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClassName}`}>{role}</span>;
}

export default async function Home() {
  const { diaries, isLoggedIn } = await getVisibleDiariesForRequestUser();
  const previewDiary = diaries[0] ?? null;
  const ledgerPreview = previewDiary ? await getDiaryLedgerForRequestUser(previewDiary.diary.id) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,#f4f7ff_0%,#f8fafc_40%,#f1f5f9_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_20%_-10%,#111827_0%,#09090b_50%,#020617_100%)]">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg shadow-zinc-200/40 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80 dark:shadow-black/40">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                TopDownBudget Cockpit
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                내 가계부 / 공개 가계부
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {isLoggedIn
                  ? "접근 가능한 가계부를 확인하고 상세 화면으로 이동할 수 있습니다."
                  : "로그인 전에는 공개(public) 가계부를 확인할 수 있습니다."}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-right dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">기본 통화</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">KRW</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg shadow-zinc-200/40 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80 dark:shadow-black/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">가계부 목록</h2>
            <Link
              href="/new"
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              새 가계부 만들기
            </Link>
          </div>

          {diaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {isLoggedIn
                ? "아직 접근 가능한 가계부가 없습니다. 새 가계부를 만들어 시작해보세요."
                : "아직 노출할 공개 가계부가 없습니다. 로그인 후 직접 생성해보세요."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {diaries.map(({ diary, role }) => (
                <Link
                  key={diary.id}
                  href={role === "owner" || role === "manager" ? `/diary/${diary.id}/entries` : `/diary/${diary.id}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
                      {diary.title}
                    </h3>
                    <RoleBadge role={role} />
                  </div>

                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    visibility: {diary.is_public ? "public" : "private"} · base currency: {diary.base_currency}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">하이라키 그리드 미리보기</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {previewDiary
              ? `최신 가계부(${previewDiary.diary.title}) 기준으로 계산된 계층 요약입니다.`
              : "가계부를 하나 이상 생성하면 하이라키 미리보기가 표시됩니다."}
          </p>
        </section>

        {previewDiary && ledgerPreview ? (
          <HierarchyBudgetGrid
            initialNodes={ledgerPreview.nodes}
            initialRole={ledgerPreview.role}
            allowRoleSwitch={false}
            editable={false}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            아직 미리보기할 하이라키 데이터가 없습니다. 먼저 가계부를 생성하거나 분류/지출 내역을 추가해 주세요.
          </div>
        )}
      </main>
    </div>
  );
}
