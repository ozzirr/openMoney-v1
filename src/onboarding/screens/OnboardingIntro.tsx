import React, { useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import OnboardingSlide from "@/onboarding/components/OnboardingSlide";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { OnboardingStackParamList } from "@/onboarding/OnboardingNavigator";
import { setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import type { SlideData } from "@/onboarding/types";
import { SafeAreaView } from "react-native-safe-area-context";

const slides: SlideData[] = [
  {
    title: "Benvenuto in OpenMoney",
    subtitle: "La tua finanza personale. In un unico posto. Gratis, per sempre.",
    bullets: [
      "Pieno controllo delle tue entrate e uscite ricorrenti",
      "Grafici e report dettagliati del tuo patrimonio e non solo...",
    ],
    image: require("../../../assets/onboarding/onboarding-1.png"),
  },
  {
    title: "Open Source e trasparente",
    subtitle: "Repository pubblica su GitHub, puoi verificare il codice quando vuoi.",
    bullets: [
      "Codice pubblico",
      "Nessuna logica nascosta",
    ],
    image: require("../../../assets/onboarding/onboarding-2.png"),
  },
  {
    title: "Privacy by Design",
    subtitle: "Offline-first, funziona senza connessione. \nI tuoi dati restano sul tuo dispositivo.",
    bullets: [
      "Nessun account",
      "Nessun cloud",
      "Nessun tracciamento",
    ],
    image: require("../../../assets/onboarding/onboarding-3.png"),
  },
  {
    title: "Iniziamo subito",
    subtitle: "Pochi passaggi per configurare OpenMoney.",
    bullets: [],
    image: require("../../../assets/onboarding/onboarding-4.png"),
  },
];

type Props = {
  onComplete: () => void;
  shouldSeedOnComplete: boolean;
};

export default function OnboardingIntro({ onComplete, shouldSeedOnComplete }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList, "OnboardingIntro">>();

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const { width } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);

  const handleSkip = () => {
    Alert.alert("Saltare la configurazione?", "Puoi farla in seguito dal profilo.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Salta",
        onPress: async () => {
          if (shouldSeedOnComplete) await setOnboardingCompleted(true);
          onComplete();
        },
      },
    ]);
  };

  const scrollToIndex = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handlePrimaryPress = () => {
    if (activeIndex >= slides.length - 1) {
      navigation.navigate("OnboardingWallets");
      return;
    }
    requestAnimationFrame(() => scrollToIndex(activeIndex + 1));
  };

  const handleMomentumScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    setActiveIndex(newIndex);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.root, { backgroundColor: tokens.colors.bg }]}>
      <View
        style={styles.contentZone}
        onLayout={(event) => {
          const h = event.nativeEvent.layout.height;
          if (h > 0 && h !== contentHeight) setContentHeight(h);
        }}
      >
        <FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item, i) => `${item.title}-${i}`}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          style={styles.slider}
          contentContainerStyle={styles.sliderContainer}
          renderItem={({ item, index }) => (
            <View style={[styles.slidePage, { width }]}>
              <OnboardingSlide
                slide={item}
                isActive={activeIndex === index}
                availableHeight={contentHeight > 0 ? contentHeight : undefined}
              />
            </View>
          )}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        />
      </View>

      {/* Niente insets.bottom qui. SafeAreaView edges=bottom lo gestisce già */}
      <View style={styles.footer}>
        <Button mode="contained" buttonColor={tokens.colors.accent} onPress={handlePrimaryPress}>
          {activeIndex >= slides.length - 1 ? "Inizia" : "Continua"}
        </Button>
        <Button mode="text" textColor={tokens.colors.muted} onPress={handleSkip}>
          Salta per ora
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // FIX. Prima mancava del tutto
  contentZone: { flex: 1 },

  slider: { flex: 1 },
  sliderContainer: { flexGrow: 1 },

  slidePage: { flex: 1 },

  dotsWrapper: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
});
