import { StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>BasuraGo</Text>

      <Text style={styles.loading}>
        Loading...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  logo: {
    fontSize: 36,
    fontWeight: '800',
  },

  loading: {
    marginTop: 16,
    fontSize: 15,
  },
});