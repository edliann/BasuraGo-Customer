import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import RemixIcon from 'react-native-remix-icon';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { goBackOrReplace } from '@/navigation/back';
import { logoutCustomer } from '@/services/auth';
import { getCustomerProfile } from '@/services/customerProfile';
import {
  confirmPhoneVerification,
  getPhoneVerificationStatus,
  requestPhoneVerification,
  type PhoneVerificationCallableError,
} from '@/services/phoneVerification';
import {
  addSmsConsentErrorListener,
  addSmsOtpListener,
  startSmsUserConsent,
  stopSmsUserConsent,
} from '@/services/smsUserConsent';

function formatRemainingTime(seconds: number): string {
  if (seconds >= 60 * 60) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function getCallableDetails(error: unknown): {
  reason?: string;
  retryAfterSeconds?: number;
} {
  if (!error || typeof error !== 'object') return {};
  const callableError = error as PhoneVerificationCallableError & {
    customData?: {details?: PhoneVerificationCallableError['details']};
  };
  return callableError.details ?? callableError.customData?.details ?? {};
}

export default function PhoneVerificationScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const isAccountManagement = source === 'account';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationId, setVerificationId] =
    useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const profileRequestInFlight = useRef(false);
  const profileRequestSequence = useRef(0);
  const sendInFlight = useRef(false);
  const verifyInFlight = useRef(false);
  const verifyAttemptRef = useRef<{
    verificationId: string;
    otp: string;
    attemptId: string;
  } | null>(null);
  const switchAccountInFlight = useRef(false);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (profileRequestInFlight.current || authLoading) return;
    if (!firebaseUser) {
      if (!isRefresh) router.replace('/signup');
      else setErrorMessage('Your phone information could not be refreshed.');
      return;
    }

    profileRequestInFlight.current = true;
    const requestId = ++profileRequestSequence.current;
    let statusRestoreFailed = false;
    if (isRefresh) {
      setRefreshing(true);
      setErrorMessage('');
    }
    try {
      const profile = await getCustomerProfile(firebaseUser.uid);
      if (requestId !== profileRequestSequence.current) return;
      if (!profile) {
        if (isRefresh) {
          setErrorMessage('Your phone information is unavailable. Your verification session was kept.');
        } else {
          router.replace('/profile-setup');
        }
        return;
      }

      setPhoneVerified(profile.phoneVerified === true);
      setPhoneNumber(profile.phoneNumber ?? '');
      if (profile.phoneVerified) {
        setSuccessMessage('Your phone number is already verified.');
        return;
      }

      try {
        const status = await getPhoneVerificationStatus();
        if (requestId !== profileRequestSequence.current) return;
        setVerificationId(status.verificationId);
        setExpiresIn(status.expiresInSeconds);
        setResendCooldown(status.resendAvailableInSeconds);
        setLockoutRemaining(status.lockoutRemainingSeconds);
        setOtp('');
      } catch {
        if (requestId !== profileRequestSequence.current) return;
        console.error('Failed to restore phone verification status.');
        statusRestoreFailed = true;
      }

      setErrorMessage(statusRestoreFailed
        ? 'We could not restore the timer. The server still enforces limits.'
        : '');
    } catch (error) {
      if (requestId !== profileRequestSequence.current) return;
      console.error('Failed to load customer phone:', error);
      setErrorMessage(
        isRefresh
          ? 'We could not refresh your phone number. Your verification session was kept.'
          : 'We could not load your phone number.',
      );
    } finally {
      if (requestId === profileRequestSequence.current) {
        profileRequestInFlight.current = false;
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    }
  }, [authLoading, firebaseUser]);

  useEffect(() => {
    if (authLoading) return;
    void loadProfile();
    return () => {
      profileRequestSequence.current += 1;
      profileRequestInFlight.current = false;
      setRefreshing(false);
    };
  }, [authLoading, loadProfile]);

  useEffect(() => {
    if (expiresIn <= 0 && resendCooldown <= 0 && lockoutRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setExpiresIn((current) =>
        current > 0 ? current - 1 : 0,
      );
      setResendCooldown((current) => current > 0 ? current - 1 : 0);
      setLockoutRemaining((current) => current > 0 ? current - 1 : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresIn, resendCooldown, lockoutRemaining]);

  useEffect(() => {
    const otpSubscription = addSmsOtpListener((code) => {
      setOtp(code);
      verifyAttemptRef.current = null;
      setErrorMessage('');
      setSuccessMessage('Code detected. Review it, then verify your phone.');
      stopSmsUserConsent();
    });
    const errorSubscription = addSmsConsentErrorListener(() => {
      setSuccessMessage('Enter the SMS code manually if it is not detected.');
    });
    return () => {
      otpSubscription?.remove();
      errorSubscription?.remove();
      stopSmsUserConsent();
    };
  }, []);

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return <LoadingScreen />;
  }

  const handleSendCode = async () => {
    if (sendInFlight.current || verifying || refreshing) return;
    if (lockoutRemaining > 0) {
      setErrorMessage(
        `Too many incorrect codes. Try again in ` +
        `${formatRemainingTime(lockoutRemaining)}.`,
      );
      return;
    }
    if (resendCooldown > 0) return;
    if (!phoneNumber) {
      setErrorMessage(
        'Your phone number is missing.',
      );
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    sendInFlight.current = true;
    setSending(true);

    try {
      try {
        await startSmsUserConsent();
      } catch {
        console.warn('Android SMS detection unavailable; use manual entry.');
      }
      const result =
        await requestPhoneVerification(
          phoneNumber,
        );

      setVerificationId(
        result.verificationId,
      );

      setExpiresIn(
        result.expiresInSeconds,
      );
      setResendCooldown(result.resendAvailableInSeconds);
      setLockoutRemaining(0);
      setOtp('');
      verifyAttemptRef.current = null;

      setSuccessMessage(
        'A verification code has been generated.',
      );
    } catch (error) {
      console.error(
        'Failed to request phone verification:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send verification code.',
      );
      const details = getCallableDetails(error);
      if (details.reason === 'otp-locked' &&
          typeof details.retryAfterSeconds === 'number') {
        setLockoutRemaining(details.retryAfterSeconds);
        setErrorMessage(
          `Too many incorrect codes. Try again in ` +
          `${formatRemainingTime(details.retryAfterSeconds)}.`,
        );
      } else if (details.reason === 'resend-cooldown' &&
          typeof details.retryAfterSeconds === 'number') {
        setResendCooldown(details.retryAfterSeconds);
        setErrorMessage(
          `Please wait ${formatRemainingTime(details.retryAfterSeconds)} ` +
          'before requesting another code.',
        );
      }
      stopSmsUserConsent();
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (verifyInFlight.current || sending || refreshing) return;
    if (lockoutRemaining > 0) {
      setErrorMessage(
        `Too many incorrect codes. Try again in ` +
        `${formatRemainingTime(lockoutRemaining)}.`,
      );
      return;
    }
    if (!verificationId) {
      setErrorMessage(
        'Please request a verification code first.',
      );
      return;
    }

    if (expiresIn <= 0) {
      setVerificationId(null);
      setOtp('');
      setErrorMessage('This code has expired. Request a new verification code.');
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage(
        'Enter the 6-digit verification code.',
      );
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    verifyInFlight.current = true;
    setVerifying(true);

    try {
      let verifyAttempt = verifyAttemptRef.current;
      if (!verifyAttempt || verifyAttempt.verificationId !== verificationId ||
          verifyAttempt.otp !== otp) {
        verifyAttempt = {
          verificationId,
          otp,
          attemptId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
        verifyAttemptRef.current = verifyAttempt;
      }
      const result = await confirmPhoneVerification(
        verificationId,
        otp,
        verifyAttempt.attemptId,
      );
      verifyAttemptRef.current = null;
      if (!result.success) {
        throw new Error('Phone verification could not be confirmed.');
      }

      setPhoneVerified(true);
      setVerificationId(null);
      setOtp('');
      setExpiresIn(0);
      setResendCooldown(0);
      setLockoutRemaining(0);
      verifyAttemptRef.current = null;
      setSuccessMessage(
        'Your phone number has been verified.',
      );

      try {
        router.replace('/phone-verification-success');
      } catch (error) {
        console.error('Failed to open phone verification success page:', error);
        setErrorMessage(
          'Your phone number is verified, but we could not open the confirmation page. You can continue to your account.',
        );
      }
    } catch (error) {
      console.error(
        'Failed to verify phone number:',
        error,
      );

      const message = error instanceof Error ? error.message : '';
      const details = getCallableDetails(error);
      if (details.reason === 'otp-incorrect' ||
          details.reason === 'otp-locked') {
        verifyAttemptRef.current = null;
      }
      if (details.reason === 'otp-locked' &&
          typeof details.retryAfterSeconds === 'number') {
        setLockoutRemaining(details.retryAfterSeconds);
        setErrorMessage(
          `Too many incorrect codes. Try again in ` +
          `${formatRemainingTime(details.retryAfterSeconds)}.`,
        );
        return;
      }
      if (message.toLowerCase().includes('no longer active')) {
        verifyAttemptRef.current = null;
        setVerificationId(null);
        setOtp('');
        setExpiresIn(0);
        setErrorMessage(
          'This code has expired or is no longer valid. Request a new verification code.',
        );
      } else {
        setErrorMessage(
          message || 'The code could not be verified. Check it and try again.',
        );
        if (message.toLowerCase().includes('expired')) {
          verifyAttemptRef.current = null;
        }
      }
    } finally {
      verifyInFlight.current = false;
      setVerifying(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (isAccountManagement) return;
    if (switchAccountInFlight.current) return;
    if (sending || verifying || refreshing) {
      setErrorMessage('Please wait for the current request to finish before switching accounts.');
      return;
    }

    switchAccountInFlight.current = true;
    setSwitchingAccount(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await logoutCustomer();
      router.replace('/login');
    } catch (error) {
      console.error('Failed to switch customer account:', error);
      setErrorMessage('We could not switch accounts. Please try again.');
    } finally {
      switchAccountInFlight.current = false;
      setSwitchingAccount(false);
    }
  };

  const canResend =
    !sending &&
    resendCooldown <= 0 &&
    lockoutRemaining <= 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!sending && !verifying) void loadProfile(true);
            }}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint={`Returns to the previous screen, or ${isAccountManagement ? 'My Account' : 'login'} if there is no previous screen.`}
              style={styles.backButton}
              onPress={() =>
                goBackOrReplace(isAccountManagement ? '/account' : '/login')
              }
              disabled={switchingAccount}
            >
              <RemixIcon name="arrow-left-line" size={24} color="#173D2C" accessible={false} />
            </Pressable>
            {!isAccountManagement ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch account"
                style={styles.switchAccountButton}
                onPress={() => void handleSwitchAccount()}
                disabled={switchingAccount}
              >
                {switchingAccount ? (
                  <ActivityIndicator size="small" color="#176744" />
                ) : (
                  <Text style={styles.switchAccountText}>Switch account</Text>
                )}
              </Pressable>
            ) : null}
          </View>

        <Text style={styles.title}>
          {phoneVerified ? 'Phone number verified' : 'Verify your phone number'}
        </Text>

        <Text style={styles.subtitle}>
          {phoneVerified
            ? 'Your phone number is verified. Return to your account to view its status.'
            : 'We need to verify your phone number before you can use BasuraGo.'}
        </Text>

        <View style={styles.phoneCard}>
          <Text style={styles.phoneLabel}>
            Phone number
          </Text>

          <Text style={styles.phoneNumber}>
            {phoneNumber}
          </Text>
        </View>

        {phoneVerified ? (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => router.replace('/account')}
          >
            <Text style={styles.buttonText}>Return to Account</Text>
          </Pressable>
        ) : !verificationId ? (
          <Pressable
            style={[
              styles.button,
              (!canResend || refreshing) && styles.buttonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={!canResend || refreshing}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {lockoutRemaining > 0
                  ? `Try again in ${formatRemainingTime(lockoutRemaining)}`
                  : resendCooldown > 0
                    ? `Send code in ${resendCooldown}s`
                    : 'Send verification code'}
              </Text>
            )}
          </Pressable>
        ) : (
          <>
            {lockoutRemaining > 0 ? (
              <Text style={styles.expired}>
                Too many incorrect codes. Try again in{' '}
                {formatRemainingTime(lockoutRemaining)}.
              </Text>
            ) : null}
            <Text style={styles.label}>
              Verification code
            </Text>

            <TextInput
              value={otp}
              onChangeText={(value) => {
                const nextOtp = value.replace(/\D/g, '').slice(0, 6);
                if (nextOtp !== otp) verifyAttemptRef.current = null;
                setOtp(nextOtp);
              }}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              editable={!verifying && !refreshing && lockoutRemaining <= 0}
              autoFocus
            />

            {expiresIn > 0 ? (
              <Text style={styles.expiry}>
                Code expires in {expiresIn}s
              </Text>
            ) : (
              <Text style={styles.expired}>
                This code has expired.
              </Text>
            )}

            <Pressable
              style={[
                styles.button,
                (verifying || refreshing || lockoutRemaining > 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={verifying || refreshing || lockoutRemaining > 0}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  Verify phone number
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleSendCode}
              disabled={!canResend || refreshing}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  (!canResend || refreshing) &&
                    styles.secondaryButtonDisabled,
                ]}
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : lockoutRemaining > 0
                    ? `Try again in ${formatRemainingTime(lockoutRemaining)}`
                    : 'Resend code'}
              </Text>
            </Pressable>
          </>
        )}

        {successMessage ? (
          <Text style={styles.success}>
            {successMessage}
          </Text>
        ) : null}

        {errorMessage ? (
          <Text style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 24,
  },

  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  backButton: {
    width: 48,
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  switchAccountButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  switchAccountText: {
    color: '#176744',
    fontSize: 15,
    fontWeight: '700',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 28,
  },

  phoneCard: {
    borderWidth: 1,
    borderColor: '#d6d6d6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
  },

  phoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },

  phoneNumber: {
    fontSize: 18,
    fontWeight: '700',
  },

  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },

  otpInput: {
    borderWidth: 1,
    borderColor: '#cfcfcf',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 10,
  },

  expiry: {
    textAlign: 'center',
    marginBottom: 18,
  },

  expired: {
    textAlign: 'center',
    marginBottom: 18,
    color: '#b42318',
  },

  button: {
    backgroundColor: '#1f7a3f',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  secondaryButtonText: {
    color: '#1f7a3f',
    fontSize: 15,
    fontWeight: '700',
  },

  secondaryButtonDisabled: {
    opacity: 0.4,
  },

  success: {
    color: '#1f7a3f',
    textAlign: 'center',
    marginTop: 14,
  },

  error: {
    color: '#b42318',
    textAlign: 'center',
    marginTop: 14,
  },
});
