import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerProfile } from '@/services/customerProfile';

const ONBOARDING_KEY =
  '@basurago_onboarding_completed';

export default function Index() {
  const { firebaseUser, loading } = useAuth();
  const [startupError, setStartupError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (loading) {
      return;
    }

    let active = true;
    setStartupError(false);

    const checkStartup = async () => {
      try {
        const onboardingCompleted =
          await AsyncStorage.getItem(
            ONBOARDING_KEY,
          );

        if (!active) {
          return;
        }

        if (!onboardingCompleted) {
          router.replace('/onboarding');
          return;
        }

        if (!firebaseUser) {
          router.replace('/signup');
          return;
        }

        const customerProfile =
          await getCustomerProfile(
            firebaseUser.uid,
          );

        if (!active) {
          return;
        }

        if (
          !customerProfile ||
          !customerProfile.onboardingCompleted
        ) {
          router.replace('/profile-setup');
          return;
        }

        if (!customerProfile.phoneVerified) {
          router.replace('/phone-verification');
          return;
        }

        router.replace('/home');
      } catch (error) {
        if (active) {
          console.error('[Customer startup] route resolution failed', error);
          setStartupError(true);
        }
      }
    };

    void checkStartup().catch((error: unknown) => {
      if (!active) return;
      console.error('[Customer startup] route resolution failed', error);
      setStartupError(true);
    });

    return () => {
      active = false;
    };
  }, [firebaseUser, loading, retryToken]);

  if (startupError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>We couldn’t finish starting BasuraGo</Text>
        <Text style={styles.errorMessage}>
          Check your connection and try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRetryToken((value) => value + 1)}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return <LoadingScreen />;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    color: '#173D2C',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#64736A',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#176744',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
