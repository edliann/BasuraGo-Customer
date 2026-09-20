import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { registerCustomer } from '@/services/auth';
import { provisionCustomer } from '@/services/customerAuth';

interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

function getPasswordRequirements(
  password: string,
): PasswordRequirements {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordStrength(
  requirements: PasswordRequirements,
): {
  label: string;
  level: number;
} {
  const score = Object.values(requirements).filter(Boolean).length;

  if (score <= 2) {
    return {
      label: 'Weak',
      level: 1,
    };
  }

  if (score <= 4) {
    return {
      label: 'Fair',
      level: 2,
    };
  }

  return {
    label: 'Strong',
    level: 3,
  };
}

function Requirement({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.requirementRow}>
      <Text
        style={[
          styles.requirementIcon,
          met
            ? styles.requirementMet
            : styles.requirementMissing,
        ]}
      >
        {met ? '✓' : '○'}
      </Text>

      <Text
        style={[
          styles.requirementText,
          met
            ? styles.requirementTextMet
            : styles.requirementTextMissing,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export default function EmailSignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const requirements = useMemo(
    () => getPasswordRequirements(password),
    [password],
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(requirements),
    [requirements],
  );

  const passwordValid =
    requirements.length &&
    requirements.uppercase &&
    requirements.lowercase &&
    requirements.number &&
    requirements.special;

  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  const formValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    passwordValid &&
    passwordsMatch;

  const handleCreateAccount = async () => {
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!passwordValid) {
      setErrorMessage(
        'Please create a stronger password that meets all requirements.',
      );
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage(
        'Your passwords do not match.',
      );
      return;
    }

    try {
      setLoading(true);

      const user = await registerCustomer(
        email,
        password,
        fullName,
      );

      await provisionCustomer(user);

      router.replace('/');
    } catch (error: any) {
      console.error(
        'Customer registration error:',
        error,
      );

      if (
        error?.code ===
        'auth/email-already-in-use'
      ) {
        setErrorMessage(
          'An account with this email already exists.',
        );
      } else if (
        error?.code ===
        'auth/invalid-email'
      ) {
        setErrorMessage(
          'Please enter a valid email address.',
        );
      } else if (
        error?.code ===
        'auth/weak-password'
      ) {
        setErrorMessage(
          'Firebase rejected this password as too weak.',
        );
      } else {
        setErrorMessage(
          'We could not create your account. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            Enter your details to get started with
            BasuraGo.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Full name
            </Text>

            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Juan Dela Cruz"
              placeholderTextColor="#8B958E"
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Email address
            </Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8B958E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Password
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a strong password"
                placeholderTextColor="#8B958E"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="next"
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.visibilityText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthHeader}>
                  <Text style={styles.strengthTitle}>
                    Password strength
                  </Text>

                  <Text
                    style={[
                      styles.strengthLabel,
                      passwordStrength.level === 1 &&
                        styles.weakText,
                      passwordStrength.level === 2 &&
                        styles.fairText,
                      passwordStrength.level === 3 &&
                        styles.strongText,
                    ]}
                  >
                    {passwordStrength.label}
                  </Text>
                </View>

                <View style={styles.strengthBars}>
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.level >= 1 &&
                        styles.strengthBarActive,
                    ]}
                  />

                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.level >= 2 &&
                        styles.strengthBarActive,
                    ]}
                  />

                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.level >= 3 &&
                        styles.strengthBarActive,
                    ]}
                  />
                </View>

                <View style={styles.requirements}>
                  <Requirement
                    met={requirements.length}
                  >
                    At least 8 characters
                  </Requirement>

                  <Requirement
                    met={requirements.uppercase}
                  >
                    One uppercase letter
                  </Requirement>

                  <Requirement
                    met={requirements.lowercase}
                  >
                    One lowercase letter
                  </Requirement>

                  <Requirement
                    met={requirements.number}
                  >
                    One number
                  </Requirement>

                  <Requirement
                    met={requirements.special}
                  >
                    One special character
                  </Requirement>
                </View>
              </View>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Confirm password
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Enter your password again"
                placeholderTextColor="#8B958E"
                secureTextEntry={
                  !showConfirmPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={
                  handleCreateAccount
                }
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() =>
                  setShowConfirmPassword(
                    (current) => !current,
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.visibilityText}>
                  {showConfirmPassword
                    ? 'Hide'
                    : 'Show'}
                </Text>
              </Pressable>
            </View>

            {confirmPassword.length > 0 && (
              <Text
                style={[
                  styles.matchText,
                  passwordsMatch
                    ? styles.matchSuccess
                    : styles.matchError,
                ]}
              >
                {passwordsMatch
                  ? '✓ Passwords match'
                  : 'Passwords do not match'}
              </Text>
            )}
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.createButton,
              (!formValid || loading) &&
                styles.createButtonDisabled,
            ]}
            onPress={handleCreateAccount}
            disabled={!formValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>
                Create account
              </Text>
            )}
          </Pressable>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <Pressable
              onPress={() => router.replace('/login')}
              disabled={loading}
            >
              <Text style={styles.loginLink}>
                Log in
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F4',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  backText: {
    fontSize: 32,
    lineHeight: 34,
    color: '#172019',
    marginTop: -3,
  },

  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#172019',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#68736C',
    marginBottom: 30,
  },

  fieldGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#253029',
    marginBottom: 8,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D5DDD7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#172019',
  },

  passwordContainer: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5DDD7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#172019',
  },

  visibilityButton: {
    paddingHorizontal: 14,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  visibilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F6B3A',
  },

  strengthContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E6E1',
  },

  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  strengthTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#536058',
  },

  strengthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },

  weakText: {
    color: '#C44B4B',
  },

  fairText: {
    color: '#A66A00',
  },

  strongText: {
    color: '#1F6B3A',
  },

  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 9,
  },

  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E7E3',
  },

  strengthBarActive: {
    backgroundColor: '#1F6B3A',
  },

  requirements: {
    marginTop: 12,
    gap: 6,
  },

  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  requirementIcon: {
    width: 20,
    fontSize: 14,
    fontWeight: '700',
  },

  requirementMet: {
    color: '#1F6B3A',
  },

  requirementMissing: {
    color: '#9AA39D',
  },

  requirementText: {
    fontSize: 13,
  },

  requirementTextMet: {
    color: '#536058',
  },

  requirementTextMissing: {
    color: '#8B958E',
  },

  matchText: {
    marginTop: 7,
    marginLeft: 4,
    fontSize: 13,
  },

  matchSuccess: {
    color: '#1F6B3A',
  },

  matchError: {
    color: '#C44B4B',
  },

  errorContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FCECEC',
    marginBottom: 16,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A63737',
  },

  createButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#1F6B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  createButtonDisabled: {
    backgroundColor: '#AAB8AE',
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 5,
  },

  loginText: {
    fontSize: 14,
    color: '#68736C',
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F6B3A',
  },
});