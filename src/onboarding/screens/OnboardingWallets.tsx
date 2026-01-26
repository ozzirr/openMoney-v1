import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { useDashboardTheme } from "@/ui/dashboard/theme";
import { OnboardingStackParamList } from "@/onboarding/OnboardingNavigator";
import { useOnboardingDraft } from "@/onboarding/state/OnboardingContext";

export default function OnboardingWallets(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList, "OnboardingWallets">>();
  const {
    draft,
    updateLiquidityWallet,
    setHasInvestments,
    addInvestmentWallet,
    updateInvestmentWallet,
  } = useOnboardingDraft();

  const liquidityNameError = draft.liquidityWallet.name.trim().length === 0;
  const balanceValue = draft.liquidityWallet.balance.trim();
  const parsedBalance = Number(balanceValue.replace(",", "."));
  const balanceValid = balanceValue.length > 0 && !Number.isNaN(parsedBalance);
  const canContinue = !liquidityNameError && balanceValid;

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }
    navigation.navigate("OnboardingCategories");
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: tokens.colors.text }]}>Wallets</Text>
        <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
          Scegli dove tieni i soldi e inserisci il tuo primo saldo.
        </Text>
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: tokens.colors.surface }]}>
            <Text style={[styles.cardTitle, { color: tokens.colors.text }]}>Wallet di liquidità</Text>
          <TextInput
            label="Nome wallet"
            value={draft.liquidityWallet.name}
            mode="flat"
            onChangeText={(text) => updateLiquidityWallet({ name: text })}
            style={styles.input}
            error={liquidityNameError}
            textColor={tokens.colors.text}
          />
          {liquidityNameError && (
            <Text style={[styles.errorText, { color: tokens.colors.error }]}>
              Inserisci un nome
            </Text>
          )}
          <TextInput
            label="Saldo iniziale"
            value={draft.liquidityWallet.balance}
            mode="flat"
            onChangeText={(text) => updateLiquidityWallet({ balance: text })}
            style={styles.input}
            keyboardType="numeric"
            error={balanceValue.length > 0 && !balanceValid}
            textColor={tokens.colors.text}
          />
          {balanceValue.length > 0 && !balanceValid && (
            <Text style={[styles.errorText, { color: tokens.colors.error }]}>
              Inserisci un numero valido
            </Text>
          )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: tokens.colors.surface }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.cardTitle, { color: tokens.colors.text }]}>Ho investimenti</Text>
            <Switch value={draft.hasInvestments} onValueChange={setHasInvestments} />
          </View>
          {draft.hasInvestments && (
            <>
              {draft.investmentWallets.map((wallet) => (
                <View key={wallet.id} style={styles.inputGroup}>
                  <TextInput
                    label="Nome investimento"
                    value={wallet.name}
                    mode="flat"
                    onChangeText={(text) => updateInvestmentWallet(wallet.id, { name: text })}
                    style={styles.inputMargin}
                    textColor={tokens.colors.text}
                  />
                  <TextInput
                    label="Saldo iniziale"
                    value={wallet.balance}
                    mode="flat"
                    keyboardType="numeric"
                    onChangeText={(text) => updateInvestmentWallet(wallet.id, { balance: text })}
                    style={styles.inputMargin}
                    textColor={tokens.colors.text}
                  />
                </View>
              ))}
              <Button
                mode="outlined"
                textColor={tokens.colors.accent}
                onPress={addInvestmentWallet}
                style={styles.addInvestmentButton}
              >
                Aggiungi un investimento
              </Button>
            </>
          )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          mode="contained"
          buttonColor={tokens.colors.accent}
          onPress={handleContinue}
          disabled={!canContinue}
        >
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
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    borderRadius: 20,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "transparent",
    marginBottom: 6,
  },
  inputMargin: {
    backgroundColor: "transparent",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputGroup: {
    marginBottom: 12,
  },
  addInvestmentButton: {
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginTop: 20,
  },
});
