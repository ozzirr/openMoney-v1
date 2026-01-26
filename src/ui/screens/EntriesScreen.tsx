import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { listIncomeEntries, createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import { formatEUR } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import AppBackground from "@/ui/components/AppBackground";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  DatePill,
  FrequencyPillGroup,
  GlassCardContainer,
  PrimaryPillButton,
  SegmentedControlPill,
  SmallOutlinePillButton,
} from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type EntryType = "income" | "expense";
type FormMode = "create" | "edit";
type CategoryFilter = "all" | number;

type EntriesRouteParams = {
  entryType?: EntryType;
  formMode?: FormMode;
  entryId?: number;
};

type FormState = {
  id: number | null;
  name: string;
  amount: string;
  startDate: string;
  categoryId: string;
  active: boolean;
  recurring: boolean;
  frequency: RecurrenceFrequency;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  amount: "",
  startDate: todayIso(),
  categoryId: "",
  active: true,
  recurring: false,
  frequency: "MONTHLY",
};

export default function EntriesScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef<ScrollView | null>(null);
  const routeParams = (route.params ?? {}) as EntriesRouteParams;
  const [entryType, setEntryType] = useState<EntryType>(routeParams.entryType ?? "income");
  const [formMode, setFormMode] = useState<FormMode>(routeParams.formMode ?? "create");
  const [editingId, setEditingId] = useState<number | null>(
    routeParams.formMode === "edit" ? routeParams.entryId ?? null : null
  );
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(routeParams.formMode === "edit");

  const load = useCallback(async () => {
    const [income, expense, cats] = await Promise.all([
      listIncomeEntries(),
      listExpenseEntries(),
      listExpenseCategories(),
    ]);
    setIncomeEntries(income);
    setExpenseEntries(expense);
    setCategories(cats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (routeParams.entryType) {
      setEntryType(routeParams.entryType);
    }
  }, [routeParams.entryType]);

  useEffect(() => {
    const nextFormMode = routeParams.formMode;
    if (nextFormMode === "edit" && typeof routeParams.entryId === "number") {
      const targetType = routeParams.entryType ?? entryType;
      const entriesList = targetType === "income" ? incomeEntries : expenseEntries;
      const found = entriesList.find((entry) => entry.id === routeParams.entryId);
      if (found) {
        applyEntryToForm(found, targetType);
        setShowNewEntry(true);
      }
      return;
    }
    if (nextFormMode === "create") {
      setFormMode("create");
      setEditingId(null);
      setForm(emptyForm);
      setShowNewEntry(true);
    }
  }, [routeParams.formMode, routeParams.entryId, routeParams.entryType, incomeEntries, expenseEntries]);

  useEffect(() => {
    // reset category filter when switching to income
    if (entryType === "income") {
      setCategoryFilter("all");
    }
  }, [entryType]);

  const applyEntryToForm = (entry: IncomeEntry | ExpenseEntry, entryMode: EntryType) => {
    setEntryType(entryMode);
    setForm({
      id: entry.id,
      name: entry.name,
      amount: String(entry.amount),
      startDate: entry.start_date,
      categoryId: "expense_category_id" in entry ? String(entry.expense_category_id) : "",
      active: entry.active === 1,
      recurring: entry.recurrence_frequency !== null && entry.one_shot === 0,
      frequency: entry.recurrence_frequency ?? "MONTHLY",
    });
    setFormMode("edit");
    setEditingId(entry.id);
  };

  const resetToCreateMode = () => {
    setForm(emptyForm);
    setFormMode("create");
    setEditingId(null);
    (navigation as any).setParams({ formMode: "create", entryId: undefined, entryType });
  };

  const toggleNewEntryVisibility = () => {
    setShowNewEntry((prev) => {
      const next = !prev;
      if (next) {
        resetToCreateMode();
      }
      return next;
    });
  };

  const saveEntry = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError(t("entries.validation.nameRequired"));
      return;
    }
    if (!isIsoDate(form.startDate)) {
      setError(t("entries.validation.invalidDate"));
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount)) {
      setError(t("entries.validation.amountInvalid"));
      return;
    }
    const recurring = form.recurring;
    const frequency = recurring ? form.frequency : null;
    const interval = recurring ? 1 : null;
    const oneShot = recurring ? 0 : 1;
    const active = form.active ? 1 : 0;

    if (formMode === "create" && form.id) {
      setError(t("entries.validation.removeIdBeforeCreate"));
      return;
    }
    if (formMode === "edit" && !form.id) {
      setError(t("entries.validation.noEntryForEdit"));
      return;
    }

    if (entryType === "income") {
      const payload: Omit<IncomeEntry, "id"> = {
        name: form.name.trim(),
        amount,
        start_date: form.startDate,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
      };
      if (formMode === "edit") {
        await updateIncomeEntry(form.id!, payload);
      } else {
        await createIncomeEntry(payload);
      }
    } else {
      const categoryId = Number(form.categoryId);
      if (!Number.isFinite(categoryId)) {
        setError(t("entries.validation.categoryRequired"));
        return;
      }
      const payload: Omit<ExpenseEntry, "id"> = {
        name: form.name.trim(),
        amount,
        start_date: form.startDate,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
        expense_category_id: categoryId,
      };
      if (formMode === "edit") {
        await updateExpenseEntry(form.id!, payload);
      } else {
        await createExpenseEntry(payload);
      }
    }

    resetToCreateMode();
    setShowNewEntry(true);
    await load();
  };

  const removeEntry = async () => {
    if (formMode !== "edit" || !form.id) return;
    if (entryType === "income") {
      await deleteIncomeEntry(form.id);
    } else {
      await deleteExpenseEntry(form.id);
    }
    resetToCreateMode();
    setShowNewEntry(true);
    await load();
  };

  const entries = entryType === "income" ? incomeEntries : expenseEntries;

  const activeCategories = useMemo(() => categories.filter((cat) => cat.active === 1), [categories]);
  const categoryById = useMemo(() => {
    const map = new Map<number, ExpenseCategory>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const toIsoDate = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const datePickerValue = form.startDate && isIsoDate(form.startDate) ? new Date(form.startDate) : new Date();

  const formatIsoToDMY = (iso: string) => {
    if (!isIsoDate(iso)) return iso;
    const date = new Date(iso);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  const filteredEntries = useMemo(() => {
    if (entryType === "income") return entries;
    return entries.filter((entry) => {
      if (categoryFilter === "all") return true;
      return entry.expense_category_id === categoryFilter;
    });
  }, [entries, entryType, categoryFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (a.start_date < b.start_date) return -1;
      if (a.start_date > b.start_date) return 1;
      return 0;
    });
  }, [filteredEntries]);

  const entryAccent = entryType === "income" ? tokens.colors.income : tokens.colors.expense;

  const scrollToForm = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const formatDateParts = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return { day: "--", month: "" };
    return {
      day: String(date.getDate()).padStart(2, "0"),
      month: date.toLocaleString("default", { month: "short" }).replace(".", ""),
    };
  };

  return (
    <AppBackground>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.lg, paddingBottom: 140 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <GlassCardContainer contentStyle={{ gap: tokens.spacing.md }}>
          <SegmentedControlPill
            value={entryType}
            onChange={(next) => setEntryType(next as EntryType)}
            options={[
              { value: "income", label: t("entries.list.tabIncome"), tint: `${tokens.colors.income}44` },
              { value: "expense", label: t("entries.list.tabExpense"), tint: `${tokens.colors.expense}33` },
            ]}
          />

          <PrimaryPillButton
            label={t("entries.actions.toggleForm")}
            onPress={() => {
              toggleNewEntryVisibility();
              setTimeout(scrollToForm, 80);
            }}
            color={tokens.colors.purplePrimary}
          />
        </GlassCardContainer>

        {showNewEntry && (
          <GlassCardContainer>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{t("entries.form.newEntryTitle") ?? "New Entry"}</Text>
            <View style={{ gap: 12 }}>
              <TextInput
                label={t("entries.form.name")}
                value={form.name}
                mode="outlined"
                outlineColor={tokens.colors.glassBorder}
                activeOutlineColor={entryAccent}
                textColor={tokens.colors.text}
                style={[styles.glassInput, { backgroundColor: tokens.colors.glassBg }]}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
              />
              <View style={styles.inlineInputs}>
                <TextInput
                  label={t("entries.form.amount")}
                  keyboardType="decimal-pad"
                  value={form.amount}
                  mode="outlined"
                  outlineColor={entryAccent}
                  activeOutlineColor={entryAccent}
                  textColor={tokens.colors.text}
                  style={[styles.glassInput, styles.flex, { backgroundColor: tokens.colors.glassBg }]}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, amount: text }))}
                />
                <TextInput
                  label={t("entries.form.date")}
                  value={formatIsoToDMY(form.startDate)}
                  editable={false}
                  mode="outlined"
                  outlineColor={tokens.colors.glassBorder}
                  activeOutlineColor={tokens.colors.accent}
                  textColor={tokens.colors.text}
                  right={<TextInput.Icon icon="calendar" />}
                  style={[styles.glassInput, styles.flex, { backgroundColor: tokens.colors.glassBg }]}
                  onPressIn={() => setShowDatePicker((prev) => !prev)}
                />
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (selected) {
                      setForm((prev) => ({ ...prev, startDate: toIsoDate(selected) }));
                    }
                    setShowDatePicker(false);
                  }}
                />
              )}

              {entryType === "expense" && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: tokens.colors.muted }}>{t("entries.form.categoryTitle")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {activeCategories.length === 0 ? (
                      <Text style={{ color: tokens.colors.muted }}>{t("entries.empty.noCategoriesActive")}</Text>
                    ) : null}
                    {activeCategories.map((cat) => {
                      const selected = form.categoryId === String(cat.id);
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setForm((prev) => ({ ...prev, categoryId: String(cat.id) }))}
                          style={[
                            styles.categoryChip,
                            {
                              borderColor: selected ? cat.color : tokens.colors.glassBorder,
                              backgroundColor: selected ? `${cat.color}33` : tokens.colors.glassBg,
                            },
                          ]}
                        >
                          <Text style={{ color: selected ? tokens.colors.text : tokens.colors.muted }}>{cat.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={[styles.inlineInputs, { alignItems: "center" }]}>
                <Text style={{ color: tokens.colors.text, flex: 1 }}>{t("entries.form.recurringLabel")}</Text>
                <Switch
                  value={form.recurring}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, recurring: value }))}
                  color={entryAccent}
                />
              </View>

              {form.recurring && (
                <FrequencyPillGroup
                  value={form.frequency}
                  onChange={(next) => setForm((prev) => ({ ...prev, frequency: next as RecurrenceFrequency }))}
                  options={[
                    { value: "WEEKLY", label: t("entries.form.frequency.weekly"), tint: `${entryAccent}33` },
                    { value: "MONTHLY", label: t("entries.form.frequency.monthly"), tint: `${entryAccent}33` },
                    { value: "YEARLY", label: t("entries.form.frequency.yearly"), tint: `${entryAccent}33` },
                  ]}
                />
              )}

              {error && <Text style={{ color: tokens.colors.expense }}>{error}</Text>}

              <View style={styles.actionsRow}>
                <Button mode="contained" buttonColor={entryAccent} textColor="#0B0B0B" onPress={saveEntry} style={styles.flex}>
                  {t("common.save")}
                </Button>
                <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setForm(emptyForm)} style={styles.flex}>
                  {t("common.reset")}
                </Button>
                {form.id && (
                  <Button mode="outlined" textColor={tokens.colors.expense} onPress={removeEntry} style={styles.flex}>
                    {t("common.delete")}
                  </Button>
                )}
              </View>
            </View>
          </GlassCardContainer>
        )}

        {entryType === "expense" && activeCategories.length > 0 ? (
          <GlassCardContainer contentStyle={{ gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{t("entries.list.filterByCategory", { defaultValue: "Filtra per categoria" })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingHorizontal: 4 }]}>
              <Pressable
                onPress={() => setCategoryFilter("all")}
                style={[
                  styles.filterChip,
                  {
                    borderColor: categoryFilter === "all" ? tokens.colors.accent : tokens.colors.glassBorder,
                    backgroundColor: categoryFilter === "all" ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                  },
                ]}
              >
                <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>{t("common.all", { defaultValue: "Tutti" })}</Text>
              </Pressable>
              {activeCategories.map((cat) => {
                const selected = categoryFilter === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryFilter(cat.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? cat.color : tokens.colors.glassBorder,
                        backgroundColor: selected ? `${cat.color}33` : tokens.colors.glassBg,
                      },
                    ]}
                  >
                    <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>{cat.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </GlassCardContainer>
        ) : null}

        <GlassCardContainer contentStyle={{ gap: 8, paddingBottom: 6 }}>
          <FlatList
            data={sortedEntries}
            keyExtractor={(item) => `${entryType}-${item.id}`}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            ListEmptyComponent={
              <Text style={{ color: tokens.colors.muted, paddingVertical: 12 }}>{t("entries.empty.noEntries")}</Text>
            }
            renderItem={({ item }) => {
              const { day, month } = formatDateParts(item.start_date);
              const amountAbs = Math.abs(item.amount);
              const amountText = `${entryType === "income" ? "+" : "-"} ${formatEUR(amountAbs)}`;
              const amountColor = entryType === "income" ? tokens.colors.income : tokens.colors.expense;
              const category =
                "expense_category_id" in item ? categoryById.get(item.expense_category_id) : null;

              return (
                <GlassCardContainer style={styles.listRowCard} contentStyle={styles.listRow}>
                  <DatePill day={day} month={month} />
                  <View style={styles.listContent}>
                    <Text
                      style={[styles.entryName, { color: tokens.colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                    {category ? (
                      <Text
                        style={[styles.entryCategory, { color: tokens.colors.muted }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {category.name}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.listRight}>
                    <Text style={[styles.entryAmount, { color: amountColor }]} numberOfLines={1}>
                      {amountText}
                    </Text>
                    <SmallOutlinePillButton
                      label=""
                      onPress={() => {
                        (navigation as any).setParams({
                          formMode: "edit",
                          entryId: item.id,
                          entryType,
                        });
                        setShowNewEntry(true);
                        scrollToForm();
                      }}
                      color={tokens.colors.accent}
                      icon={<MaterialCommunityIcons name="pencil-outline" size={16} color={tokens.colors.accent} />}
                    />
                  </View>
                </GlassCardContainer>
              );
            }}
          />
        </GlassCardContainer>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  glassInput: {
    borderRadius: 12,
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    flexWrap: "wrap",
  },
  flex: {
    flex: 1,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterRow: {
    gap: 8,
    paddingLeft: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  listRowCard: {
    width: "100%",
    alignSelf: "stretch",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listContent: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    gap: 4,
    minWidth: 0,
    marginLeft: 2,
    marginRight: 6,
  },
  listRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  entryName: {
    fontSize: 16,
    fontWeight: "700",
  },
  entryCategory: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  entryAmount: {
    fontSize: 15,
    fontWeight: "800",
    minWidth: 74,
    textAlign: "right",
  },
});
