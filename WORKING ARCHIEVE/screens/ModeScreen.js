import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function ModeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("ManualRegistration")}
      >
        <Text style={styles.text}>RETAILER</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Scan")}
      >
        <Text style={styles.text}>CLIENT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#111",
    padding: 30
  },
  button: {
    backgroundColor: "#ff7a00",
    padding: 25,
    marginVertical: 10,
    borderRadius: 15
  },
  text: {
    color: "white",
    fontSize: 22,
    textAlign: "center",
    fontWeight: "bold"
  }
});