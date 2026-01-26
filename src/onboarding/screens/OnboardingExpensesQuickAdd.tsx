import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { useDashboardTheme } from "@/ui/dashboard/theme";
import { OnboardingStackParamList } from "@/onboarding/OnboardingNavigator";
import { useOnboardingDraft, OnboardingExpenseForm } from "@/onboarding/state/OnboardingContext";

const formatToday = () => new Date().toISOString().split("T")[0];

const workdaysMaybeNextMonth = (date: string) => {
  const current = new Date(date);
  current.setMonth(current.getMonth() + 1);
  return current.toISOString().split("T")[0];
};

const expenseIsValid = (expense: OnboardingExpenseForm) => {
  const amount = Number(expense.amount.replace(",", "."));
  return (
    expense.title.trim().length > 0 &&
    !Number.isNaN(amount) &&
    amount > 0 &&
    expense.category.trim().length > 0 &&
    expense.wallet.trim().length > 0 &&
    expense.date.trim().length > 0
  );
};

export default function OnboardingExpensesQuickAdd(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList, "OnboardingExpensesQuickAdd">>();
  const { draft, addExpense, updateExpense } = useOnboardingDraft();

  const validExpenses = useMemo(() => draft.expenses.filter(expenseIsValid), [draft.expenses]);
  const canContinue = validExpenses.length >= 2;

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }
    navigation.navigate("OnboardingDone");
  };

  const renderExpense = (expense: OnboardingExpenseForm, index: number) => (
    <View key={expense.id} style={[styles.expenseCard, { backgroundColor: tokens.colors.surface }]}>
      <View style={styles.expenseHeader}>
        <Text style={[styles.expenseTitle, { color: tokens.colors.text }]}>Spesa {index + 1}</Text>
        <View style={styles.recurringRow}>
          <Text style={[styles.recurringLabel, { color: tokens.colors.text }]}>Ricorrente</Text>
          <Switch
            value={expense.recurring}
            onValueChange={(value) => {
              updateExpense(expense.id, {
                recurring: value,
                nextDate: value ? workdaysMaybeNextMonth(expense.date) : expense.date,
              });
            }}
          />
        </View>
      </View>
      <TextInput
        label="Titolo"
        value={expense.title}
        onChangeText={(text) => updateExpense(expense.id, { title: text })}
        mode="flat"
        style={styles.input}
        textColor={tokens.colors.text}
      />
      <TextInput
        label="Importo"
        value={expense.amount}
        onChangeText={(text) => updateExpense(expense.id, { amount: text })}
        keyboardType="numeric"
        mode="flat"
        style={styles.input}
        textColor={tokens.colors.text}
      />
      <TextInput
        label="Categoria"
        value={expense.category}
        onChangeText={(text) => updateExpense(expense.id, { category: text })}
        mode="flat"
        style={styles.input}
        textColor={tokens.colors.text}
      />
      <TextInput
        label="Wallet"
        value={expense.wallet}
        onChangeText={(text) => updateExpense(expense.id, { wallet: text })}
        mode="flat"
        style={styles.input}
        textColor={tokens.colors.text}
      />
      <TextInput
        label="Data"
        value={expense.date}
        onChangeText={(text) => updateExpense(expense.id, { date: text })}
        mode="flat"
        style={styles.input}
        textColor={tokens.colors.text}
      />
      {expense.recurring && (
        <TextInput
          label="Prossima data"
          value={expense.nextDate}
          onChangeText={(text) => updateExpense(expense.id, { nextDate: text })}
          mode="flat"
          style={styles.input}
          textColor={tokens.colors.text}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>Aggiungi le tue spese</Text>
        <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
          Inserisci almeno due uscite per tenere traccia delle spese iniziali.
        </Text>
        <Text style={[styles.counter, { color: tokens.colors.accent }]}>
          {validExpenses.length}/3 (consigliate)
        </Text>
        {draft.expenses.map(renderExpense)}
        <Button
          mode="outlined"
          textColor={tokens.colors.accent}
          onPress={addExpense}
          style={styles.addButton}
        >
          Aggiungi un'altra spesa
        </Button>
      </ScrollView>
      <View style={styles.footer}>
        <Button mode="contained" buttonColor={tokens.colors.accent} onPress={handleContinue} disabled={!canContinue}>
          Continua
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 160,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  counter: {
    fontSize: 14,
    fontWeight: "600",
  },
  expenseCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  recurringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recurringLabel: {
    fontSize: 14,
  },
  input: {
    backgroundColor: "transparent",
  },
  addButton: {
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
