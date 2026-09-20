import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { logoutCustomer } from '@/services/auth';

export default function HomeScreen() {
  const { firebaseUser } = useAuth();

  const handleLogout = async () => {
    await logoutCustomer();
    router.replace('/signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        BasuraGo Customer
      </Text>

      <Text style={styles.welcome}>
        Welcome, {firebaseUser?.displayName || 'Customer'}
      </Text>

      <Text style={styles.email}>
        {firebaseUser?.email}
      </Text>

      <Pressable
        style={styles.button}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>
          Log Out
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },

  welcome: {
    fontSize: 18,
    marginBottom: 6,
  },

  email: {
    fontSize: 14,
    marginBottom: 24,
  },

  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1f7a3f',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});