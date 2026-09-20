import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { router } from 'expo-router';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';

const ONBOARDING_KEY = '@basurago_onboarding_completed';

export default function Index() {
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    const checkStartup = async () => {
      const onboardingCompleted =
        await AsyncStorage.getItem(ONBOARDING_KEY);

      if (!onboardingCompleted) {
        router.replace('/onboarding');
        return;
      }

      if (firebaseUser) {
        router.replace('/home');
        return;
      }

      router.replace('/signup');
    };

    checkStartup();
  }, [firebaseUser, loading]);

  return <LoadingScreen />;
}