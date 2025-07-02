import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import MapScreen from "../screens/MapScreen";

const Stack = createNativeStackNavigator();

const Navigation = () => (
  <NavigationContainer>
    {/* @ts-expect-error Type mismatch in 'id' prop — safe to ignore */}
    <Stack.Navigator>
      <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default Navigation;
