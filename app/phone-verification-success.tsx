import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerProfile } from '@/services/customerProfile';
import {
  formatPhoneNumberForDisplay,
  getVerifiedPhoneNumber,
} from '@/utils/verifiedPhone';

type VerificationState =
  | { status: 'loading' }
  | { status: 'verified'; phoneNumber: string; countryCode?: string }
  | { status: 'unverified' }
  | { status: 'unavailable' };

export default function PhoneVerificationSuccessScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [verificationState, setVerificationState] =
    useState<VerificationState>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);
  const [navigationError, setNavigationError] = useState('');

  const loadVerificationState = useCallback(async () => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace('/signup');
      return;
    }

    setVerificationState({ status: 'loading' });
    try {
      const profile = await getCustomerProfile(firebaseUser.uid);
      const phoneNumber = getVerifiedPhoneNumber(
        profile?.phoneVerified,
        profile?.phoneNumber,
        firebaseUser.phoneNumber,
      );

      if (!profile) {
        setVerificationState({ status: 'unavailable' });
      } else if (phoneNumber) {
        setVerificationState({
          status: 'verified',
          phoneNumber,
          countryCode: profile.phoneCountryCode,
        });
      } else if (profile.phoneVerified === true) {
        setVerificationState({ status: 'unavailable' });
      } else {
        setVerificationState({ status: 'unverified' });
      }
    } catch (error) {
      console.error('Failed to confirm phone verification status:', error);
      setVerificationState({ status: 'unavailable' });
    }
  }, [authLoading, firebaseUser]);

  useEffect(() => {
    void loadVerificationState();
  }, [loadVerificationState, retryToken]);

  if (authLoading || verificationState.status === 'loading') {
    return <LoadingScreen />;
  }

  const isVerified = verificationState.status === 'verified';
  const navigateTo = (path: '/account' | '/phone-verification') => {
    try {
      router.replace(path);
    } catch (error) {
      console.error(`Failed to navigate to ${path}:`, error);
      setNavigationError('We could not open that page. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        {isVerified ? (
          <>
            <View
              accessible
              accessibilityLabel="Success"
              style={styles.successIcon}
            >
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.title}>Phone Number Verified</Text>
            <Text style={styles.description}>
              Your phone number has been successfully verified.
            </Text>
            <View style={styles.phoneCard}>
              <Text style={styles.phoneLabel}>Verified phone number</Text>
              <Text style={styles.phoneNumber}>
                {formatPhoneNumberForDisplay(
                  verificationState.phoneNumber,
                  verificationState.countryCode,
                )}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {verificationState.status === 'unverified'
                ? 'Verification Not Confirmed'
                : 'Verification Status Unavailable'}
            </Text>
            <Text style={styles.description}>
              {verificationState.status === 'unverified'
                ? 'We could not confirm that your phone number is verified. Please return to phone verification and try again.'
                : 'We could not load your verified phone number. Check your connection and try again.'}
            </Text>
            {verificationState.status === 'unavailable' ? (
              <Pressable
                accessibilityRole="button"
                  onPress={() => {
                    setNavigationError('');
                    setRetryToken((value) => value + 1);
                  }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                  onPress={() => navigateTo('/phone-verification')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Return to verification
                </Text>
              </Pressable>
            )}
          </>
        )}

        {navigationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {navigationError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigateTo(isVerified ? '/account' : '/phone-verification')}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {isVerified ? 'Back to Account' : 'Back to Phone Verification'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F2E8',
    marginBottom: 22,
  },
  checkmark: {
    color: '#176744',
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 52,
  },
  title: {
    color: '#173D2C',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: '#64736A',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 10,
  },
  phoneCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D6E3DA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 28,
  },
  phoneLabel: {
    color: '#64736A',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  phoneNumber: {
    color: '#173D2C',
    fontSize: 19,
    fontWeight: '700',
  },
  button: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#176744',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
  },
  secondaryButtonText: {
    color: '#176744',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
});
