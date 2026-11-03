import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { loginCustomer } from '@/services/auth';
import {
  getCustomerOnboardingErrorCode,
  getCustomerOnboardingErrorMessage,
  isCustomerOnboardingError,
  onboardCustomer,
} from '@/services/customerAuth';
import {
  clearPendingFacebookCredential,
  getFacebookAuthErrorCode,
  hasPendingFacebookCredential,
  linkPendingFacebookCredential,
} from '@/services/facebookAuth';

export default function LoginScreen() {
  const { linkFacebook } = useLocalSearchParams<{
    linkFacebook?: string;
  }>();
  const isFacebookLinkFlow = linkFacebook === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (
      isFacebookLinkFlow &&
      !hasPendingFacebookCredential()
    ) {
      Alert.alert(
        'Facebook sign-in expired',
        'Start Facebook sign-in again to link it to your existing account.',
      );
      router.replace('/signup');
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Please enter your email and password.',
      );
      return;
    }

    try {
      setLoading(true);

      const user = await loginCustomer(email, password);

      if (isFacebookLinkFlow) {
        try {
          await linkPendingFacebookCredential(user);
        } catch (error) {
          const code = getFacebookAuthErrorCode(error);
          console.warn(
            'Facebook account linking failed:',
            code || 'unknown error',
          );

          if (code === 'auth/credential-already-in-use') {
            Alert.alert(
              'Facebook account already linked',
              'This Facebook account is linked to a different Firebase account. No accounts were merged.',
            );
          } else if (code === 'auth/invalid-credential') {
            Alert.alert(
              'Facebook sign-in expired',
              'The pending Facebook sign-in is no longer valid. Start Facebook sign-in again.',
            );
          } else if (code === 'auth/network-request-failed') {
            Alert.alert(
              'Connection problem',
              'Facebook could not be linked because the network request failed. Check your connection and try signing in again.',
            );
          } else if (code === 'auth/facebook-link-account-mismatch') {
            Alert.alert(
              'Different account',
              'Use the email and password for the account that was used to start Facebook sign-in.',
            );
          } else if (code === 'auth/facebook-link-password-required') {
            Alert.alert(
              'Email and password required',
              'Sign in with the email and password already linked to this Firebase account.',
            );
          } else {
            Alert.alert(
              'Could not link Facebook',
              'Your existing account is still signed in. Try again, or cancel and restart Facebook sign-in.',
            );
          }

          return;
        }
      } else {
        await onboardCustomer(user);
      }

      router.replace('/');
    } catch (error) {
      const onboardingCode = getCustomerOnboardingErrorCode(error);
      if (isCustomerOnboardingError(error)) {
        if (__DEV__) {
          console.error('[Email login] onboarding failed', {
            code: onboardingCode,
          });
        }
        Alert.alert(
          'Account setup incomplete',
          getCustomerOnboardingErrorMessage(error),
        );
        return;
      }

      const code = getFacebookAuthErrorCode(error);
      console.warn(
        'Email/password sign-in failed:',
        code || 'unknown error',
      );

      Alert.alert(
        'Login failed',
        isFacebookLinkFlow
          ? 'Use the email and password for your existing BasuraGo account.'
          : 'The email or password is incorrect.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BasuraGo</Text>

      <Text style={styles.subtitle}>
        {isFacebookLinkFlow
          ? 'Sign in with your existing email and password to link Facebook to that same account.'
          : 'Sign in to your customer account'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </Pressable>

      {isFacebookLinkFlow ? (
        <Pressable
          onPress={() => {
            clearPendingFacebookCredential();
            router.replace('/signup');
          }}
        >
          <Text style={styles.link}>Cancel Facebook linking</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/signup')}>
          <Text style={styles.link}>
            Don't have an account? Sign up
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    fontSize: 16,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#1f7a3f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
});
