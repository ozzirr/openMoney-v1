import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  createSnapshotWithLines,
  getSnapshotByDate,
  listSnapshotLines,
  listSnapshots,
  updateSnapshotWithLines,
  deleteSnapshot,
} from "@/repositories/snapshotsRepo";
import { listWallets } from "@/repositories/walletsRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { Snapshot, SnapshotLineDetail, Wallet, Currency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import { totalsByWalletType } from "@/domain/calculations";
import { orderWalletsForUI } from "@/domain/walletOrdering";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSettings } from "@/settings/useSettings";
import AppBackground from "@/ui/components/AppBackground";
import { createStandardTextInputProps } from "@/ui/components/standardInputProps";
import { onDataReset } from "@/app/dataEvents";
import {
  GlassCardContainer,
  PrimaryPillButton,
  PillChip,
  SmallOutlinePillButton,
} from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type DraftLine = {
  walletId: number;
  amount: string;
};

const MONTH_LABELS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const currencySymbol = (currency?: Currency | null): string => {
  if (!currency) {
    return "";
  }
  return currencySymbols[currency] ?? currency;
};

const amountFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatAmount = (value: number): string => amountFormatter.format(value);

const normalizeInputAmount = (value: string): string =>
  value.replace(/\./g, "").replace(",", ".").trim();

const monthKeyFromDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
};

const monthLabelFromKey = (key: string) => {
  const [year, month] = key.split("-");
  const labelMonth = MONTH_LABELS[Number(month)];
  return `${labelMonth.slice(0, 3)} '${year.slice(-2)}`;
};

const formatHeroMonth = (key: string) => {
  const [year, month] = key.split("-");
  const labelMonth = MONTH_LABELS[Number(month)];
  return `${labelMonth.slice(0, 3)} ${year.slice(-2)}`;
};

const formatShortDate = (isoDate: string | null): string => {
  if (!isoDate || !isIsoDate(isoDate)) {
    return "";
  }
  const date = new Date(isoDate);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
};

const buildRecentMonthGroups = (startKey: string, count: number): { key: string; label: string; snapshots: Snapshot[] }[] => {
  const [yearStr, monthStr] = startKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return [];
  }
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(year, monthIndex - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    return { key, label: monthLabelFromKey(key), snapshots: [] };
  });
};

const lastDayIsoFromMonthKey = (key: string): string => {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return todayIso();
  }
  const date = new Date(year, monthIndex + 1, 0);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function SnapshotScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const baseInputProps = createStandardTextInputProps(tokens);
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { showInvestments } = useSettings();
  const { t, i18n } = useTranslation();
  const route = useRoute();
  const openNew = (route.params as { openNew?: boolean } | undefined)?.openNew;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [lines, setLines] = useState<SnapshotLineDetail[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(todayIso());
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const [focusedLineId, setFocusedLineId] = useState<number | null>(null);
  const inputRefs = useRef<Record<number, React.ComponentRef<typeof TextInput> | null>>({});

  const load = useCallback(async () => {
    const [snap, walletList] = await Promise.all([
      listSnapshots(),
      listWallets(true),
    ]);
    setSnapshots(snap);
    setWallets(walletList);
    const prefill = await getPreference("prefill_snapshot");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    if (snap.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(snap[0].id);
    }
  }, [selectedSnapshotId]);

  const loadLines = useCallback(async (snapshotId?: number) => {
    const targetId = snapshotId ?? selectedSnapshotId;
    if (!targetId) {
      setLines([]);
      return;
    }
    const data = await listSnapshotLines(targetId);
    setLines(data);
  }, [selectedSnapshotId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const refreshAll = useCallback(async () => {
    await load();
    await loadLines();
  }, [load, loadLines]);

  useEffect(() => {
    const subscription = onDataReset(() => {
      void refreshAll();
    });
    return () => subscription.remove();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      return undefined;
    }, [refreshAll])
  );

  useEffect(() => {
    if (openNew) {
      openNewSnapshot();
    }
  }, [openNew]);

  useEffect(() => {
    if (!showForm || editingSnapshotId !== null) return;
    const currentKey = monthKeyFromDate(todayIso());
    const targetKey = activeMonthKey ?? currentKey;
    if (!targetKey) return;
    if (targetKey !== currentKey) {
      setSnapshotDate(lastDayIsoFromMonthKey(targetKey));
    } else {
      setSnapshotDate(todayIso());
    }
  }, [activeMonthKey, editingSnapshotId, showForm]);

  const openNewSnapshot = async () => {
    if (showForm) {
      setShowForm(false);
      setEditingSnapshotId(null);
      return;
    }
    setError(null);
    setEditingSnapshotId(null);
    const latest = snapshots[0];
    let initialLines: DraftLine[] = [];
    if (latest && prefillSnapshot) {
      const latestLines = await listSnapshotLines(latest.id);
      const latestMap = new Map<number, string>();
      latestLines.forEach((line) => {
        latestMap.set(line.wallet_id, formatAmount(line.amount));
      });
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: latestMap.get(wallet.id) ?? formatAmount(0),
      }));
    }

    if (initialLines.length === 0) {
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: formatAmount(0),
      }));
    }

    setDraftLines(initialLines);
    const currentKey = monthKeyFromDate(todayIso());
    const targetKey = activeMonthKey ?? currentKey;
    if (targetKey && targetKey !== currentKey) {
      setSnapshotDate(lastDayIsoFromMonthKey(targetKey));
    } else {
      setSnapshotDate(todayIso());
    }
    setShowForm(true);
  };

  const openEditSnapshot = async (snapshotId: number) => {
    setError(null);
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    const snapshotLines = await listSnapshotLines(snapshotId);
    const lineMap = new Map<number, string>();
    snapshotLines.forEach((line) => {
      lineMap.set(line.wallet_id, formatAmount(line.amount));
    });
    const initialLines = orderedWallets.map((wallet) => ({
      walletId: wallet.id,
      amount: lineMap.get(wallet.id) ?? "0",
    }));
    const currentKey = monthKeyFromDate(todayIso());
    const selectedKey = activeMonthKey ?? monthKeyFromDate(snapshot.date) ?? currentKey;
    const targetDate =
      selectedKey && currentKey && selectedKey !== currentKey
        ? lastDayIsoFromMonthKey(selectedKey)
        : todayIso();
    setDraftLines(initialLines);
    setSnapshotDate(targetDate);
    setEditingSnapshotId(snapshotId);
    setShowForm(true);
  };

  const updateDraftLine = (index: number, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const confirmOverwrite = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        "Snapshot già esistente",
        "Esiste già uno snapshot per questa data. Vuoi sovrascriverlo?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Sovrascrivi", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

  const saveSnapshot = async () => {
    setError(null);
    if (!isIsoDate(snapshotDate)) {
      setError("Data non valida (YYYY-MM-DD).");
      return;
    }
    const cleaned = draftLines
      .map((line) => ({
        wallet_id: line.walletId,
        amount: Number(normalizeInputAmount(line.amount)),
      }))
      .filter((line) => Number.isFinite(line.amount));

    if (cleaned.length === 0) {
      setError("Inserisci almeno una linea valida.");
      return;
    }

    const existing = await getSnapshotByDate(snapshotDate);
    if (existing && existing.id !== editingSnapshotId) {
      const ok = await confirmOverwrite();
      if (!ok) {
        return;
      }
      await deleteSnapshot(existing.id);
    }

    const id = editingSnapshotId
      ? await updateSnapshotWithLines(editingSnapshotId, snapshotDate, cleaned)
      : await createSnapshotWithLines(snapshotDate, cleaned);
    setShowForm(false);
    setEditingSnapshotId(null);
    setSelectedSnapshotId(id);
    await load();
    await loadLines(id);
  };

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId]
  );
  const totals = useMemo(() => totalsByWalletType(lines), [lines]);
  const sortedLines = useMemo(() => [...lines].sort((a, b) => b.amount - a.amount), [lines]);
  const orderedWallets = useMemo(() => orderWalletsForUI(wallets), [wallets]);
  const walletById = useMemo(() => {
    const map = new Map<number, Wallet>();
    wallets.forEach((wallet) => map.set(wallet.id, wallet));
    return map;
  }, [wallets]);
  const totalsCurrency = useMemo<Currency | null>(() => {
    const firstLine = sortedLines[0];
    const wallet = firstLine ? walletById.get(firstLine.wallet_id) : null;
    return wallet?.currency ?? null;
  }, [sortedLines, walletById]);
  const totalsCurrencySymbol = currencySymbol(totalsCurrency);

  const monthGroups = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    const sorted = [...snapshots].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    sorted.forEach((snapshot) => {
      const key = monthKeyFromDate(snapshot.date);
      if (!key) return;
      const collection = map.get(key) ?? [];
      collection.push(snapshot);
      map.set(key, collection);
    });
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      label: monthLabelFromKey(key),
      snapshots: list,
    }));
  }, [snapshots]);

  const displayMonthGroups = useMemo(() => {
    const currentKey = monthKeyFromDate(todayIso());
    if (!currentKey) {
      return monthGroups;
    }
    const base = buildRecentMonthGroups(currentKey, 6);
    const baseKeys = new Set(base.map((item) => item.key));
    const snapshotByKey = new Map(monthGroups.map((group) => [group.key, group]));
    const merged = base.map((item) => snapshotByKey.get(item.key) ?? item);
    const extras = monthGroups.filter((group) => !baseKeys.has(group.key));
    return [...merged, ...extras];
  }, [monthGroups]);

  useEffect(() => {
    if (displayMonthGroups.length === 0) return;
    const isValid = activeMonthKey
      ? displayMonthGroups.some((group) => group.key === activeMonthKey)
      : false;
    if (!isValid) {
      setActiveMonthKey(displayMonthGroups[0].key);
    }
  }, [activeMonthKey, displayMonthGroups]);

  const activeMonth = displayMonthGroups.find((group) => group.key === activeMonthKey) ?? displayMonthGroups[0];
  const monthLimit = showAllMonths ? displayMonthGroups.length : 6;
  const visibleMonthGroups = displayMonthGroups.slice(0, monthLimit);
  const hasMoreMonths = displayMonthGroups.length > visibleMonthGroups.length;
  const activeIndex = displayMonthGroups.findIndex((group) => group.key === activeMonthKey);
  const prevMonthKey =
    activeIndex >= 0 && activeIndex < displayMonthGroups.length - 1 ? displayMonthGroups[activeIndex + 1]?.key : null;
  const nextMonthKey = activeIndex > 0 ? displayMonthGroups[activeIndex - 1]?.key : null;

  const isEditingCurrent =
    showForm &&
    editingSnapshotId !== null &&
    activeMonth?.snapshots[0]?.id === editingSnapshotId;

  const heroCtaLabel = (() => {
    if (activeMonth?.snapshots.length) {
      return isEditingCurrent ? t("common.cancel") : t("snapshot.actions.edit");
    }
    return showForm && !editingSnapshotId ? t("common.cancel") : t("snapshot.actions.new");
  })();

  const handleHeroCta = () => {
    if (activeMonth?.snapshots.length) {
      if (isEditingCurrent) {
        setShowForm(false);
        setEditingSnapshotId(null);
        return;
      }
      const targetId = activeMonth.snapshots[0].id;
      void openEditSnapshot(targetId);
      return;
    }
    if (showForm && !editingSnapshotId) {
      setShowForm(false);
      setEditingSnapshotId(null);
      return;
    }
    void openNewSnapshot();
  };

  useEffect(() => {
    if (!activeMonth) return;
    const contains = selectedSnapshotId
      ? activeMonth.snapshots.some((snapshot) => snapshot.id === selectedSnapshotId)
      : false;
    if (contains) return;
    const nextId = activeMonth.snapshots[0]?.id ?? null;
    if (nextId) {
      setSelectedSnapshotId(nextId);
      void loadLines(nextId);
    }
  }, [activeMonth, selectedSnapshotId, loadLines]);

  return (
    <AppBackground>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        alwaysBounceVertical
        bounces
      >
        {/* Header title/subtitle removed per request */}

        {activeMonth && (
          <GlassCardContainer contentStyle={{ gap: 16 }}>
            <View style={styles.heroHeader}>
              <Text style={[styles.sectionLabel, { color: tokens.colors.muted }]}>{t("snapshot.hero.currentMonth")}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: activeMonth.snapshots.length ? `${tokens.colors.green}22` : `${tokens.colors.yellow}22`,
                    borderColor: activeMonth.snapshots.length ? `${tokens.colors.green}66` : `${tokens.colors.yellow}66`,
                  },
                ]}
              >
                <Text
                  style={{
                    color: activeMonth.snapshots.length ? tokens.colors.green : tokens.colors.yellow,
                    fontWeight: "700",
                  }}
                >
                  {activeMonth.snapshots.length ? t("snapshot.hero.saved") : t("snapshot.hero.missing")}
                </Text>
              </View>
            </View>

            <View style={styles.monthSwitcher}>
              <Pressable
                disabled={!prevMonthKey}
                onPress={() => {
                  if (prevMonthKey) {
                    setActiveMonthKey(prevMonthKey);
                    const nextId = displayMonthGroups.find((m) => m.key === prevMonthKey)?.snapshots[0]?.id ?? null;
                    if (nextId) {
                      setSelectedSnapshotId(nextId);
                      void loadLines(nextId);
                    }
                  }
                }}
                hitSlop={10}
                style={[styles.switchBtn, { opacity: prevMonthKey ? 1 : 0.35 }]}
              >
                <MaterialCommunityIcons name="chevron-left" size={26} color={tokens.colors.text} />
              </Pressable>
              <Text style={[styles.monthLabel, { color: tokens.colors.text }]}>{formatHeroMonth(activeMonth.key)}</Text>
              <Pressable
                disabled={!nextMonthKey}
                onPress={() => {
                  if (nextMonthKey) {
                    setActiveMonthKey(nextMonthKey);
                    const nextId = displayMonthGroups.find((m) => m.key === nextMonthKey)?.snapshots[0]?.id ?? null;
                    if (nextId) {
                      setSelectedSnapshotId(nextId);
                      void loadLines(nextId);
                    }
                  }
                }}
                hitSlop={10}
                style={[styles.switchBtn, { opacity: nextMonthKey ? 1 : 0.35 }]}
              >
                <MaterialCommunityIcons name="chevron-right" size={26} color={tokens.colors.text} />
              </Pressable>
            </View>

            <PrimaryPillButton
              label={heroCtaLabel}
              onPress={handleHeroCta}
              color={tokens.colors.accent}
            />
          </GlassCardContainer>
        )}

        {displayMonthGroups.length > 0 && (
          <GlassCardContainer contentStyle={{ gap: 12 }}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{t("snapshot.hero.recentMonths")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
              {visibleMonthGroups.map((group) => (
                <PillChip
                  key={group.key}
                  label={monthLabelFromKey(group.key)}
                  selected={group.key === activeMonthKey}
                  onPress={() => {
                    setActiveMonthKey(group.key);
                    const nextId = group.snapshots[0]?.id ?? null;
                    if (nextId) {
                      setSelectedSnapshotId(nextId);
                      void loadLines(nextId);
                    }
                  }}
                />
              ))}
            </ScrollView>
          </GlassCardContainer>
        )}

        {showForm && (
          <GlassCardContainer>
            <SectionHeader
              title={editingSnapshotId ? t("snapshot.actions.edit") : t("snapshot.actions.new")}
            />
            <View style={styles.form}>
              <TextInput
                label={t("snapshot.form.dateLabel")}
                value={snapshotDate}
                editable={false}
                {...baseInputProps}
                style={[baseInputProps.style, { backgroundColor: tokens.colors.glassBg }]}
              />
              {draftLines.map((line, index) => {
                const wallet = orderedWallets.find((item) => item.id === line.walletId);
                const walletTitle = wallet
                  ? wallet.type === "INVEST"
                    ? `${wallet.tag || t("wallets.snapshot.investmentTypeFallback")} - ${wallet.name} - ${
                        wallet.currency
                      }`
                    : `${wallet.name} - ${wallet.currency}`
                  : t("wallets.snapshot.walletFallback", { id: line.walletId });
                const toggleSign = () => {
                  const current = line.amount.trim();
                  const toggled = current.startsWith("-") ? current.slice(1) : current === "" ? "-" : `-${current}`;
                  updateDraftLine(index, { amount: toggled });
                  setFocusedLineId(line.walletId);
                  inputRefs.current[line.walletId]?.focus();
                };
                const onAmountChange = (value: string) => {
                  updateDraftLine(index, { amount: value });
                };
                return (
                  <GlassCardContainer key={`${line.walletId}-${index}`}>
                    <SectionHeader title={walletTitle} />
                    <View style={styles.lineInputRow}>
                      <TextInput
                        ref={(ref) => {
                          inputRefs.current[line.walletId] = ref;
                        }}
                        keyboardType="decimal-pad"
                        value={line.amount}
                        {...baseInputProps}
                        style={[baseInputProps.style, { backgroundColor: tokens.colors.glassBg, flex: 1 }]}
                        onChangeText={onAmountChange}
                        onFocus={() => setFocusedLineId(line.walletId)}
                        onBlur={() => setFocusedLineId((prev) => (prev === line.walletId ? null : prev))}
                        right={
                          focusedLineId === line.walletId ? (
                            <TextInput.Icon
                              icon="minus"
                              onPress={toggleSign}
                              forceTextInputFocus
                              color={tokens.colors.accent}
                            />
                          ) : undefined
                        }
                      />
                    </View>
                  </GlassCardContainer>
                );
              })}
              {error && <Text style={{ color: tokens.colors.red }}>{error}</Text>}
            </View>
            <View style={styles.actionsColumn}>
              <View style={styles.actionsRow}>
                <View style={styles.actionSlot}>
                  <PrimaryPillButton label={t("common.save")} onPress={saveSnapshot} color={tokens.colors.accent} />
                </View>
                {editingSnapshotId !== null ? (
                  <View style={styles.actionSlot}>
                    <SmallOutlinePillButton
                      label={t("common.delete")}
                      onPress={() => {
                        Alert.alert(
                          t("snapshot.delete.title", { defaultValue: "Elimina snapshot?" }),
                          t("snapshot.delete.body", { defaultValue: "Questa operazione è irreversibile." }),
                          [
                            { text: t("common.cancel", { defaultValue: "Annulla" }), style: "cancel" },
                            {
                              text: t("common.delete", { defaultValue: "Elimina" }),
                              style: "destructive",
                              onPress: async () => {
                                await deleteSnapshot(editingSnapshotId);
                                setShowForm(false);
                                setEditingSnapshotId(null);
                                setSelectedSnapshotId(null);
                                await load();
                                setLines([]);
                              },
                            },
                          ]
                        );
                      }}
                      color={tokens.colors.red}
                      fullWidth
                    />
                  </View>
                ) : (
                  <View style={styles.actionSlot}>
                    <SmallOutlinePillButton label={t("common.close")} onPress={() => setShowForm(false)} color={tokens.colors.text} />
                  </View>
                )}
              </View>
              {editingSnapshotId !== null && (
                <SmallOutlinePillButton
                  label={t("common.close")}
                  onPress={() => setShowForm(false)}
                  color={tokens.colors.text}
                  fullWidth
                />
              )}
            </View>
          </GlassCardContainer>
        )}

        {displayMonthGroups.length > 0 && (
          <GlassCardContainer contentStyle={{ gap: 12 }}>
            <SectionHeader
              title={t("snapshot.detail.title")}
              trailing={
                formatShortDate(selectedSnapshot?.date ?? null) ? (
                  <View
                    style={[
                      styles.lastUpdateBadge,
                      {
                        backgroundColor: `${tokens.colors.green}18`,
                        borderColor: `${tokens.colors.green}55`,
                      },
                    ]}
                  >
                    <Text style={[styles.lastUpdateText, { color: tokens.colors.green }]}>
                      {t("snapshot.detail.lastUpdate", { defaultValue: "Last update" })}{" "}
                      {formatShortDate(selectedSnapshot?.date ?? null)}
                    </Text>
                  </View>
                ) : null
              }
            />
            <View style={{ gap: 8 }}>
              {lines.length === 0 && (
                <Text style={{ color: tokens.colors.muted }}>
                  {t("snapshot.detail.emptyLines")}
                </Text>
              )}
              {sortedLines.map((line) => {
                const walletLabel =
                  line.wallet_type === "INVEST" && line.wallet_tag
                    ? `${line.wallet_tag} • ${line.wallet_name ?? t("wallets.snapshot.unknown")}`
                    : line.wallet_name ?? t("wallets.snapshot.unknown");
                const wallet = walletById.get(line.wallet_id);
                const currencySuffix = wallet ? currencySymbol(wallet.currency) : "";
                const walletIcon = wallet?.type === "INVEST" ? "chart-line" : "wallet-outline";
                return (
                  <Pressable
                    key={line.id}
                    style={styles.accountRow}
                    hitSlop={10}
                    onPress={() => {
                      navigation.navigate("Wallet", { walletId: line.wallet_id });
                    }}
                  >
                    <View
                      style={[
                        styles.accountIconBadge,
                        { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
                      ]}
                    >
                      <MaterialCommunityIcons name={walletIcon} size={16} color={tokens.colors.muted} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "700" }} numberOfLines={1} ellipsizeMode="tail">
                        {walletLabel}
                      </Text>
                    </View>
                    <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>
                      {formatAmount(line.amount)}
                      {currencySuffix ? ` ${currencySuffix}` : ""}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={tokens.colors.muted} />
                  </Pressable>
                );
              })}
            </View>
          </GlassCardContainer>
        )}

        {lines.length > 0 && (
          <GlassCardContainer contentStyle={{ gap: 10 }}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{t("snapshot.summary.title")}</Text>
            <View style={styles.kpiRow}>
              <View style={[styles.kpiChip, { borderColor: `${tokens.colors.income}66`, backgroundColor: `${tokens.colors.accent}22` }]}>
                <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("snapshot.totals.liquidity")}</Text>
                <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatAmount(totals.liquidity)}{totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}</Text>
              </View>
              {showInvestments && (
                <View style={[styles.kpiChip, { borderColor: `${tokens.colors.accent}66`, backgroundColor: `${tokens.colors.accent}22` }]}>
                  <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("snapshot.totals.investments")}</Text>
                  <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatAmount(totals.investments)}{totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}</Text>
                </View>
              )}
              <View style={[styles.kpiChip, { borderColor: `${tokens.colors.green}66`, backgroundColor: `${tokens.colors.green}22` }]}>
                <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("snapshot.totals.netWorth")}</Text>
                <Text style={[styles.kpiValue, { color: tokens.colors.green }]}>{formatAmount(totals.netWorth)}{totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}</Text>
              </View>
            </View>
          </GlassCardContainer>
        )}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  form: {
    gap: 12,
  },
  headerRow: {
    // unused after header simplification
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  },
  actionsColumn: {
    gap: 12,
    marginTop: 12,
  },
  actionSlot: {
    flex: 1,
  },
  fullWidthButton: {
    alignSelf: "stretch",
    flex: 1,
  },
  fullWidthButtonContent: {
    width: "100%",
  },
  list: {
    gap: 8,
  },
  totals: {
    marginTop: 8,
    gap: 4,
  },
  monthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  monthSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  monthLabel: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSub: {
    fontSize: 12,
  },
  lineInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  editButtonRow: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  accountIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  kpiChip: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  lastUpdateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  lastUpdateText: {
    fontSize: 12,
    fontWeight: "700",
  },
  kpiLabel: {
    fontSize: 12,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  recentRow: {
    gap: 10,
    paddingHorizontal: 4,
  },
});
