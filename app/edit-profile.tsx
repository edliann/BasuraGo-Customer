
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import {
  getCustomerProfile,
  updateCustomerProfile,
} from '@/services/customerProfile';

import { styles } from '@/styles/edit-profile.styles';
import { goBackOrReplace } from '@/navigation/back';

export default function EditProfileScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+63');

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const profileRequestInFlight = useRef(false);
  const profileSnapshot = useRef<{
    fullName: string;
    phoneNumber: string;
    phoneCountryCode: string;
  } | null>(null);
  const formValues = useRef({ fullName, phoneNumber, phoneCountryCode });
  formValues.current = { fullName, phoneNumber, phoneCountryCode };

  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      router.replace('/signup');
      setLoadingProfile(false);
      return;
    }

    let mounted = true;

    async function loadProfile() {
      try {
        const profile = await getCustomerProfile(firebaseUser!.uid);

        if (!mounted) return;

        if (!profile) {
          Alert.alert(
            'Profile not found',
            'We could not find your saved customer profile.',
          );
          return;
        }

        setFullName(profile.fullName ?? '');
        setPhoneNumber(profile.phoneNumber ?? '');
        setPhoneCountryCode(profile.phoneCountryCode ?? '+63');
        profileSnapshot.current = {
          fullName: profile.fullName ?? '',
          phoneNumber: profile.phoneNumber ?? '',
          phoneCountryCode: profile.phoneCountryCode ?? '+63',
        };
      } catch (error) {
        console.error('Failed to load customer profile:', error);

        if (mounted) {
          Alert.alert(
            'Unable to load profile',
            'Please try again later.',
          );
        }
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [authLoading, firebaseUser]);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser || saving || profileRequestInFlight.current) return;
    const snapshot = profileSnapshot.current;
    const current = formValues.current;
    if (
      !snapshot ||
      current.fullName !== snapshot.fullName ||
      current.phoneNumber !== snapshot.phoneNumber ||
      current.phoneCountryCode !== snapshot.phoneCountryCode
    ) {
      setRefreshError('Save or discard your unsaved changes before refreshing your profile.');
      return;
    }

    profileRequestInFlight.current = true;
    setRefreshing(true);
    setRefreshError('');
    try {
      const profile = await getCustomerProfile(firebaseUser.uid);
      if (!profile) {
        setRefreshError('Your saved profile could not be refreshed.');
        return;
      }

      const next = {
        fullName: profile.fullName ?? '',
        phoneNumber: profile.phoneNumber ?? '',
        phoneCountryCode: profile.phoneCountryCode ?? '+63',
      };
      const latest = formValues.current;
      if (
        latest.fullName !== snapshot.fullName ||
        latest.phoneNumber !== snapshot.phoneNumber ||
        latest.phoneCountryCode !== snapshot.phoneCountryCode
      ) {
        setRefreshError('Your form changed while refreshing. Your unsaved edits were preserved.');
        return;
      }

      profileSnapshot.current = next;
      setFullName(next.fullName);
      setPhoneNumber(next.phoneNumber);
      setPhoneCountryCode(next.phoneCountryCode);
    } catch (error) {
      console.error('Failed to refresh customer profile:', error);
      setRefreshError('Your profile could not be refreshed. Your form was kept unchanged.');
    } finally {
      profileRequestInFlight.current = false;
      setRefreshing(false);
    }
  }, [firebaseUser, saving]);

  const handleSave = async () => {
    if (!firebaseUser) return;

    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Missing phone number', 'Please enter your phone number.');
      return;
    }

    setSaving(true);

    try {
      await updateCustomerProfile(firebaseUser.uid, {
        fullName,
        phoneNumber,
        phoneCountryCode,
      });

      Alert.alert('Profile updated', 'Your changes have been saved.', [
        {
          text: 'OK',
          onPress: () => goBackOrReplace('/account'),
        },
      ]);
    } catch (error) {
      console.error('Failed to update customer profile:', error);

      Alert.alert(
        'Save failed',
        'We could not save your changes. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loadingProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#176744" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshProfile()}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
        {refreshError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: '#A23B32', fontSize: 13, lineHeight: 19, marginBottom: 12 }}
          >
            {refreshError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace('/account')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹  Back to Account</Text>
        </Pressable>

        <Text style={styles.eyebrow}>YOUR BASURAGO ACCOUNT</Text>
        <Text style={styles.title}>Edit profile</Text>
        <Text style={styles.subtitle}>
          Keep your personal information up to date.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setRefreshError('');
            }}
            placeholder="Enter your full name"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!saving}
            style={styles.input}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={(value) => {
              setPhoneNumber(value);
              setRefreshError('');
            }}
            placeholder="+639171234567"
            keyboardType="phone-pad"
            editable={!saving}
            style={styles.input}
          />

          <Text style={styles.helper}>
            Include the country code, for example +63 for the Philippines.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving changes...' : 'Save changes'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => goBackOrReplace('/account')}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
