export type LedgerRole = "owner" | "manager" | "viewer" | "guest";

export type LedgerNode = {
  id: string;
  name: string;
  parentAmount: number | null;
  ownSpent: number;
  children?: LedgerNode[];
};

export type GridRow = {
  id: string;
  sourceNodeId: string;
  kind: "category" | "other";
  name: string;
  depth: number;
  parentAmount: number | null;
  childrenSpent: number;
  ownSpent: number;
  totalSpent: number;
  otherAmount: number | null;
  subRows?: GridRow[];
};
