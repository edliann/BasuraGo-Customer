import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { logoutCustomer } from '@/services/auth';
import { getCustomerProfile } from '@/services/customerProfile';

import { styles } from '@/styles/account.styles';
import BottomNav from '@/components/BottomNav';

export default function AccountScreen() {
    const { firebaseUser } = useAuth();

    const [displayName, setName] = useState('BasuraGo Customer');
    const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState('');
    const profileRequestInFlight = useRef(false);
    const profileRequestSequence = useRef(0);
    const email = firebaseUser?.email ?? '';

    const loadCustomerProfile = useCallback(async (isRefresh = false) => {
      if (!firebaseUser?.uid || profileRequestInFlight.current) return;
      profileRequestInFlight.current = true;
      const requestId = ++profileRequestSequence.current;
      if (isRefresh) {
        setRefreshing(true);
        setRefreshError('');
      }

      try {
        const profile = await getCustomerProfile(firebaseUser.uid);
        if (requestId !== profileRequestSequence.current) return;
        setName(
          profile?.fullName?.trim() ||
          firebaseUser.displayName?.trim() ||
          'BasuraGo Customer'
        );
        setPhoneVerified(profile?.phoneVerified === true);
        setRefreshError('');
      } catch (error) {
        console.error('Failed to load customer profile:', error);
        if (requestId === profileRequestSequence.current && isRefresh) {
          setRefreshError('Your profile could not be refreshed. Showing the last loaded data.');
        }
      } finally {
        if (requestId === profileRequestSequence.current) {
          profileRequestInFlight.current = false;
          if (isRefresh) setRefreshing(false);
        }
      }
    }, [firebaseUser]);

    useFocusEffect(useCallback(() => {
      void loadCustomerProfile();
      return () => {
        profileRequestSequence.current += 1;
        profileRequestInFlight.current = false;
        setRefreshing(false);
      };
    }, [loadCustomerProfile]));

  const [loggingOut, setLoggingOut] = useState(false);

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('');

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out of BasuraGo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              await logoutCustomer();
              router.replace('/signup');
            } catch {
              Alert.alert(
                'Unable to log out',
                'Please try again.',
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadCustomerProfile(true)}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
        {refreshError ? (
          <Text accessibilityRole="alert" style={styles.refreshError}>
            {refreshError}
          </Text>
        ) : null}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BASURAGO ACCOUNT</Text>
            <Text style={styles.title}>My Account</Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials || 'B'}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {displayName}
            </Text>
            <Text style={styles.profileEmail}>
              {email}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Personal information
        </Text>

        <View style={styles.menuCard}>
          <MenuRow
            image={require('../assets/images/edit-profile-icon.png')}
            title="Edit profile"
            subtitle="Manage your personal details"
            onPress={() => router.push('/edit-profile')}
          />

          <MenuDivider />

          <MenuRow
            image={require('../assets/images/pickup-address-icon.png')}
            title="Pickup address"
            subtitle="Manage your collection location"
            onPress={() => router.push('/pickup-addresses')}
          />

          <MenuDivider />

          <MenuRow
            image={require('../assets/images/phone-verification-icon.png')}
            title="Phone verification"
            subtitle={
              phoneVerified === true
                ? 'Your phone number is verified'
                : phoneVerified === false
                  ? 'Verify your mobile number'
                  : 'Check your phone verification status'
            }
            onPress={() =>
              router.push({
                pathname: '/phone-verification',
                params: { source: 'account' },
              })
            }
          />
        </View>

        <Text style={styles.sectionTitle}>
          Support and preferences
        </Text>

        <View style={styles.menuCard}>
          <MenuRow
            image={require('../assets/images/notification-icon.png')}
            title="Notifications"
            subtitle="Manage pickup updates"
            onPress={() =>
              Alert.alert(
                'Notifications',
                'Notification preferences will be added later.',
              )
            }
          />

          <MenuDivider />

          <MenuRow
            image={require('../assets/images/help-support-icon.png')}
            title="Help and support"
            subtitle="Get help with BasuraGo"
            onPress={() => router.push('/help-support')}
          />

          <MenuDivider />

          <MenuRow
            image={require('../assets/images/privacy-icon.png')}
            title="Privacy"
            subtitle="Your data and account privacy"
            onPress={() => router.push('/privacy')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
            loggingOut && styles.disabled,
          ]}
        >
          <Text style={styles.logoutText}>
            {loggingOut ? 'Logging out...' : 'Log out'}
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          BasuraGo · Cleaner Communities, Brighter Tomorrows
        </Text>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}


type MenuRowProps = {
  image: number;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MenuRow({
  image,
  title,
  subtitle,
  onPress,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.menuIcon}>
        <Image
          source={image}
          style={styles.menuIconImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
}
