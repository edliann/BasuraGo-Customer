import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { completeCustomerOnboarding } from '@/services/customerProfile';

interface Country {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const COUNTRIES: Country[] = [
  {
    code: 'PH',
    dialCode: '+63',
    flag: '🇵🇭',
    name: 'Philippines',
  },
  {
    code: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    name: 'United States',
  },
  {
    code: 'CA',
    dialCode: '+1',
    flag: '🇨🇦',
    name: 'Canada',
  },
  {
    code: 'GB',
    dialCode: '+44',
    flag: '🇬🇧',
    name: 'United Kingdom',
  },
  {
    code: 'AU',
    dialCode: '+61',
    flag: '🇦🇺',
    name: 'Australia',
  },
  {
    code: 'SG',
    dialCode: '+65',
    flag: '🇸🇬',
    name: 'Singapore',
  },
  {
    code: 'JP',
    dialCode: '+81',
    flag: '🇯🇵',
    name: 'Japan',
  },
  {
    code: 'KR',
    dialCode: '+82',
    flag: '🇰🇷',
    name: 'South Korea',
  },
  {
    code: 'MY',
    dialCode: '+60',
    flag: '🇲🇾',
    name: 'Malaysia',
  },
  {
    code: 'TH',
    dialCode: '+66',
    flag: '🇹🇭',
    name: 'Thailand',
  },
  {
    code: 'ID',
    dialCode: '+62',
    flag: '🇮🇩',
    name: 'Indonesia',
  },
  {
    code: 'IN',
    dialCode: '+91',
    flag: '🇮🇳',
    name: 'India',
  },
  {
    code: 'AE',
    dialCode: '+971',
    flag: '🇦🇪',
    name: 'United Arab Emirates',
  },
  {
    code: 'SA',
    dialCode: '+966',
    flag: '🇸🇦',
    name: 'Saudi Arabia',
  },
  {
    code: 'NZ',
    dialCode: '+64',
    flag: '🇳🇿',
    name: 'New Zealand',
  },
];

const DEFAULT_COUNTRY = COUNTRIES[0];

function normalizePhoneNumber(
  phoneNumber: string,
  dialCode: string,
) {
  const digits = phoneNumber.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  const dialDigits = dialCode.replace(/\D/g, '');

  if (digits.startsWith(dialDigits)) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+${dialDigits}${digits.slice(1)}`;
  }

  return `+${dialDigits}${digits}`;
}

export default function ProfileSetupScreen() {
  const { firebaseUser, loading: authLoading } =
    useAuth();

  const [fullName, setFullName] = useState(
    firebaseUser?.displayName?.trim() || '',
  );

  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [selectedCountry, setSelectedCountry] =
    useState(DEFAULT_COUNTRY);

  const [countryPickerVisible, setCountryPickerVisible] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    router.replace('/signup');
    return <LoadingScreen />;
  }

  const handleContinue = async () => {
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setErrorMessage(
        'Please enter your full name.',
      );
      return;
    }

    const normalizedPhone =
      normalizePhoneNumber(
        phoneNumber,
        selectedCountry.dialCode,
      );

    if (!normalizedPhone) {
      setErrorMessage(
        'Please enter your phone number.',
      );
      return;
    }

    setErrorMessage('');
    setSaving(true);

    try {
        await completeCustomerOnboarding(
        firebaseUser.uid,
        {
            fullName: trimmedName,
            phoneNumber: normalizedPhone,
            phoneCountryCode:
            selectedCountry.dialCode,
        },
        );

      router.replace('/phone-verification');
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

        <View style={styles.phoneRow}>
          <Pressable
            style={styles.countryButton}
            onPress={() =>
              setCountryPickerVisible(true)
            }
            disabled={saving}
          >
            <Text style={styles.countryButtonText}>
              {selectedCountry.flag}{' '}
              {selectedCountry.dialCode}
            </Text>

            <Text style={styles.chevron}>
              ▼
            </Text>
          </Pressable>

          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="917 123 4567"
            keyboardType="phone-pad"
            style={styles.phoneInput}
            editable={!saving}
          />
        </View>

        <Text style={styles.phoneHint}>
          Enter your number without the country code.
        </Text>

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

      <Modal
        visible={countryPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCountryPickerVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select country
              </Text>

              <Pressable
                onPress={() =>
                  setCountryPickerVisible(false)
                }
              >
                <Text style={styles.closeButton}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <ScrollView>
              {COUNTRIES.map((country) => {
                const selected =
                  country.code ===
                  selectedCountry.code;

                return (
                  <Pressable
                    key={country.code}
                    style={[
                      styles.countryOption,
                      selected &&
                        styles.countryOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedCountry(country);
                      setCountryPickerVisible(false);
                      setPhoneNumber('');
                    }}
                  >
                    <Text style={styles.countryFlag}>
                      {country.flag}
                    </Text>

                    <View style={styles.countryInfo}>
                      <Text style={styles.countryName}>
                        {country.name}
                      </Text>

                      <Text style={styles.countryDialCode}>
                        {country.dialCode}
                      </Text>
                    </View>

                    {selected ? (
                      <Text style={styles.checkmark}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },

  countryButton: {
    minWidth: 105,
    borderWidth: 1,
    borderColor: '#cfcfcf',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  countryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  chevron: {
    fontSize: 10,
    marginLeft: 6,
  },

  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cfcfcf',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },

  phoneHint: {
    fontSize: 12,
    marginTop: 7,
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

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },

  modal: {
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },

  closeButton: {
    fontSize: 20,
    padding: 4,
  },

  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  countryOptionSelected: {
    backgroundColor: '#f1f8f3',
  },

  countryFlag: {
    fontSize: 26,
    width: 45,
  },

  countryInfo: {
    flex: 1,
  },

  countryName: {
    fontSize: 16,
    fontWeight: '600',
  },

  countryDialCode: {
    fontSize: 14,
    marginTop: 3,
  },

  checkmark: {
    fontSize: 20,
    fontWeight: '800',
  },
});