import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { router } from 'expo-router';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerProfile } from '@/services/customerProfile';

const ONBOARDING_KEY =
  '@basurago_onboarding_completed';

export default function Index() {
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    let active = true;

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
        console.error(
          'Failed to check customer startup state:',
          error,
        );
      }
    };

    checkStartup();

    return () => {
      active = false;
    };
  }, [firebaseUser, loading]);

  return <LoadingScreen />;
}