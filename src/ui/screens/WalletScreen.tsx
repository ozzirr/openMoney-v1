import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Snackbar, Text, TextInput } from "react-native-paper";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { createWallet, deleteWallet, listWallets, updateWallet, updateWalletSortOrders, DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  setExpenseCategoryActive,
  deleteExpenseCategory,
} from "@/repositories/expenseCategoriesRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { Wallet, Currency, ExpenseCategory, WalletType } from "@/repositories/types";
import { APP_VARIANT, LIMITS } from "@/config/entitlements";
import { openProStoreLink } from "@/config/storeLinks";
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import AppBackground from "@/ui/components/AppBackground";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onDataReset } from "@/app/dataEvents";
import {
  GlassCardContainer,
  PrimaryPillButton,
  PillChip,
  SmallOutlinePillButton,
  SegmentedControlPill,
} from "@/ui/components/EntriesUI";
import { createStandardTextInputProps } from "@/ui/components/standardInputProps";
import { orderWalletsForUI, type WalletGroupOrder } from "@/domain/walletOrdering";

type CategoryEdit = {
  name: string;
  color: string;
};

type WalletRouteParams = {
  walletId?: number;
  startSetup?: boolean;
  startCategory?: boolean;
};

const presetColors = [
  "#9B7BFF",
  "#5C9DFF",
  "#F6C177",
  "#66D19E",
  "#C084FC",
  "#FF8FAB",
  "#6EE7B7",
  "#94A3B8",
  "#F97316",
  "#22D3EE",
];

function nextPresetColor(current: string): string {
  const index = presetColors.indexOf(current);
  if (index === -1) return presetColors[0];
  return presetColors[(index + 1) % presetColors.length];
}

type AccordionItemProps = {
  title: string;
  subtitle?: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  color?: string;
  children: React.ReactNode;
};

const AccordionItem = ({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
  color,
  children,
}: AccordionItemProps) => {
  const { tokens, isDark } = useDashboardTheme();
  return (
    <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
      <PressScale onPress={onToggle} style={[styles.walletRow, { paddingVertical: 6 }]}>
        <View
          style={[
            styles.walletIconBadge,
            {
              borderColor: tokens.colors.glassBorder,
              backgroundColor: color ?? tokens.colors.glassBg,
            },
          ]}
        >
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={isDark ? tokens.colors.background : "#FFFFFF"}
            />
        </View>
        <View style={styles.walletText}>
          <Text style={[styles.walletTitle, { color: tokens.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.walletSubtitle, { color: tokens.colors.muted }]} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={tokens.colors.muted}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </PressScale>
      {expanded ? (
        <View
          style={[
            styles.accordionBody,
            { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder },
          ]}
        >
          {children}
        </View>
      ) : null}
    </GlassCardContainer>
  );
};

export default function WalletScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const routeParams = route.params as WalletRouteParams | undefined;
  const targetWalletId = routeParams?.walletId;
  const startSetup = routeParams?.startSetup;
  const startCategory = routeParams?.startCategory;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { t } = useTranslation();
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderLists, setReorderLists] = useState<WalletGroupOrder>({
    LIQUIDITY: [],
    INVEST: [],
  });
  const { showInvestments } = useSettings();
  const [walletEdits, setWalletEdits] = useState<
    Record<number, { name: string; tag: string; currency: Currency; color: string }>
  >({});
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<number, CategoryEdit>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(presetColors[0]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);
  const [tab, setTab] = useState<"LIQUIDITY" | "INVEST">("LIQUIDITY");
  const [newWalletDraft, setNewWalletDraft] = useState<{
    name: string;
    tag: string;
    currency: Currency;
    color: string;
  }>({
    name: "",
    tag: "",
    currency: "EUR",
    color: DEFAULT_WALLET_COLOR,
  });
  const [showAddWallet, setShowAddWallet] = useState<{ LIQUIDITY: boolean; INVEST: boolean }>({
    LIQUIDITY: false,
    INVEST: false,
  });
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [storeErrorVisible, setStoreErrorVisible] = useState(false);
  const addWalletPulse = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const categoriesOffsetY = useRef(0);
  useEffect(() => {
    if (!showInvestments) {
      setTab("LIQUIDITY");
      setShowAddWallet((prev) => ({ ...prev, INVEST: false }));
    }
  }, [showInvestments]);

  useEffect(() => {
    if (!targetWalletId) return;
    const target = wallets.find((wallet) => wallet.id === targetWalletId);
    if (!target) return;
    setTab(target.type);
    setExpandedWalletId(target.id);
    navigation.setParams({ walletId: undefined });
  }, [navigation, targetWalletId, wallets]);

  useEffect(() => {
    if (!startSetup) return;
    if (wallets.length > 0) return;
    if (showAddWallet.LIQUIDITY) return;
    setTab("LIQUIDITY");
    setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: true }));
  }, [startSetup, wallets.length, showAddWallet.LIQUIDITY]);

  useEffect(() => {
    if (!startCategory) return;
    if (showAddCategory) return;
    setShowAddCategory(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(categoriesOffsetY.current - 16, 0), animated: true });
    });
    navigation.setParams({ startCategory: undefined });
  }, [navigation, showAddCategory, startCategory]);

  const load = useCallback(async () => {
    const [walletList, expenseCats] = await Promise.all([listWallets(), listExpenseCategories()]);
    setWallets(walletList);
    setCategories(expenseCats);
    const edits: Record<number, { name: string; tag: string; currency: Currency; color: string }> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
      };
    });
    setWalletEdits(edits);

    const categoryEditsMap: Record<number, CategoryEdit> = {};
    expenseCats.forEach((cat) => {
      categoryEditsMap[cat.id] = { name: cat.name, color: cat.color };
    });
    setCategoryEdits(categoryEditsMap);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = useCallback(async () => {
    await load();
  }, [load]);

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

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await createExpenseCategory(newCategory.trim(), newCategoryColor);
    setNewCategory("");
    setNewCategoryColor(presetColors[0]);
    await load();
  };

  const persistWalletEdit = useCallback(
    async (walletId: number, updates: Partial<{ name: string; tag: string; currency: Currency; color: string }>) => {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) return;
      const current = walletEdits[walletId] ?? {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
      };
      const merged = { ...current, ...updates };
      setWalletEdits((prev) => ({ ...prev, [walletId]: merged }));
      const trimmedName = merged.name.trim();
      if (!trimmedName) return;
      const trimmedTag = merged.tag?.trim() || null;
      const color = merged.color ?? DEFAULT_WALLET_COLOR;
      setWallets((prev) =>
        prev.map((item) =>
          item.id === walletId
            ? {
                ...item,
                name: trimmedName,
                tag: trimmedTag,
                currency: merged.currency,
                color,
              }
            : item
        )
      );
      try {
        await updateWallet(walletId, trimmedName, wallet.type, merged.currency, trimmedTag, wallet.active, color);
      } catch (error) {
        console.warn("Failed to auto-save wallet", error);
      }
    },
    [walletEdits, wallets]
  );

  const persistCategoryEdit = useCallback(
    async (categoryId: number, updates: Partial<CategoryEdit>) => {
      const category = categories.find((cat) => cat.id === categoryId);
      if (!category) return;
      const current = categoryEdits[categoryId] ?? { name: category.name, color: category.color };
      const merged = { ...current, ...updates };
      setCategoryEdits((prev) => ({ ...prev, [categoryId]: merged }));
      const trimmedName = merged.name.trim();
      if (!trimmedName) return;
      const color = merged.color ?? DEFAULT_WALLET_COLOR;
      setCategories((prev) =>
        prev.map((item) =>
          item.id === categoryId
            ? {
                ...item,
                name: trimmedName,
                color,
              }
            : item
        )
      );
      try {
        await updateExpenseCategory(categoryId, trimmedName, color);
      } catch (error) {
        console.warn("Failed to auto-save category", error);
      }
    },
    [categories, categoryEdits]
  );

  const removeCategory = async (id: number) => {
    await deleteExpenseCategory(id);
    await load();
  };

  const orderedWallets = useMemo(() => orderWalletsForUI(wallets), [wallets]);
  const liquidityWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "LIQUIDITY"),
    [orderedWallets]
  );
  const investmentWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "INVEST"),
    [orderedWallets]
  );
  const noWallets = wallets.length === 0;
  const shouldPulseAdd = noWallets && !showAddWallet.LIQUIDITY && tab === "LIQUIDITY";
  const getWalletDisplayColor = (wallet: Wallet) => walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (shouldPulseAdd) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(addWalletPulse, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(addWalletPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      addWalletPulse.stopAnimation();
      addWalletPulse.setValue(1);
    }
    return () => {
      animation?.stop();
    };
  }, [addWalletPulse, shouldPulseAdd]);

  const getWalletCount = (type: "LIQUIDITY" | "INVEST") =>
    type === "LIQUIDITY" ? liquidityWallets.length : investmentWallets.length;
  const getLimitForType = (type: "LIQUIDITY" | "INVEST") =>
    type === "LIQUIDITY" ? LIMITS.liquidityWallets : LIMITS.investmentWallets;
  const hasReachedLimit = (type: "LIQUIDITY" | "INVEST") => {
    const limit = getLimitForType(type);
    if (limit === null) return false;
    return getWalletCount(type) >= limit;
  };
  const canCreateWallet = (type: "LIQUIDITY" | "INVEST") => !hasReachedLimit(type);
  const canReorder = wallets.length > 1;

  useEffect(() => {
    if (!canReorder && reorderMode) {
      setReorderMode(false);
    }
  }, [canReorder, reorderMode]);

  useEffect(() => {
    if (!reorderMode) return;
    setReorderLists({
      LIQUIDITY: [...liquidityWallets],
      INVEST: [...investmentWallets],
    });
  }, [reorderMode, liquidityWallets, investmentWallets]);

  const handleReorderEnd = useCallback(
    async (type: "LIQUIDITY" | "INVEST", data: Wallet[]) => {
      setReorderLists((prev) => ({ ...prev, [type]: data }));
      const updates = data.map((wallet, index) => ({
        id: wallet.id,
        sortOrder: index,
      }));
      try {
        await updateWalletSortOrders(updates);
        await load();
      } catch (error) {
        console.warn("Failed to update wallet order", error);
      }
    },
    [load]
  );

  const bringToTop = useCallback(
    async (type: WalletType, walletId: number) => {
      const list = reorderLists[type];
      const index = list.findIndex((wallet) => wallet.id === walletId);
      if (index <= 0) return;
      const item = list[index];
      const newList = [item, ...list.slice(0, index), ...list.slice(index + 1)];
      const orderUpdates = newList.map((wallet, idx) => ({ id: wallet.id, sortOrder: idx }));
      setWallets((prev) =>
        prev.map((wallet) => {
          const update = orderUpdates.find((update) => update.id === wallet.id);
          return update ? { ...wallet, sortOrder: update.sortOrder } : wallet;
        })
      );
      setReorderLists((prev) => ({ ...prev, [type]: newList }));
      await handleReorderEnd(type, newList);
    },
    [handleReorderEnd, reorderLists]
  );

  const ReorderableRow = ({ wallet, type, atTop }: { wallet: Wallet; type: WalletType; atTop: boolean }) => (
    <View
      style={[
        styles.reorderRow,
        {
          borderColor: tokens.colors.glassBorder,
          backgroundColor: tokens.colors.glassBg,
        },
      ]}
    >
      <View style={styles.reorderRowContent}>
        <View style={styles.reorderRowLabelRow}>
          <View
            style={[
              styles.walletColorDot,
              { backgroundColor: wallet.color ?? DEFAULT_WALLET_COLOR },
            ]}
          />
          <Text style={[styles.reorderRowLabel, { color: tokens.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {wallet.name}
          </Text>
        </View>
        <Text style={[styles.reorderRowMeta, { color: tokens.colors.muted }]}>{wallet.currency}</Text>
      </View>
      <Pressable
        onPress={() => {
          if (!atTop) {
            void bringToTop(type, wallet.id);
          }
        }}
        disabled={atTop}
        style={({ pressed }) => [
          styles.reorderAction,
          { opacity: atTop ? 0.4 : pressed ? 0.7 : 1 },
        ]}
      >
        <MaterialCommunityIcons name="arrow-up" size={18} color={tokens.colors.accent} />
      </Pressable>
    </View>
  );

  const addWallet = async (type: "LIQUIDITY" | "INVEST") => {
    if (!newWalletDraft.name.trim()) return;
    if (APP_VARIANT === "free" && !canCreateWallet(type)) {
      setLimitModalVisible(true);
      return;
    }
    const wasEmpty = wallets.length === 0;
    await createWallet(
      newWalletDraft.name.trim(),
      type,
      newWalletDraft.currency,
      type === "INVEST" ? newWalletDraft.tag.trim() || null : null,
      1,
      newWalletDraft.color
    );
    setNewWalletDraft({ name: "", tag: "", currency: "EUR", color: DEFAULT_WALLET_COLOR });
    setShowAddWallet((prev) => ({ ...prev, [type]: false }));
    await load();
    if (startSetup && wasEmpty && type === "LIQUIDITY") {
      navigation.navigate("Snapshot", { openNew: true });
      navigation.setParams({ startSetup: undefined });
    }
  };

  const handleRequestAddWallet = (type: "LIQUIDITY" | "INVEST") => {
    if (APP_VARIANT === "pro") {
      setShowAddWallet((prev) => ({ ...prev, [type]: true }));
      return;
    }

    if (!canCreateWallet(type)) {
      setLimitModalVisible(true);
      return;
    }

    setShowAddWallet((prev) => ({ ...prev, [type]: true }));
  };

  const handleOpenProStore = useCallback(async () => {
    try {
      await openProStoreLink();
      setLimitModalVisible(false);
    } catch {
      setStoreErrorVisible(true);
    }
  }, []);

  const inputProps = createStandardTextInputProps(tokens);

  return (
    <AppBackground>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        alwaysBounceVertical
        bounces
      >
        <GlassCardContainer>
          <View style={styles.sectionContent}>
            {showInvestments && (
              <SegmentedControlPill
                value={tab}
                onChange={(value) => setTab(value as "LIQUIDITY" | "INVEST")}
                options={[
                  { value: "LIQUIDITY", label: t("wallets.list.tabLiquidity"), tint: `${tokens.colors.income}33` },
                  { value: "INVEST", label: t("wallets.list.tabInvest"), tint: `${tokens.colors.accent}33` },
                ]}
              />
            )}
            {canReorder && (
              <View style={styles.orderToggleRow}>
                <Text style={[styles.orderToggleLabel, { color: tokens.colors.text }]}>
                  {t("wallets.list.reorderTitle")}
                </Text>
                <SmallOutlinePillButton
                  label={reorderMode ? t("wallets.list.doneOrder") : t("wallets.list.editOrder")}
                  onPress={() => setReorderMode((prev) => !prev)}
                  color={tokens.colors.accent}
                />
              </View>
            )}
            {reorderMode && canReorder && (
              <View style={styles.orderPanel}>
                <Text style={[styles.orderHint, { color: tokens.colors.muted }]}>{t("wallets.list.reorderHint")}</Text>
                <View style={styles.reorderGroups}>
                  <Text style={[styles.reorderGroupTitle, { color: tokens.colors.text }]}>
                    {t("wallets.list.tabLiquidity")}
                  </Text>
                  <View style={styles.reorderList}>
                    {reorderLists.LIQUIDITY.map((wallet, index) => (
                      <ReorderableRow key={wallet.id} wallet={wallet} type="LIQUIDITY" atTop={index === 0} />
                    ))}
                  </View>
                  {showInvestments && (
                    <>
                      <Text style={[styles.reorderGroupTitle, { color: tokens.colors.text }]}>
                        {t("wallets.list.tabInvest")}
                      </Text>
                      <View style={styles.reorderList}>
                        {reorderLists.INVEST.map((wallet, index) => (
                          <ReorderableRow key={wallet.id} wallet={wallet} type="INVEST" atTop={index === 0} />
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {tab === "LIQUIDITY" && (
              <>
                {!showAddWallet.LIQUIDITY && (
                  <Animated.View style={shouldPulseAdd ? { transform: [{ scale: addWalletPulse }] } : undefined}>
                    <PrimaryPillButton
                      label={t("wallets.list.addWallet")}
                      onPress={() => handleRequestAddWallet("LIQUIDITY")}
                      color={tokens.colors.accent}
                    />
                  </Animated.View>
                )}
                {showAddWallet.LIQUIDITY && (
                  <GlassCardContainer>
                    <SectionHeader title={t("wallets.list.newLiquidityTitle")} />
                    <View style={styles.sectionContent}>
                      <View style={[styles.colorLine]}>
                        <TextInput
                          label={t("wallets.form.name")}
                          value={newWalletDraft.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                        />
                        <PressScale
                          onPress={() =>
                            setNewWalletDraft((prev) => ({ ...prev, color: nextPresetColor(prev.color) }))
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: newWalletDraft.color,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        />
                      </View>
                      <SegmentedControlPill
                        value={newWalletDraft.currency}
                        onChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                    </View>
                    <View style={styles.actionsRow}>
                      <PrimaryPillButton label={t("common.add")} onPress={() => addWallet("LIQUIDITY")} color={tokens.colors.accent} />
                      <SmallOutlinePillButton label={t("common.cancel")} onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }))} color={tokens.colors.text} />
                    </View>
                  </GlassCardContainer>
                )}

                {liquidityWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${wallet.tag ? ` · ${wallet.tag}` : ""}`;
                  const editColor = walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                      color={getWalletDisplayColor(wallet)}
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                        <View style={styles.colorLine}>
                        <TextInput
                          label={t("wallets.form.name")}
                          value={walletEdits[wallet.id]?.name ?? wallet.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => {
                            void persistWalletEdit(wallet.id, { name: value });
                          }}
                        />
                          <PressScale
                            onPress={() =>
                              void persistWalletEdit(wallet.id, {
                                color: nextPresetColor(editColor),
                              })
                            }
                            style={[
                              styles.colorSwatch,
                              {
                                backgroundColor: editColor,
                                borderColor: tokens.colors.glassBorder,
                              },
                            ]}
                          />
                        </View>
                        <SegmentedControlPill
                          value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                          onChange={(value) =>
                            void persistWalletEdit(wallet.id, { currency: value as Currency })
                          }
                          options={[
                            { value: "EUR", label: "EUR" },
                            { value: "USD", label: "USD" },
                            { value: "GBP", label: "GBP" },
                          ]}
                        />
                        <View style={styles.actionsRow}>
                          <SmallOutlinePillButton
                            label={t("common.delete")}
                            onPress={async () => {
                              await deleteWallet(wallet.id);
                              await load();
                              setExpandedWalletId(null);
                            }}
                            color={tokens.colors.red}
                          />
                        </View>
                      </View>
                    </AccordionItem>
                  );
                })}
              </>
            )}

            {showInvestments && tab === "INVEST" && (
              <>
                {!showAddWallet.INVEST && (
                  <PrimaryPillButton
                    label={t("wallets.list.addWallet")}
                    onPress={() => handleRequestAddWallet("INVEST")}
                    color={tokens.colors.accent}
                  />
                )}
                {showAddWallet.INVEST && (
                  <GlassCardContainer>
                    <SectionHeader title={t("wallets.list.newInvestTitle")} />
                    <View style={styles.sectionContent}>
                      <View style={[styles.colorLine]}>
                        <TextInput
                          label={t("wallets.form.brokerLabel")}
                          value={newWalletDraft.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                        />
                        <PressScale
                          onPress={() =>
                            setNewWalletDraft((prev) => ({ ...prev, color: nextPresetColor(prev.color) }))
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: newWalletDraft.color,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        />
                      </View>
                      <TextInput
                        label={t("wallets.form.investmentTypeLabel")}
                        value={newWalletDraft.tag}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, tag: value }))}
                      />
                      <SegmentedControlPill
                        value={newWalletDraft.currency}
                        onChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                    </View>
                      <View style={styles.actionsRow}>
                        <PrimaryPillButton label={t("common.add")} onPress={() => addWallet("INVEST")} color={tokens.colors.accent} />
                        <SmallOutlinePillButton label={t("common.cancel")} onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: false }))} color={tokens.colors.text} />
                    </View>
                  </GlassCardContainer>
                )}

                {investmentWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    walletEdits[wallet.id]?.tag || wallet.tag ? ` · ${walletEdits[wallet.id]?.tag ?? wallet.tag}` : ""
                  }`;
                  const editColor = walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                      color={getWalletDisplayColor(wallet)}
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                      <View style={styles.colorLine}>
                        <TextInput
                          label={t("wallets.form.brokerLabel")}
                          value={walletEdits[wallet.id]?.name ?? wallet.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => {
                            void persistWalletEdit(wallet.id, { name: value });
                          }}
                        />
                        <PressScale
                          onPress={() =>
                            void persistWalletEdit(wallet.id, {
                              color: nextPresetColor(editColor),
                            })
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: editColor,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        />
                      </View>
                      <TextInput
                        label={t("wallets.form.investmentTypeLabel")}
                        value={walletEdits[wallet.id]?.tag ?? wallet.tag ?? ""}
                        {...inputProps}
                        onChangeText={(value) =>
                          void persistWalletEdit(wallet.id, { tag: value })
                        }
                      />
                      <SegmentedControlPill
                        value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                        onChange={(value) =>
                          void persistWalletEdit(wallet.id, { currency: value as Currency })
                        }
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                        <View style={styles.actionsRow}>
                          <SmallOutlinePillButton
                            label={t("common.delete")}
                            onPress={async () => {
                              await deleteWallet(wallet.id);
                              await load();
                              setExpandedWalletId(null);
                            }}
                            color={tokens.colors.red}
                          />
                        </View>
                      </View>
                    </AccordionItem>
                  );
                })}
              </>
            )}
          </View>
        </GlassCardContainer>

        <View
          onLayout={(event) => {
            categoriesOffsetY.current = event.nativeEvent.layout.y;
          }}
        >
          <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
            <SectionHeader title={t("wallets.list.categoriesTitle")} />
            {!showAddCategory && (
              <PrimaryPillButton
                label={t("wallets.list.addCategory", { defaultValue: t("common.add") })}
                onPress={() => setShowAddCategory(true)}
                color={tokens.colors.accent}
              />
            )}
            {showAddCategory && (
              <View style={{ gap: 10 }}>
                <View style={[styles.colorLine, { paddingVertical: 2 }]}>
                  <TextInput
                    label={t("wallets.list.newCategoryLabel")}
                    value={newCategory}
                    {...inputProps}
                    style={[styles.categoryNameInput, { backgroundColor: tokens.colors.glassBg }]}
                    onChangeText={setNewCategory}
                  />
                  <PressScale
                    onPress={() => setNewCategoryColor((prev) => nextPresetColor(prev))}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: newCategoryColor, borderColor: tokens.colors.glassBorder },
                    ]}
                  />
                </View>
                <View style={styles.actionsRow}>
                  <PrimaryPillButton label={t("common.add")} onPress={addCategory} color={tokens.colors.accent} />
                  <SmallOutlinePillButton
                    label={t("common.cancel")}
                    onPress={() => {
                      setShowAddCategory(false);
                      setNewCategory("");
                      setNewCategoryColor(presetColors[0]);
                    }}
                    color={tokens.colors.text}
                  />
                </View>
              </View>
            )}
            {categories.length === 0 ? (
              <Text style={{ color: tokens.colors.muted }}>{t("wallets.list.noCategories")}</Text>
            ) : null}
            <View style={{ gap: 10 }}>
              {categories.map((cat) => {
                const isActive = cat.active === 1;
                const subtitle = isActive
                  ? t("wallets.list.categoryActive")
                  : t("wallets.list.categoryInactive");
                return (
                    <AccordionItem
                      key={cat.id}
                      title={categoryEdits[cat.id]?.name ?? cat.name}
                      subtitle={subtitle}
                      icon="tag"
                      expanded={expandedCategoryId === cat.id}
                      onToggle={() => setExpandedCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                      color={categoryEdits[cat.id]?.color ?? cat.color}
                    >
                    <View style={[styles.sectionContent, styles.accordionInner]}>
                      <View style={[styles.colorLine, { paddingVertical: 0 }]}>
                        <TextInput
                          label="Nome categoria"
                          value={categoryEdits[cat.id]?.name ?? cat.name}
                          {...inputProps}
                          style={[styles.categoryNameInput, { backgroundColor: tokens.colors.glassBg }]}
                          onChangeText={(value) =>
                            void persistCategoryEdit(cat.id, { name: value })
                          }
                        />
                        <PressScale
                          onPress={() => {
                            const currentColor = categoryEdits[cat.id]?.color ?? cat.color;
                            void persistCategoryEdit(cat.id, { color: nextPresetColor(currentColor) });
                          }}
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: categoryEdits[cat.id]?.color ?? cat.color,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.actionsRow}>
                        <SmallOutlinePillButton
                          label={
                            isActive
                              ? t("wallets.list.categoryDeactivate")
                              : t("wallets.list.categoryActivate")
                          }
                          onPress={async () => {
                            await setExpenseCategoryActive(cat.id, isActive ? 0 : 1);
                            await load();
                          }}
                          color={isActive ? tokens.colors.red : tokens.colors.accent}
                        />
                        <SmallOutlinePillButton
                          label={t("common.delete")}
                          onPress={async () => {
                            await removeCategory(cat.id);
                            setExpandedCategoryId(null);
                          }}
                          color={tokens.colors.red}
                        />
                      </View>
                    </View>
                  </AccordionItem>
                );
              })}
            </View>
          </GlassCardContainer>
        </View>

        <LimitReachedModal
          visible={limitModalVisible}
          onClose={() => setLimitModalVisible(false)}
          onUpgrade={handleOpenProStore}
        />

        <Snackbar visible={storeErrorVisible} onDismiss={() => setStoreErrorVisible(false)} duration={4000}>
          {t("wallets.actions.storeError")}
        </Snackbar>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionContent: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryNameInput: {
    flex: 1,
    minWidth: 160,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  walletNameInput: {
    flex: 1,
    minWidth: 0,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  walletText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  walletSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  accordionBody: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  accordionInner: {
    gap: 12,
  },
  orderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  orderPanel: {
    gap: 12,
    paddingTop: 4,
  },
  orderHint: {
    fontSize: 12,
  },
  reorderGroups: {
    gap: 12,
  },
  reorderGroupTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  reorderList: {
    paddingVertical: 4,
  },
  reorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reorderRowActive: {
    opacity: 0.85,
  },
  reorderRowContent: {
    flex: 1,
    flexDirection: "column",
  },
  walletColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reorderRowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reorderRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reorderRowMeta: {
    fontSize: 12,
  },
  reorderAction: {
    padding: 6,
    borderRadius: 6,
  },
});
