import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView } from "react-native";
import { Button, Card, List, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import GlassCard from "@/ui/components/GlassCard";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { listIncomeEntries, createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, setExpenseCategoryActive } from "@/repositories/expenseCategoriesRepo";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";

type Mode = "income" | "expense";

type FormState = {
  id: number | null;
  name: string;
  amount: string;
  startDate: string;
  categoryId: string;
  active: boolean;
  recurring: boolean;
  frequency: RecurrenceFrequency;
  interval: string;
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
  interval: "1",
};

export default function EntriesScreen(): JSX.Element {
  const route = useRoute();
  const routeMode = (route.params as { mode?: Mode } | undefined)?.mode;
  const [mode, setMode] = useState<Mode>(routeMode ?? "income");
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<number, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [income, expense, cats] = await Promise.all([
      listIncomeEntries(),
      listExpenseEntries(),
      listExpenseCategories(),
    ]);
    setIncomeEntries(income);
    setExpenseEntries(expense);
    setCategories(cats);
    const edits: Record<number, string> = {};
    cats.forEach((cat) => {
      edits[cat.id] = cat.name;
    });
    setCategoryEdits(edits);
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
    if (routeMode) {
      setMode(routeMode);
    }
  }, [routeMode]);

  const applyEntryToForm = (entry: IncomeEntry | ExpenseEntry, entryMode: Mode) => {
    setMode(entryMode);
    setForm({
      id: entry.id,
      name: entry.name,
      amount: String(entry.amount),
      startDate: entry.start_date,
      categoryId: "expense_category_id" in entry ? String(entry.expense_category_id) : "",
      active: entry.active === 1,
      recurring: entry.recurrence_frequency !== null && entry.one_shot === 0,
      frequency: entry.recurrence_frequency ?? "MONTHLY",
      interval: entry.recurrence_interval?.toString() ?? "1",
    });
  };

  const saveEntry = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Nome obbligatorio.");
      return;
    }
    if (!isIsoDate(form.startDate)) {
      setError("Data non valida (YYYY-MM-DD).");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount)) {
      setError("Importo non valido.");
      return;
    }
    const recurring = form.recurring;
    const frequency = recurring ? form.frequency : null;
    const interval = recurring ? Number(form.interval) || 1 : null;
    const oneShot = recurring ? 0 : 1;
    const active = form.active ? 1 : 0;

    if (mode === "income") {
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
      if (form.id) {
        await updateIncomeEntry(form.id, payload);
      } else {
        await createIncomeEntry(payload);
      }
    } else {
      const categoryId = Number(form.categoryId);
      if (!Number.isFinite(categoryId)) {
        setError("Categoria obbligatoria.");
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
      if (form.id) {
        await updateExpenseEntry(form.id, payload);
      } else {
        await createExpenseEntry(payload);
      }
    }

    setForm(emptyForm);
    await load();
  };

  const removeEntry = async () => {
    if (!form.id) return;
    if (mode === "income") {
      await deleteIncomeEntry(form.id);
    } else {
      await deleteExpenseEntry(form.id);
    }
    setForm(emptyForm);
    await load();
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await createExpenseCategory(newCategory.trim());
    setNewCategory("");
    await load();
  };

  const saveCategory = async (id: number) => {
    const name = categoryEdits[id]?.trim();
    if (!name) return;
    await updateExpenseCategory(id, name);
    await load();
  };

  const removeCategory = async (id: number) => {
    await deleteExpenseCategory(id);
    await load();
  };

  const entries = mode === "income" ? incomeEntries : expenseEntries;

  const activeCategories = useMemo(() => categories.filter((cat) => cat.active === 1), [categories]);

  const toIsoDate = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const datePickerValue = form.startDate && isIsoDate(form.startDate) ? new Date(form.startDate) : new Date();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      alwaysBounceVertical
      bounces
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <GlassCard>
        <Card.Title title="Entrate / Uscite" />
        <Card.Content style={{ gap: 8 }}>
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
            buttons={[
              { value: "income", label: "Entrate" },
              { value: "expense", label: "Uscite" },
            ]}
          />
        </Card.Content>
      </GlassCard>

      <GlassCard>
        <Card.Title title="Aggiungi nuova" />
        <Card.Content style={{ gap: 8 }}>
          <TextInput label="Nome" value={form.name} onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))} />
          <TextInput label="Importo" keyboardType="decimal-pad" value={form.amount} onChangeText={(text) => setForm((prev) => ({ ...prev, amount: text }))} />
          <TextInput
            label="Data"
            value={form.startDate}
            editable={false}
            onPressIn={() => setShowDatePicker(true)}
          />
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
          {mode === "expense" && (
            <GlassCard>
              <Card.Title title="Categoria spesa" />
              <Card.Content style={{ gap: 8 }}>
                {activeCategories.length === 0 && <Text>Nessuna categoria attiva. Aggiungine una qui sotto.</Text>}
                {activeCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    mode={form.categoryId === String(cat.id) ? "contained" : "outlined"}
                    onPress={() => setForm((prev) => ({ ...prev, categoryId: String(cat.id) }))}
                  >
                    {cat.name}
                  </Button>
                ))}
              </Card.Content>
            </GlassCard>
          )}
          <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch value={form.recurring} onValueChange={(value) => setForm((prev) => ({ ...prev, recurring: value }))} />
            <Text>Ricorrente</Text>
          </Card.Content>
          {form.recurring && (
            <>
              <SegmentedButtons
                value={form.frequency}
                onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value as RecurrenceFrequency }))}
                buttons={[
                  { value: "WEEKLY", label: "Weekly" },
                  { value: "MONTHLY", label: "Monthly" },
                  { value: "YEARLY", label: "Yearly" },
                ]}
              />
              <TextInput label="Intervallo" keyboardType="numeric" value={form.interval} onChangeText={(text) => setForm((prev) => ({ ...prev, interval: text }))} />
            </>
          )}
          {error && <Text style={{ color: "crimson" }}>{error}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button onPress={saveEntry}>Salva</Button>
          <Button onPress={() => setForm(emptyForm)}>Reset</Button>
          {form.id && <Button onPress={removeEntry}>Elimina</Button>}
        </Card.Actions>
      </GlassCard>

      {mode === "expense" && (
        <GlassCard>
          <Card.Title title="Categorie spesa" />
          <Card.Content style={{ gap: 8 }}>
            <TextInput
              label="Nuova categoria"
              value={newCategory}
              onChangeText={setNewCategory}
            />
            <Button onPress={addCategory}>Aggiungi</Button>
            {categories.map((cat) => (
              <List.Accordion
                key={cat.id}
                title={categoryEdits[cat.id] ?? cat.name}
                description={cat.active === 1 ? "Attiva" : "Disattiva"}
                left={(props) => <List.Icon {...props} icon="tag" />}
                style={{ marginTop: 8 }}
              >
                <Card.Content style={{ gap: 8 }}>
                  <TextInput
                    label="Nome categoria"
                    value={categoryEdits[cat.id] ?? cat.name}
                    onChangeText={(value) =>
                      setCategoryEdits((prev) => ({
                        ...prev,
                        [cat.id]: value,
                      }))
                    }
                  />
                  <Card.Actions>
                    <Button onPress={() => saveCategory(cat.id)}>Salva</Button>
                    <Button
                      onPress={async () => {
                        await setExpenseCategoryActive(cat.id, cat.active === 1 ? 0 : 1);
                        await load();
                      }}
                    >
                      {cat.active === 1 ? "Disattiva" : "Attiva"}
                    </Button>
                    <Button onPress={() => removeCategory(cat.id)}>Elimina</Button>
                  </Card.Actions>
                </Card.Content>
              </List.Accordion>
            ))}
          </Card.Content>
        </GlassCard>
      )}

      <GlassCard>
        <Card.Title title="Lista" />
        <Card.Content>
          {entries.length === 0 && <Text>Nessuna voce.</Text>}
          {entries.map((entry) => (
            <Button key={`${mode}-${entry.id}`} onPress={() => applyEntryToForm(entry, mode)}>
              {entry.start_date} • {entry.name} • {entry.amount.toFixed(2)}
            </Button>
          ))}
        </Card.Content>
      </GlassCard>
    </ScrollView>
  );
}
