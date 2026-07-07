import Link from "next/link";
import { notFound } from "next/navigation";
import { createEntryAction, deleteEntryAction } from "@/actions/entry-actions";
import { EntryTreeDnd } from "@/components/diary/entry-tree-dnd";
import { canEditDiary } from "@/lib/auth/permissions";
import {
  getDiaryDetailForRequestUser,
  getDiaryEntryTreeForDiary,
  type DiaryEntryTreeNode,
} from "@/lib/diary/queries";

type PageProps = {
  params: Promise<{ id: string }>;
};

function flattenTree(nodes: DiaryEntryTreeNode[]): DiaryEntryTreeNode[] {
  const flattened: DiaryEntryTreeNode[] = [];

  const walk = (items: DiaryEntryTreeNode[]) => {
    for (const item of items) {
      flattened.push(item);
      walk(item.children);
    }
  };

  walk(nodes);
  return flattened;
}

export default async function DiaryEntriesPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getDiaryDetailForRequestUser(id);

  if (!detail) {
    notFound();
  }

  const { diary, role } = detail;
  const canEdit = canEditDiary(role);
  const treeResult = await getDiaryEntryTreeForDiary(id);
  const flatNodes = flattenTree(treeResult.nodes);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">탑다운 내역 트리</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {diary.title} · role: {role} · 모든 내역이 하이라키 구조 안에 위치합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/diary/${diary.id}`}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              상세로 돌아가기
            </Link>
            {canEdit ? (
              <Link
                href={`/diary/${diary.id}/edit`}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                가계부 설정 수정
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold tracking-tight">내역 등록</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            이 폼으로 등록하는 내역은 항상 루트로 추가됩니다. 부모/자식 관계는 아래 트리에서 드래그앤드롭으로 조정하세요.
          </p>
          <form action={createEntryAction} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="diary_id" value={diary.id} />
            <input type="hidden" name="currency" value={diary.base_currency} />
            <input type="hidden" name="return_to" value={`/diary/${diary.id}/entries`} />
            <input type="hidden" name="insert_mode" value="root" />

            <input
              name="content"
              required
              placeholder="내역"
              className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <input
              name="signed_amount"
              type="number"
              step="0.01"
              required
              placeholder="금액(+수입 / -지출)"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <input
              name="new_category_name"
              placeholder="신규 분류 직접 입력(선택)"
              className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <select
              name="category_id"
              defaultValue=""
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">기존 분류 선택(선택)</option>
              {treeResult.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <input
              name="entry_date"
              type="date"
              required
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <input
              name="memo"
              placeholder="메모"
              className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <div className="lg:col-span-6">
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                내역 저장
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          현재 권한({role})은 조회 전용입니다. owner 또는 manager 권한에서만 내역 등록/삭제가 가능합니다.
        </section>
      )}

      <EntryTreeDnd
        diaryId={diary.id}
        canEdit={canEdit}
        nodes={treeResult.nodes}
        categories={treeResult.categories}
      />

      {canEdit && flatNodes.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight">내역 삭제</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            삭제하면 해당 내역의 하위 내역도 함께 삭제됩니다.
          </p>
          <form action={deleteEntryAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="diary_id" value={diary.id} />
            <select
              name="entry_id"
              required
              defaultValue=""
              className="min-w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">삭제할 내역 선택</option>
              {flatNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.content}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              선택 내역 삭제
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
