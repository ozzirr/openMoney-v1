import type { Wallet, WalletType } from "@/repositories/types";

export type WalletGroupOrder = Record<WalletType, Wallet[]>;

const walletTypes: WalletType[] = ["LIQUIDITY", "INVEST"];

function sortByOrder(a: Wallet, b: Wallet): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return a.id - b.id;
}

export function orderWalletsForUI(wallets: Wallet[]): Wallet[] {
  const grouped = walletTypes.reduce<WalletGroupOrder>((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as WalletGroupOrder);
  wallets.forEach((wallet) => {
    grouped[wallet.type]?.push(wallet);
  });
  const ordered: Wallet[] = [];
  walletTypes.forEach((type) => {
    const group = grouped[type] ?? [];
    ordered.push(...group.sort(sortByOrder));
  });
  return ordered;
}

export function groupWalletsByType(wallets: Wallet[]): WalletGroupOrder {
  const grouped = walletTypes.reduce<WalletGroupOrder>((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as WalletGroupOrder);
  wallets.forEach((wallet) => {
    grouped[wallet.type]?.push(wallet);
  });
  return grouped;
}
