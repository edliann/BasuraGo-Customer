import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';

import { registerCustomer } from '@/services/auth';
import { createCustomerProfile } from '@/services/customer';

export default function EmailSignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [loading, setLoading] = useState(false);

  const clearErrors = () => {
    setFullNameError('');
    setEmailError('');
    setPasswordError('');
  };

  const handleSignup = async () => {
    clearErrors();

    let hasError = false;

    if (!fullName.trim()) {
      setFullNameError('Please enter your full name.');
      hasError = true;
    }

    if (!email.trim()) {
      setEmailError('Please enter your email address.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Please enter a password.');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError(
        'Password must contain at least 6 characters.',
      );
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setLoading(true);

      const user = await registerCustomer(
        email,
        password,
        fullName,
      );

      await createCustomerProfile({
        userId: user.uid,
        fullName,
        email,
      });

      router.replace('/home');
    } catch (error) {
      console.error(error);

      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setEmailError(
              'An account with this email already exists.',
            );
            break;

          case 'auth/invalid-email':
            setEmailError(
              'Please enter a valid email address.',
            );
            break;

          case 'auth/weak-password':
            setPasswordError(
              'Your password is too weak. Please choose a stronger password.',
            );
            break;

          default:
            setEmailError(
              'Unable to create your account. Please try again.',
            );
        }
      } else {
        setEmailError(
          'Something went wrong. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.title}>
            Create your account
          </Text>

          <Text style={styles.subtitle}>
            Enter your information to create your BasuraGo account.
          </Text>

          <TextInput
            style={[
              styles.input,
              fullNameError && styles.inputError,
            ]}
            placeholder="Full name"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);

              if (fullNameError) {
                setFullNameError('');
              }
            }}
          />

          {fullNameError ? (
            <Text style={styles.errorText}>
              {fullNameError}
            </Text>
          ) : null}

          <TextInput
            style={[
              styles.input,
              emailError && styles.inputError,
            ]}
            placeholder="Email address"
            value={email}
            onChangeText={(value) => {
              setEmail(value);

              if (emailError) {
                setEmailError('');
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {emailError ? (
            <Text style={styles.errorText}>
              {emailError}
            </Text>
          ) : null}

          <TextInput
            style={[
              styles.input,
              passwordError && styles.inputError,
            ]}
            placeholder="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);

              if (passwordError) {
                setPasswordError('');
              }
            }}
            secureTextEntry
          />

          {passwordError ? (
            <Text style={styles.errorText}>
              {passwordError}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Create account
              </Text>
            )}
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <Pressable
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.loginLink}>
                Log in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  backText: {
    fontSize: 36,
    fontWeight: '300',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
    color: '#24272B',
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#68736B',
    marginBottom: 28,
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 6,
  },

  inputError: {
    borderColor: '#D32F2F',
  },

  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
  },

  button: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F6B3A',
    marginTop: 12,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 5,
  },

  loginText: {
    fontSize: 14,
    color: '#68736B',
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F6B3A',
    textDecorationLine: 'underline',
  },
});