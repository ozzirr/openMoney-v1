import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Button, Card, Text, TextInput, SegmentedButtons } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { exportToFile, importFromFile } from "@/importExport";
import { seedDemo } from "@/seed/seed";
import { createInstitution, listInstitutions } from "@/repositories/institutionsRepo";
import { createContainer, listContainers } from "@/repositories/containersRepo";
import { createInvestCategory, listInvestCategories } from "@/repositories/investCategoriesRepo";
import { createExpenseCategory, listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import type { Container, ContainerType, ExpenseCategory, Institution, InvestCategory } from "@/repositories/types";

export default function SettingsScreen(): JSX.Element {
  const [fileName, setFileName] = useState("mymoney-export.json");
  const [message, setMessage] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [investCategories, setInvestCategories] = useState<InvestCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  const [institutionName, setInstitutionName] = useState("");
  const [containerName, setContainerName] = useState("");
  const [containerType, setContainerType] = useState<ContainerType>("CASH");
  const [containerInstitutionId, setContainerInstitutionId] = useState("");
  const [investCategoryName, setInvestCategoryName] = useState("");
  const [expenseCategoryName, setExpenseCategoryName] = useState("");

  const loadRegistry = useCallback(async () => {
    const [inst, cont, invest, expense] = await Promise.all([
      listInstitutions(),
      listContainers(),
      listInvestCategories(),
      listExpenseCategories(),
    ]);
    setInstitutions(inst);
    setContainers(cont);
    setInvestCategories(invest);
    setExpenseCategories(expense);
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const exportData = async () => {
    setMessage(null);
    const path = `${FileSystem.documentDirectory}${fileName}`;
    await exportToFile(path);
    setMessage(`Export completato: ${path}`);
  };

  const importData = async () => {
    setMessage(null);
    try {
      const path = `${FileSystem.documentDirectory}${fileName}`;
      await importFromFile(path);
      setMessage("Import completato.");
      await loadRegistry();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const importFromPicker = async () => {
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        setMessage("Nessun file selezionato.");
        return;
      }
      await importFromFile(uri);
      setMessage("Import completato.");
      await loadRegistry();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const seedData = async () => {
    setMessage(null);
    try {
      await seedDemo();
      setMessage("Seed demo completato.");
      await loadRegistry();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const addInstitution = async () => {
    if (!institutionName.trim()) return;
    await createInstitution(institutionName.trim());
    setInstitutionName("");
    await loadRegistry();
  };

  const addContainer = async () => {
    if (!containerName.trim()) return;
    const institutionId = containerInstitutionId ? Number(containerInstitutionId) : null;
    if (containerInstitutionId && Number.isNaN(institutionId)) {
      setMessage("Institution ID non valido.");
      return;
    }
    await createContainer(containerName.trim(), containerType, institutionId);
    setContainerName("");
    setContainerInstitutionId("");
    await loadRegistry();
  };

  const addInvestCategory = async () => {
    if (!investCategoryName.trim()) return;
    await createInvestCategory(investCategoryName.trim());
    setInvestCategoryName("");
    await loadRegistry();
  };

  const addExpenseCategory = async () => {
    if (!expenseCategoryName.trim()) return;
    await createExpenseCategory(expenseCategoryName.trim());
    setExpenseCategoryName("");
    await loadRegistry();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Card>
        <Card.Title title="Anagrafiche" />
        <Card.Content style={{ gap: 16 }}>
          <Text variant="titleMedium">Istituzioni</Text>
          <TextInput label="Nome" value={institutionName} onChangeText={setInstitutionName} />
          <Button onPress={addInstitution}>Aggiungi istituzione</Button>
          {institutions.map((item) => (
            <Text key={item.id}>#{item.id} • {item.name}</Text>
          ))}

          <Text variant="titleMedium">Container</Text>
          <TextInput label="Nome" value={containerName} onChangeText={setContainerName} />
          <SegmentedButtons
            value={containerType}
            onValueChange={(value) => setContainerType(value as ContainerType)}
            buttons={[
              { value: "CASH", label: "CASH" },
              { value: "INVEST", label: "INVEST" },
            ]}
          />
          <TextInput
            label="Institution ID (opzionale)"
            keyboardType="numeric"
            value={containerInstitutionId}
            onChangeText={setContainerInstitutionId}
          />
          <Button onPress={addContainer}>Aggiungi container</Button>
          {containers.map((item) => (
            <Text key={item.id}>#{item.id} • {item.name} • {item.type}</Text>
          ))}

          <Text variant="titleMedium">Categorie invest</Text>
          <TextInput label="Nome" value={investCategoryName} onChangeText={setInvestCategoryName} />
          <Button onPress={addInvestCategory}>Aggiungi categoria invest</Button>
          {investCategories.map((item) => (
            <Text key={item.id}>#{item.id} • {item.name}</Text>
          ))}

          <Text variant="titleMedium">Categorie spesa</Text>
          <TextInput label="Nome" value={expenseCategoryName} onChangeText={setExpenseCategoryName} />
          <Button onPress={addExpenseCategory}>Aggiungi categoria spesa</Button>
          {expenseCategories.map((item) => (
            <Text key={item.id}>#{item.id} • {item.name}</Text>
          ))}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Import / Export" />
        <Card.Content style={{ gap: 8 }}>
          <TextInput
            label="Nome file"
            value={fileName}
            onChangeText={setFileName}
          />
          {message && <Text>{message}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button onPress={exportData}>Export JSON</Button>
          <Button onPress={importData}>Import JSON</Button>
          <Button onPress={importFromPicker}>Importa da file</Button>
        </Card.Actions>
      </Card>

      <Card>
        <Card.Title title="Seed demo" />
        <Card.Content>
          <Text>Carica i dati di demo dal file seed.</Text>
        </Card.Content>
        <Card.Actions>
          <Button onPress={seedData}>Importa seed</Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}
