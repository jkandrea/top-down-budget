"use client";

import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { buildGridRows, formatWon, summarize, updateNodeById } from "@/components/ledger/calc";
import { INITIAL_LEDGER_TREE } from "@/components/ledger/sample-data";
import type { GridRow, LedgerRole, LedgerNode } from "@/components/ledger/types";

function roleCanEdit(role: LedgerRole): boolean {
  return role === "owner" || role === "manager";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export function HierarchyBudgetGrid() {
  const [role, setRole] = useState<LedgerRole>("owner");
  const [nodes, setNodes] = useState<LedgerNode[]>(INITIAL_LEDGER_TREE);
  const [expanded, setExpanded] = useState<ExpandedState>({
    food: true,
    living: true,
    self: true,
  });

  const canEdit = roleCanEdit(role);
  const gridRows = useMemo(() => buildGridRows(nodes), [nodes]);
  const summary = useMemo(() => summarize(nodes), [nodes]);

  const columns = useMemo<ColumnDef<GridRow>[]>(
    () => [
      {
        id: "name",
        header: "분류",
        cell: ({ row, getValue }) => {
          const data = row.original;
          const name = getValue<string>();

          return (
            <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 16}px` }}>
              {row.getCanExpand() ? (
                <button
                  type="button"
                  onClick={row.getToggleExpandedHandler()}
                  className="h-6 w-6 rounded-full border border-zinc-200 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label={row.getIsExpanded() ? "접기" : "펼치기"}
                >
                  {row.getIsExpanded() ? "-" : "+"}
                </button>
              ) : (
                <span className="h-6 w-6" />
              )}
              <span
                className={
                  data.kind === "other"
                    ? "text-sm font-medium text-zinc-500 dark:text-zinc-400"
                    : "text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                }
              >
                {name}
              </span>
              {data.kind === "other" ? (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  read-only
                </span>
              ) : null}
            </div>
          );
        },
        accessorFn: (row) => row.name,
      },
      {
        id: "parentAmount",
        header: "상위 입력 금액",
        cell: ({ row }) => {
          const data = row.original;
          if (data.kind === "other") {
            return <span className="text-zinc-400">-</span>;
          }

          const value = data.parentAmount ?? 0;
          if (!canEdit) {
            return <span>{formatWon(value)}</span>;
          }

          return (
            <input
              type="number"
              className="w-32 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-right text-sm outline-none ring-0 transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              value={value}
              onChange={(event) => {
                const next = Number(event.target.value || 0);
                setNodes((prev) => updateNodeById(prev, data.sourceNodeId, { parentAmount: next }));
              }}
            />
          );
        },
      },
      {
        id: "childrenSpent",
        header: "하위 집행 합계",
        cell: ({ row }) => {
          const data = row.original;
          if (data.kind === "other") {
            return <span className="text-zinc-400">-</span>;
          }
          return <span>{formatWon(data.childrenSpent)}</span>;
        },
      },
      {
        id: "otherAmount",
        header: "기타(자동)",
        cell: ({ row }) => {
          const data = row.original;
          const value = data.kind === "other" ? data.otherAmount ?? 0 : data.otherAmount ?? 0;
          const isNegative = value < 0;

          return (
            <span className={isNegative ? "font-semibold text-rose-600 dark:text-rose-400" : "font-medium"}>
              {formatWon(value)}
            </span>
          );
        },
      },
      {
        id: "ownSpent",
        header: "직접 집행액",
        cell: ({ row }) => {
          const data = row.original;
          if (data.kind === "other") {
            return <span className="text-zinc-400">-</span>;
          }

          if (!canEdit) {
            return <span>{formatWon(data.ownSpent)}</span>;
          }

          return (
            <input
              type="number"
              className="w-32 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-right text-sm outline-none ring-0 transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              value={data.ownSpent}
              onChange={(event) => {
                const next = Number(event.target.value || 0);
                setNodes((prev) => updateNodeById(prev, data.sourceNodeId, { ownSpent: next }));
              }}
            />
          );
        },
      },
      {
        id: "totalSpent",
        header: "총 집행액",
        cell: ({ row }) => {
          const data = row.original;
          if (data.kind === "other") {
            return <span className="text-zinc-400">-</span>;
          }
          return <span>{formatWon(data.totalSpent)}</span>;
        },
      },
    ],
    [canEdit],
  );

  const table = useReactTable({
    data: gridRows,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">가계부 하이라키 그리드</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            기타는 자동 계산됩니다: 기타 = 상위 입력 금액 - 하위 집행 합계
          </p>
        </div>
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          권한
          <select
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={role}
            onChange={(event) => setRole(event.target.value as LedgerRole)}
          >
            <option value="owner">owner</option>
            <option value="manager">manager</option>
            <option value="viewer">viewer</option>
            <option value="guest">guest(public 조회자)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="상위 입력 총액" value={formatWon(summary.parentBudget)} />
        <StatCard label="하위 집행 합계" value={formatWon(summary.childrenSpent)} />
        <StatCard label="직접 집행 합계" value={formatWon(summary.ownSpent)} />
        <StatCard label="기타(자동) 총합" value={formatWon(summary.autoOther)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-3 text-left font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const isOther = row.original.kind === "other";
                return (
                  <tr
                    key={row.id}
                    className={
                      isOther
                        ? "border-t border-zinc-100 bg-zinc-50/60 dark:border-zinc-900 dark:bg-zinc-900/40"
                        : "border-t border-zinc-100 dark:border-zinc-900"
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle text-zinc-700 dark:text-zinc-200">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
