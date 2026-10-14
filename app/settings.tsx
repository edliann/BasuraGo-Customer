
import { router } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { logoutCustomer } from '@/services/auth';
import { useEffect, useState } from 'react';
import { getCustomerProfile } from '@/services/customerProfile';

import styles from './settings.styles';

export default function SettingsScreen() {
  const { firebaseUser } = useAuth();

  const [customerName, setCustomerName] = useState(
    firebaseUser?.displayName?.trim() || 'BasuraGo Customer'
  );

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    let isActive = true;

    const loadCustomerProfile = async () => {
      try {
        const profile = await getCustomerProfile(firebaseUser.uid);

        if (!isActive) return;

        setCustomerName(
          profile?.fullName?.trim() ||
            firebaseUser.displayName?.trim() ||
            'BasuraGo Customer'
        );
      } catch (error) {
        console.error('Failed to load customer profile:', error);
      }
    };

    loadCustomerProfile();

    return () => {
      isActive = false;
    };
  }, [firebaseUser?.uid, firebaseUser?.displayName]);


  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out of BasuraGo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutCustomer();
              router.replace('/signup');
            } catch (error) {
              console.error('Failed to log out:', error);
              Alert.alert(
                'Unable to log out',
                'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹  Back</Text>
        </Pressable>

        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Manage your BasuraGo account.
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {customerName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {customerName}
            </Text>
            <Text style={styles.email}>
              {firebaseUser?.email || ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.optionsCard}>
          <Pressable
            style={styles.optionRow}
            onPress={() => router.push('/account')}
          >
            <Text style={styles.optionIcon}>♙</Text>
            <Text style={styles.optionText}>
              My Account
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            style={styles.optionRow}
            onPress={() => router.push('/schedule-pickup')}
          >
            <Text style={styles.optionIcon}>▦</Text>
            <Text style={styles.optionText}>
              Pickup Preferences
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.footer}>BasuraGo</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
