import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { logoutCustomer } from '@/services/auth';
import { getCustomerProfile } from '@/services/customerProfile';

import { styles } from './account.styles';

export default function AccountScreen() {
    const { firebaseUser } = useAuth();

    const [displayName, setName] = useState('BasuraGo Customer');
    const email = firebaseUser?.email ?? '';

    useEffect(() => {
    if (!firebaseUser?.uid) return;

    let isActive = true;

    const loadCustomerProfile = async () => {
        try {
        const profile = await getCustomerProfile(firebaseUser.uid);

        if (!isActive) return;

        setName(
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BASURAGO ACCOUNT</Text>
            <Text style={styles.title}>My Account</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
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
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                BasuraGo Customer
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Personal information
        </Text>

        <View style={styles.menuCard}>
          <MenuRow
            icon="👤"
            title="Edit profile"
            subtitle="Manage your personal details"
            onPress={() => router.push('/edit-profile')}
          />

          <MenuDivider />

          <MenuRow
            icon="📍"
            title="Pickup address"
            subtitle="Manage your collection location"
            onPress={() =>
              Alert.alert(
                'Pickup address',
                'Address management will be added next.',
              )
            }
          />

          <MenuDivider />

          <MenuRow
            icon="📱"
            title="Phone verification"
            subtitle="Verify your mobile number"
            onPress={() => router.push('/phone-verification')}
          />
        </View>

        <Text style={styles.sectionTitle}>
          Support and preferences
        </Text>

        <View style={styles.menuCard}>
          <MenuRow
            icon="🔔"
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
            icon="❓"
            title="Help and support"
            subtitle="Get help with BasuraGo"
            onPress={() =>
              Alert.alert(
                'Help and support',
                'Support options will be available here.',
              )
            }
          />

          <MenuDivider />

          <MenuRow
            icon="🔒"
            title="Privacy"
            subtitle="Your data and account privacy"
            onPress={() =>
              Alert.alert(
                'Privacy',
                'The privacy policy will be added before launch.',
              )
            }
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
      <View style={styles.bottomNavContainer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/home')}
          style={styles.navItem}
        >
          <Text style={styles.navIcon}>⌂</Text>
          <Text style={styles.navLabel}>Home</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/orders')}
          style={styles.navItem}
        >
          <Text style={styles.navIcon}>▤</Text>
          <Text style={styles.navLabel}>Orders</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          onPress={() => router.replace('/account')}
          style={styles.navItem}
        >
          <Text style={[styles.navIcon, styles.activeNav]}>●</Text>
          <Text style={[styles.navLabel, styles.activeNav]}>
            Account
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type MenuRowProps = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MenuRow({
  icon,
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
        <Text style={styles.menuIconText}>{icon}</Text>
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
