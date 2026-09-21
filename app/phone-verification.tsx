import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerProfile } from '@/services/customerProfile';
import {
  confirmPhoneVerification,
  requestPhoneVerification,
} from '@/services/phoneVerification';

export default function PhoneVerificationScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] =
    useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!firebaseUser) {
        router.replace('/signup');
        return;
      }

      try {
        const profile = await getCustomerProfile(
          firebaseUser.uid,
        );

        if (!active) {
          return;
        }

        if (!profile) {
          router.replace('/profile-setup');
          return;
        }

        if (profile.phoneVerified) {
          router.replace('/home');
          return;
        }

        setPhoneNumber(profile.phoneNumber ?? '');
      } catch (error) {
        console.error(
          'Failed to load customer phone:',
          error,
        );

        setErrorMessage(
          'We could not load your phone number.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      loadProfile();
    }

    return () => {
      active = false;
    };
  }, [firebaseUser, authLoading]);

  useEffect(() => {
    if (expiresIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setExpiresIn((current) =>
        current > 0 ? current - 1 : 0,
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresIn]);

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return <LoadingScreen />;
  }

  const handleSendCode = async () => {
    if (!phoneNumber) {
      setErrorMessage(
        'Your phone number is missing.',
      );
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setSending(true);

    try {
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
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationId) {
      setErrorMessage(
        'Please request a verification code first.',
      );
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
    setVerifying(true);

    try {
      await confirmPhoneVerification(
        verificationId,
        otp,
      );

      setSuccessMessage(
        'Your phone number has been verified.',
      );

      router.replace('/home');
    } catch (error) {
      console.error(
        'Failed to verify phone number:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Invalid verification code.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const canResend =
    !sending &&
    (expiresIn <= 0 || verificationId === null);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Verify your phone number
        </Text>

        <Text style={styles.subtitle}>
          We need to verify your phone number before
          you can use BasuraGo.
        </Text>

        <View style={styles.phoneCard}>
          <Text style={styles.phoneLabel}>
            Phone number
          </Text>

          <Text style={styles.phoneNumber}>
            {phoneNumber}
          </Text>
        </View>

        {!verificationId ? (
          <Pressable
            style={[
              styles.button,
              sending && styles.buttonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Send verification code
              </Text>
            )}
          </Pressable>
        ) : (
          <>
            <Text style={styles.label}>
              Verification code
            </Text>

            <TextInput
              value={otp}
              onChangeText={(value) =>
                setOtp(
                  value
                    .replace(/\D/g, '')
                    .slice(0, 6),
                )
              }
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              editable={!verifying}
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
                verifying &&
                  styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={verifying}
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
              disabled={!canResend}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  !canResend &&
                    styles.secondaryButtonDisabled,
                ]}
              >
                Resend code
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
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