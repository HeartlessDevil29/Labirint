import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Button, Image, Animated, Alert } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";

const arrowImage = require("../assets/arrow.png");

type Coordinate = {
  latitude: number;
  longitude: number;
};

const MapScreen = () => {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [smoothedHeading, setSmoothedHeading] = useState<number>(0);
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState<Coordinate[]>([]);
  const [entryExitMode, setEntryExitMode] = useState(false);
  const [entryPoint, setEntryPoint] = useState<Coordinate | null>(null);
  const [exitPoint, setExitPoint] = useState<Coordinate | null>(null);

  const mapRef = useRef<MapView>(null);
  const headingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();

    const locationSubscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const newCoord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(newCoord);

        if (tracking) {
          setPath((prev) => [...prev, newCoord]);
        }
      }
    );

    const alpha = 0.45; // Faster response
    let currentHeading = 0;

    const magnetometerSubscription = Magnetometer.addListener((data) => {
      let angle = 0;
      if (data) {
        let { x, y } = data;
        angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;
      }

      currentHeading = (1 - alpha) * currentHeading + alpha * angle;
      setHeading(angle);
      setSmoothedHeading(currentHeading);
    });

    Magnetometer.setUpdateInterval(50); // Faster updates

    return () => {
      locationSubscription.then((sub) => sub.remove());
      magnetometerSubscription.remove();
    };
  }, [tracking]);

  useEffect(() => {
    Animated.timing(headingAnim, {
      toValue: (smoothedHeading - 90) % 360,
      duration: 100,
      useNativeDriver: false, // Improved rotation responsiveness
    }).start();
  }, [smoothedHeading]);

  const toggleTracking = () => {
    if (tracking) {
      if (path.length > 1) {
        setPath((prev) => {
          const first = prev[0];
          const last = prev[prev.length - 1];
          if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
            return [...prev, first];
          }
          return prev;
        });
      }
      setTracking(false);
      setEntryExitMode(true);
    } else {
      if (location) setPath([location]);
      setTracking(true);
      setEntryExitMode(false);
      setEntryPoint(null);
      setExitPoint(null);
    }
  };

  const onMapPress = (e: any) => {
    if (!entryExitMode) return;

    const pressedCoord: Coordinate = e.nativeEvent.coordinate;

    if (!entryPoint) {
      setEntryPoint(pressedCoord);
      Alert.alert("Entry point set");
      return;
    }

    if (!exitPoint) {
      setExitPoint(pressedCoord);
      Alert.alert("Exit point set");
      setEntryExitMode(false);
      return;
    }

    Alert.alert("Entry and exit points already set");
  };

  const rotate = headingAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={false}
        showsMyLocationButton={false}
        zoomControlEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={true}
        initialRegion={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : {
                latitude: 37.78825,
                longitude: -122.4324,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
        }
        onPress={onMapPress}
      >
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.Image
              source={arrowImage}
              style={[styles.arrow, { transform: [{ rotate: rotate }] }]}
            />
          </Marker>
        )}

        {path.length > 1 && (
          <Polyline
            coordinates={path}
            strokeColor="blue"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}

        {entryPoint && (
          <Marker coordinate={entryPoint} pinColor="green" title="Entry Point" />
        )}
        {exitPoint && (
          <Marker coordinate={exitPoint} pinColor="red" title="Exit Point" />
        )}
      </MapView>

      <View style={styles.buttonContainer}>
        <Button
          title={tracking ? "Stop Tracking" : "Start Tracking"}
          onPress={toggleTracking}
        />
      </View>

      {entryExitMode && (
        <View style={[styles.buttonContainer, { top: 100 }]}>
          <Button
            title="Cancel Entry/Exit Selection"
            onPress={() => {
              setEntryExitMode(false);
              setEntryPoint(null);
              setExitPoint(null);
            }}
            color="red"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  arrow: {
    width: 40,
    height: 40,
  },
  buttonContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 8,
    padding: 5,
  },
});

export default MapScreen;
