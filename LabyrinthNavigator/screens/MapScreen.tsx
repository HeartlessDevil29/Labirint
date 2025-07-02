import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Button,
  Image,
  Animated,
  Alert,
  Modal,
  ScrollView,
  Text,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";

const arrowImage = require("../assets/arrow.png");
const RESOLUTION_FACTOR = 1;

// Coordinate and Grid Types
type Coordinate = {
  latitude: number;
  longitude: number;
};

type Grid = number[][];

const MapScreen = () => {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [smoothedHeading, setSmoothedHeading] = useState<number>(0);
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState<Coordinate[]>([]);
  const [showGridPopup, setShowGridPopup] = useState(false);
  const [arrayGrid, setArrayGrid] = useState<Grid | null>(null);
  const [entryExitMode, setEntryExitMode] = useState(false);
  const [entryPoint, setEntryPoint] = useState<Coordinate | null>(null);
  const [exitPoint, setExitPoint] = useState<Coordinate | null>(null);

  const mapRef = useRef<MapView>(null);
  const headingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coord);
      mapRef.current?.animateToRegion({
        ...coord,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();

    const locSub = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(coord);
        if (tracking) setPath((prev) => [...prev, coord]);
      }
    );

    const alpha = 0.3;
    let currHeading = 0;
    const magSub = Magnetometer.addListener((data) => {
      let angle = 0;
      if (data) {
        const { x, y } = data;
        angle = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
      }
      currHeading = (1 - alpha) * currHeading + alpha * angle;
      setHeading(angle);
      setSmoothedHeading(currHeading);
    });
    Magnetometer.setUpdateInterval(50);

    return () => {
      locSub.then((sub) => sub.remove());
      magSub.remove();
    };
  }, [tracking]);

  useEffect(() => {
    Animated.timing(headingAnim, {
      toValue: smoothedHeading,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [smoothedHeading]);

  const toggleTracking = () => {
    if (tracking) {
      if (path.length > 1) {
        const first = path[0];
        const last = path[path.length - 1];
        if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
          setPath((prev) => [...prev, first]);
        }
      }
      setTracking(false);
    } else {
      if (location) setPath([location]);
      setTracking(true);
      setArrayGrid(null);
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
      generateMazeGrid();
    } else {
      Alert.alert("Entry and exit points already set");
    }
  };

  const generateMazeGrid = () => {
    if (!entryPoint || !exitPoint || path.length < 2) {
      Alert.alert("Missing data to generate maze");
      return;
    }

    const lats = path.map((p) => p.latitude);
    const lons = path.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const metersPerDegree = 111000;
    const rows = Math.ceil(((maxLat - minLat) * metersPerDegree) / RESOLUTION_FACTOR);
    const cols = Math.ceil(((maxLon - minLon) * metersPerDegree) / RESOLUTION_FACTOR);
    const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(0));

    const toGridCoords = (coord: Coordinate): [number, number] => [
      Math.floor(((coord.latitude - minLat) * metersPerDegree) / RESOLUTION_FACTOR),
      Math.floor(((coord.longitude - minLon) * metersPerDegree) / RESOLUTION_FACTOR),
    ];

    const start = toGridCoords(entryPoint);
    const end = toGridCoords(exitPoint);

    const stack: [number, number][] = [start];
    const visited = new Set<string>();

    const isInBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < rows && y < cols;

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1];
      grid[x][y] = 1;
      visited.add(`${x},${y}`);

      if (x === end[0] && y === end[1]) break;

      const neighbors = directions
        .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
        .filter(([nx, ny]) => isInBounds(nx, ny) && !visited.has(`${nx},${ny}`));

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        stack.push(next);
      }
    }

    setArrayGrid(grid);
    setShowGridPopup(true);
  };

  const rotate = headingAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["90deg", "450deg"],
  });

  const renderGridPopup = () => (
    <Modal visible={showGridPopup} animationType="slide">
      <ScrollView contentContainerStyle={{ padding: 10 }}>
        {arrayGrid?.map((row, idx) => (
          <Text key={idx} style={{ fontFamily: "monospace" }}>
            {row.map((cell) => (cell === 1 ? "⬜" : "⬛")).join("")}
          </Text>
        ))}
        <Button title="Close" onPress={() => setShowGridPopup(false)} />
      </ScrollView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={false}
        onPress={onMapPress}
        initialRegion={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }
      >
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.Image
              source={arrowImage}
              style={[styles.arrow, { transform: [{ rotate }] }]}
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

      <View style={[styles.buttonContainer, { top: 100 }]}> 
        <Button
          title={tracking ? "Stop Tracking" : "Start Tracking"}
          onPress={toggleTracking}
        />
      </View>

      <View style={[styles.buttonContainer, { top: 170 }]}> 
        <Button
          title="Show 2D Array"
          onPress={generateMazeGrid}
          color={path.length > 1 ? "purple" : "gray"}
        />
      </View>

      {!tracking && path.length > 2 && (
        <View style={[styles.buttonContainer, { top: 240 }]}> 
          <Button
            title="Set Entry & Exit"
            onPress={() => {
              setEntryExitMode(true);
              setEntryPoint(null);
              setExitPoint(null);
              Alert.alert("Tap on the map to set entry and exit points");
            }}
            color="orange"
          />
        </View>
      )}

      {renderGridPopup()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  arrow: { width: 40, height: 40 },
  buttonContainer: {
    position: "absolute",
    left: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 8,
    padding: 5,
    zIndex: 10,
  },
});

export default MapScreen;
