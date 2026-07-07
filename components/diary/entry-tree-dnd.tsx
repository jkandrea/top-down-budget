"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveEntryAction } from "@/actions/entry-actions";
import type { DiaryCategoryOption, DiaryEntryTreeNode } from "@/lib/diary/queries";

type DropPosition = "above" | "inside" | "below";

type EntryTreeDndProps = {
  diaryId: string;
  canEdit: boolean;
  nodes: DiaryEntryTreeNode[];
  categories: DiaryCategoryOption[];
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

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

export function EntryTreeDnd({ diaryId, canEdit, nodes, categories }: EntryTreeDndProps) {
  const router = useRouter();
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [pendingMove, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const flatNodes = useMemo(() => flattenTree(nodes), [nodes]);
  const categoryMap = useMemo(
    () => new Map<string, string>(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const onDrop = (targetEntryId: string, dropPosition: DropPosition) => {
    if (!canEdit || !draggedEntryId) {
      return;
    }

    if (draggedEntryId === targetEntryId) {
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("diary_id", diaryId);
        formData.set("dragged_entry_id", draggedEntryId);
        formData.set("target_entry_id", targetEntryId);
        formData.set("drop_position", dropPosition);
        await moveEntryAction(formData);
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "내역 이동에 실패했습니다.");
      } finally {
        setDraggedEntryId(null);
      }
    });
  };

  const rows: JSX.Element[] = [];

  const renderRows = (items: DiaryEntryTreeNode[], depth: number) => {
    for (const node of items) {
      rows.push(
        <tr
          key={node.id}
          draggable={canEdit}
          onDragStart={() => setDraggedEntryId(node.id)}
          onDragEnd={() => setDraggedEntryId(null)}
          className="border-t border-zinc-100 dark:border-zinc-900"
        >
          <td className="px-3 py-2.5 align-top">
            <div style={{ paddingLeft: `${depth * 16}px` }}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{node.content}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{node.entryDate || "-"}</p>
            </div>
          </td>
          <td className="px-3 py-2.5 align-top">{node.categoryId ? categoryMap.get(node.categoryId) ?? "미분류" : "미분류"}</td>
          <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{node.memo ?? "-"}</td>
          <td
            className={
              node.signedAmount >= 0
                ? "px-3 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400"
                : "px-3 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400"
            }
          >
            {formatMoney(node.signedAmount, node.currency)}
          </td>
          <td className="px-3 py-2.5 align-top">
            {canEdit ? (
              <div className="grid grid-cols-3 gap-1 text-xs">
                <button
                  type="button"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDrop(node.id, "above");
                  }}
                  className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  위
                </button>
                <button
                  type="button"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDrop(node.id, "inside");
                  }}
                  className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  자식
                </button>
                <button
                  type="button"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDrop(node.id, "below");
                  }}
                  className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  아래
                </button>
              </div>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        </tr>,
      );

      renderRows(node.children, depth + 1);
    }
  };

  renderRows(nodes, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400">
        {canEdit
          ? "내역 행을 드래그한 뒤 목표 내역의 위/자식/아래 버튼 위에 놓아 트리를 재구성하세요."
          : "조회 전용입니다."}
      </div>
      {pendingMove ? (
        <p className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">내역 이동 중...</p>
      ) : null}
      {errorMessage ? <p className="px-4 py-2 text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-3 text-left font-medium">내역</th>
              <th className="px-3 py-3 text-left font-medium">카테고리</th>
              <th className="px-3 py-3 text-left font-medium">메모</th>
              <th className="px-3 py-3 text-right font-medium">금액</th>
              <th className="px-3 py-3 text-left font-medium">드롭 위치</th>
            </tr>
          </thead>
          <tbody>
            {flatNodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  내역이 없습니다. 상단 등록 폼으로 첫 내역을 추가하세요.
                </td>
              </tr>
            ) : (
              rows
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
