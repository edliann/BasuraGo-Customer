import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';
import { getCustomerProfile } from '@/services/customerProfile';
import { getPhoneVerificationRedirect } from '@/utils/phoneVerificationRoute';
import OfflineConnectionGate from '@/components/OfflineConnectionGate';

const ONBOARDING_KEY = '@basurago_onboarding_completed';
const PUBLIC_ROUTES = new Set([
  'onboarding',
  'signup',
  'auth',
  'auth-methods',
  'email-auth',
  'email-signup',
  'login',
]);

function RouteAccessGate() {
  const { firebaseUser, loading } = useAuth();
  const segments = useSegments();
  const routeKey = segments.join('/');
  const firstSegment = segments[0] ?? '';
  const isPublicRoute = PUBLIC_ROUTES.has(firstSegment);
  const isStartupRoute = !firstSegment;
  const accessKey = `${routeKey}:${firebaseUser?.uid ?? 'anonymous'}`;
  const [authorizedRoute, setAuthorizedRoute] = useState<string | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (loading) return;

    let active = true;
    setAuthorizedRoute(null);
    setAccessError(false);

    const verifyRouteAccess = async () => {
      if (isPublicRoute) {
        if (firstSegment !== 'onboarding') {
          const onboardingCompleted = await AsyncStorage.getItem(ONBOARDING_KEY);
          if (!active) return;
          if (!onboardingCompleted) {
            router.replace('/onboarding');
            return;
          }
        }
        if (active) setAuthorizedRoute(accessKey);
        return;
      }

      if (isStartupRoute) {
        if (active) setAuthorizedRoute(accessKey);
        return;
      }

      if (!firebaseUser) {
        const onboardingCompleted = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!active) return;
        router.replace(onboardingCompleted ? '/signup' : '/onboarding');
        return;
      }

      try {
        const profile = await getCustomerProfile(firebaseUser.uid);
        if (!active) return;

        if (!profile || !profile.onboardingCompleted) {
          if (firstSegment !== 'profile-setup') {
            router.replace('/profile-setup');
            return;
          }
          setAuthorizedRoute(accessKey);
          return;
        }
        if (firstSegment === 'phone-verification') {
          console.info('[RouteAccessGate] Phone verification route check', {
            phoneVerified: profile.phoneVerified === true,
          });
        }
        const verificationRedirect = getPhoneVerificationRedirect(
          profile.phoneVerified === true,
          firstSegment,
        );
        if (verificationRedirect) {
          router.replace(verificationRedirect);
          return;
        }

        setAuthorizedRoute(accessKey);
      } catch {
        if (active) setAccessError(true);
      }
    };

    void verifyRouteAccess().catch(() => {
      if (active) setAccessError(true);
    });

    return () => {
      active = false;
    };
  }, [accessKey, firebaseUser, firstSegment, isPublicRoute, isStartupRoute, loading, retryToken, routeKey]);

  const accessCheckPending = loading || authorizedRoute !== accessKey;

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
      {accessCheckPending && (
        <View style={styles.gateOverlay}>
          {accessError ? (
            <View style={styles.accessError}>
              <Text style={styles.accessErrorTitle}>We couldn’t verify your account</Text>
              <Text style={styles.accessErrorBody}>
                Check your connection and try loading this screen again.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetryToken((value) => value + 1)}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <LoadingScreen />
          )}
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <OfflineConnectionGate>
      <AuthProvider>
        <RouteAccessGate />
      </AuthProvider>
    </OfflineConnectionGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gateOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  accessError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F5F8F6',
  },
  accessErrorTitle: {
    color: '#173D2C',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  accessErrorBody: {
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
