import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { completeCustomerOnboarding } from '@/services/customerProfile';

export default function ProfileSetupScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState(
    firebaseUser?.displayName?.trim() || '',
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    router.replace('/signup');
    return <LoadingScreen />;
  }

  const handleContinue = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!trimmedPhone) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    setErrorMessage('');
    setSaving(true);

    try {
      await completeCustomerOnboarding(
        firebaseUser.uid,
        {
          fullName: trimmedName,
          phoneNumber: trimmedPhone,
        },
      );

      router.replace('/home');
    } catch (error) {
      console.error(
        'Failed to complete customer profile setup:',
        error,
      );

      setErrorMessage(
        'We could not save your profile. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Complete your profile
        </Text>

        <Text style={styles.subtitle}>
          We need a few details before you can start
          using BasuraGo.
        </Text>

        <Text style={styles.label}>
          Full name
        </Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
          editable={!saving}
        />

        <Text style={styles.label}>
          Phone number
        </Text>

        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="09XXXXXXXXX"
          keyboardType="phone-pad"
          style={styles.input}
          editable={!saving}
        />

        {errorMessage ? (
          <Text style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.button,
            saving && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
        </Pressable>
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

  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#cfcfcf',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 18,
  },

  error: {
    color: '#b42318',
    marginBottom: 14,
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
});