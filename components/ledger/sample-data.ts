import type { LedgerNode } from "@/components/ledger/types";

export const INITIAL_LEDGER_TREE: LedgerNode[] = [
  {
    id: "food",
    name: "식비",
    parentAmount: 800000,
    ownSpent: 0,
    children: [
      { id: "food-home", name: "장보기", parentAmount: 250000, ownSpent: 184500 },
      { id: "food-out", name: "외식", parentAmount: 350000, ownSpent: 277000 },
      { id: "food-cafe", name: "카페", parentAmount: 120000, ownSpent: 91200 },
    ],
  },
  {
    id: "living",
    name: "생활",
    parentAmount: 600000,
    ownSpent: 0,
    children: [
      { id: "living-transport", name: "교통", parentAmount: 120000, ownSpent: 85400 },
      { id: "living-sub", name: "구독", parentAmount: 150000, ownSpent: 125000 },
      { id: "living-shopping", name: "쇼핑", parentAmount: 180000, ownSpent: 240000 },
    ],
  },
  {
    id: "self",
    name: "개인 용돈",
    parentAmount: 300000,
    ownSpent: 120000,
    children: [],
  },
];
