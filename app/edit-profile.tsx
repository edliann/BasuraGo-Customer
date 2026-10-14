
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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

export default function EditProfileScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+63');

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

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
          onPress: () => router.back(),
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
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
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
            onChangeText={setFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!saving}
            style={styles.input}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
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
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
