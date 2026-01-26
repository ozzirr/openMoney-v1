import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingWelcome from "./screens/OnboardingWelcome";
import OnboardingName from "./screens/OnboardingName";
import OnboardingInvestments from "./screens/OnboardingInvestments";

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingName: undefined;
  OnboardingInvestments: undefined;
};

type Props = {
  onComplete: () => void;
  shouldSeedOnComplete?: boolean;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator({
  onComplete,
  shouldSeedOnComplete = true,
}: Props): JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingWelcome">
        {({ navigation }) => (
          <OnboardingWelcome onNext={() => navigation.navigate("OnboardingName")} onSkip={onComplete} />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingName">
        {({ navigation }) => (
          <OnboardingName
            onNext={() => navigation.navigate("OnboardingInvestments")}
            onSkip={onComplete}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingInvestments">
        {() => (
          <OnboardingInvestments
            onFinish={onComplete}
            shouldSeedOnComplete={shouldSeedOnComplete}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
