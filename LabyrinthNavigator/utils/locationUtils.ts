import * as Location from "expo-location";
import { Alert } from "react-native";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export const fetchCurrentLocation = async (): Promise<Coordinate | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Location Permission Denied",
        "Permission to access location was denied. Please enable it in your device settings to use this feature."
      );
      console.log("Permission to access location was denied");
      return null;
    }

    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    Alert.alert(
      "Location Error",
      "Could not fetch current location. Please ensure GPS is enabled and try again."
    );
    return null;
  }
};