import type { GridRow, LedgerNode } from "@/components/ledger/types";

export function formatWon(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sumNode(node: LedgerNode): number {
  const childTotal = (node.children ?? []).reduce((acc, child) => acc + sumNode(child), 0);
  return node.ownSpent + childTotal;
}

function sumChildren(node: LedgerNode): number {
  return (node.children ?? []).reduce((acc, child) => acc + sumNode(child), 0);
}

function toGridRow(node: LedgerNode, depth: number): GridRow {
  const childrenSpent = sumChildren(node);
  const totalSpent = node.ownSpent + childrenSpent;
  const otherAmount = node.parentAmount === null ? null : node.parentAmount - childrenSpent;

  const childRows = (node.children ?? []).map((child) => toGridRow(child, depth + 1));

  const rowsWithAutoOther: GridRow[] =
    node.parentAmount === null
      ? childRows
      : [
          ...childRows,
          {
            id: `${node.id}__other`,
            sourceNodeId: node.id,
            kind: "other",
            name: "기타(자동)",
            depth: depth + 1,
            parentAmount: null,
            childrenSpent: 0,
            ownSpent: 0,
            totalSpent: 0,
            otherAmount,
          },
        ];

  return {
    id: node.id,
    sourceNodeId: node.id,
    kind: "category",
    name: node.name,
    depth,
    parentAmount: node.parentAmount,
    childrenSpent,
    ownSpent: node.ownSpent,
    totalSpent,
    otherAmount,
    subRows: rowsWithAutoOther,
  };
}

export function buildGridRows(nodes: LedgerNode[]): GridRow[] {
  return nodes.map((node) => toGridRow(node, 0));
}

export function summarize(nodes: LedgerNode[]) {
  const rootRows = buildGridRows(nodes);
  const parentBudget = rootRows.reduce((acc, row) => acc + (row.parentAmount ?? 0), 0);
  const childrenSpent = rootRows.reduce((acc, row) => acc + row.childrenSpent, 0);
  const ownSpent = rootRows.reduce((acc, row) => acc + row.ownSpent, 0);
  const autoOther = rootRows.reduce((acc, row) => acc + (row.otherAmount ?? 0), 0);

  return {
    parentBudget,
    childrenSpent,
    ownSpent,
    totalSpent: childrenSpent + ownSpent,
    autoOther,
  };
}

export function updateNodeById(
  nodes: LedgerNode[],
  nodeId: string,
  updates: Partial<Pick<LedgerNode, "parentAmount" | "ownSpent">>,
): LedgerNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        ...updates,
      };
    }

    if (!node.children || node.children.length === 0) {
      return node;
    }

    return {
      ...node,
      children: updateNodeById(node.children, nodeId, updates),
    };
  });
}
