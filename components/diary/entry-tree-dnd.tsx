"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteEntryAction,
  moveEntryAction,
  reconcileEntryRemainderAction,
  reconcileEntryTotalAction,
  updateEntryAmountAction,
} from "@/actions/entry-actions";
import type { DiaryCategoryOption, DiaryEntryTreeNode } from "@/lib/diary/queries";

type DropPosition = "above" | "inside" | "below";

type EntryTreeDndProps = {
  diaryId: string;
  canEdit: boolean;
  nodes: DiaryEntryTreeNode[];
  categories: DiaryCategoryOption[];
};

type HoverDropTarget = {
  targetEntryId: string;
  dropPosition: DropPosition;
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
  const [hoverDropTarget, setHoverDropTarget] = useState<HoverDropTarget | null>(null);
  const [pendingAction, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; content: string } | null>(null);
  const flatNodes = useMemo(() => flattenTree(nodes), [nodes]);
  const categoryMap = useMemo(
    () => new Map<string, string>(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const childCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();

    const walk = (items: DiaryEntryTreeNode[]) => {
      for (const item of items) {
        counts.set(item.id, item.children.length);
        walk(item.children);
      }
    };

    walk(nodes);
    return counts;
  }, [nodes]);

  const runMutation = (task: () => Promise<void>, options?: { clearDrag?: boolean; closeModal?: boolean }) => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
      } finally {
        if (options?.clearDrag) {
          setDraggedEntryId(null);
          setHoverDropTarget(null);
        }

        if (options?.closeModal) {
          setDeleteTarget(null);
        }
      }
    });
  };

  const onDrop = (targetEntryId: string, dropPosition: DropPosition) => {
    if (!canEdit || !draggedEntryId) {
      return;
    }

    if (draggedEntryId === targetEntryId) {
      return;
    }

    runMutation(async () => {
      const formData = new FormData();
      formData.set("diary_id", diaryId);
      formData.set("dragged_entry_id", draggedEntryId);
      formData.set("target_entry_id", targetEntryId);
      formData.set("drop_position", dropPosition);
      await moveEntryAction(formData);
    }, { clearDrag: true });
  };

  const submitSignedAmountUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const signedAmountRaw = formData.get("signed_amount");
    const signedAmount = typeof signedAmountRaw === "string" ? Number(signedAmountRaw) : Number.NaN;

    if (!Number.isFinite(signedAmount)) {
      return;
    }

    const baselineRaw = formData.get("baseline_signed_amount");
    const baseline = typeof baselineRaw === "string" ? Number(baselineRaw) : Number.NaN;
    if (Number.isFinite(baseline) && Math.abs(signedAmount - baseline) < 0.000001) {
      return;
    }

    runMutation(async () => {
      await updateEntryAmountAction(formData);
    });
  };

  const canDropOnTarget = (targetEntryId: string) => {
    if (!canEdit || !draggedEntryId) {
      return false;
    }

    return draggedEntryId !== targetEntryId;
  };

  const setDropPreview = (targetEntryId: string, dropPosition: DropPosition) => {
    if (!canDropOnTarget(targetEntryId)) {
      return;
    }

    setHoverDropTarget((prev) => {
      if (prev?.targetEntryId === targetEntryId && prev.dropPosition === dropPosition) {
        return prev;
      }

      return { targetEntryId, dropPosition };
    });
  };

  const commitDrop = (targetEntryId: string, dropPosition: DropPosition) => {
    setHoverDropTarget(null);
    onDrop(targetEntryId, dropPosition);
  };

  const startDraggingEntry = (event: React.DragEvent<HTMLElement>, entryId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entryId);
    setDraggedEntryId(entryId);
    setHoverDropTarget(null);
  };

  const finishDraggingEntry = () => {
    setDraggedEntryId(null);
    setHoverDropTarget(null);
  };

  const rows: JSX.Element[] = [];

  const renderRows = (items: DiaryEntryTreeNode[], depth: number) => {
    for (const node of items) {
      const isInsidePreview =
        hoverDropTarget?.targetEntryId === node.id && hoverDropTarget.dropPosition === "inside";
      const isAbovePreview =
        hoverDropTarget?.targetEntryId === node.id && hoverDropTarget.dropPosition === "above";
      const isBelowPreview =
        hoverDropTarget?.targetEntryId === node.id && hoverDropTarget.dropPosition === "below";

      rows.push(
        <tr
            key={node.id}
            onDragOver={(event) => {
              if (!canDropOnTarget(node.id)) {
                return;
              }

              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const y = event.clientY - rect.top;
              const ratio = rect.height > 0 ? y / rect.height : 0.5;

              if (ratio < 0.25) {
                setDropPreview(node.id, "above");
              } else if (ratio > 0.75) {
                setDropPreview(node.id, "below");
              } else {
                setDropPreview(node.id, "inside");
              }
            }}
            onDrop={(event) => {
              if (!canDropOnTarget(node.id)) {
                return;
              }

              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const y = event.clientY - rect.top;
              const ratio = rect.height > 0 ? y / rect.height : 0.5;

              if (ratio < 0.25) {
                commitDrop(node.id, "above");
              } else if (ratio > 0.75) {
                commitDrop(node.id, "below");
              } else {
                commitDrop(node.id, "inside");
              }
            }}
            className={
              isInsidePreview
                ? "border-y border-dashed border-sky-500 bg-sky-50/60 dark:border-sky-400 dark:bg-sky-950/20"
                : "border-t border-zinc-100 dark:border-zinc-900"
            }
          >
            <td className="px-3 py-2.5 align-top">
              <div className="relative flex items-start gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
                {isAbovePreview ? (
                  <div className="pointer-events-none absolute -top-1 left-0 right-0 border-t-2 border-dashed border-sky-500" />
                ) : null}
                {isBelowPreview ? (
                  <div className="pointer-events-none absolute -bottom-1 left-0 right-0 border-b-2 border-dashed border-sky-500" />
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => startDraggingEntry(event, node.id)}
                    onDragEnd={finishDraggingEntry}
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    title="드래그해서 이동"
                    aria-label="드래그해서 이동"
                  >
                    <span className="grid grid-cols-2 gap-[2px]" aria-hidden="true">
                      <span className="h-1 w-1 rounded-full bg-current" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                    </span>
                  </button>
                ) : null}
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{node.content}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{node.entryDate || "-"}</p>
                </div>
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
              {canEdit ? (
                <form onSubmit={submitSignedAmountUpdate} className="ml-auto flex w-48 items-center justify-end gap-1.5">
                  <input type="hidden" name="diary_id" value={diaryId} />
                  <input type="hidden" name="entry_id" value={node.id} />
                  <input type="hidden" name="baseline_signed_amount" value={node.signedAmount.toFixed(2)} />
                  <input
                    key={`${node.id}:${node.signedAmount}`}
                    name="signed_amount"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={node.signedAmount.toFixed(2)}
                    onBlur={(event) => {
                      const form = event.currentTarget.form;
                      if (!form) {
                        return;
                      }

                      submitSignedAmountUpdate({
                        currentTarget: form,
                        preventDefault: () => {},
                      } as React.FormEvent<HTMLFormElement>);
                    }}
                    className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-xs font-medium text-zinc-800 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </form>
              ) : (
                formatMoney(node.signedAmount, node.currency)
              )}
            </td>
            <td className="px-3 py-2.5 align-top">
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("diary_id", diaryId);
                      formData.set("entry_id", node.id);
                      runMutation(async () => {
                        await reconcileEntryTotalAction(formData);
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    총액 정산
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("diary_id", diaryId);
                      formData.set("entry_id", node.id);
                      runMutation(async () => {
                        await reconcileEntryRemainderAction(formData);
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded border border-sky-300 px-2 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:border-sky-900/60 dark:text-sky-300 dark:hover:bg-sky-950/30"
                  >
                    잔액 정산
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: node.id, content: node.content })}
                    className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    삭제
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
          ? "행을 드래그하면 위/아래 점선 드롭존과 행 내부 자식 영역이 활성화됩니다. 원하는 위치에 놓아 트리를 재구성하세요."
          : "조회 전용입니다."}
      </div>
      {pendingAction ? (
        <p className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">요청 처리 중...</p>
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
              <th className="px-3 py-3 text-left font-medium">작업</th>
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

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-base font-semibold tracking-tight">내역 삭제 확인</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleteTarget.content}</span> 내역을 삭제하면 하위 내역도 함께 삭제됩니다.
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              직계 하위 내역 수: {childCountByParentId.get(deleteTarget.id) ?? 0}개
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const formData = new FormData();
                  formData.set("diary_id", diaryId);
                  formData.set("entry_id", deleteTarget.id);
                  formData.set("no_redirect", "1");

                  runMutation(async () => {
                    await deleteEntryAction(formData);
                  }, { closeModal: true });
                }}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                삭제 실행
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
