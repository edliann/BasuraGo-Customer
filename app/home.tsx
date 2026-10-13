
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'react-native';

import BottomNav from '@/components/BottomNav';

import styles from './home.styles';

function NavItem({
  label,
  symbol,
  active,
  onPress,
}: {
  label: string;
  symbol: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.navIconWrap,
          active && styles.navIconWrapActive,
        ]}
      >
        <Text
          style={[
            styles.navSymbol,
            active && styles.navSymbolActive,
          ]}
        >
          {symbol}
        </Text>
      </View>

      <Text
        style={[
          styles.navLabel,
          active && styles.navLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { firebaseUser } = useAuth();

  const customerName =
    firebaseUser?.displayName?.trim() || 'Customer';

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#176744"
      />

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require('../assets/images/basurago-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityLabel="BasuraGo — Cleaner Communities, Brighter Tomorrows"
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.headerActionText}>⚙</Text>
              </Pressable>
            </View>


            <View style={styles.greeting}>
              <Text style={styles.greetingEyebrow}>
                WELCOME TO BASURAGO
              </Text>
              <Text style={styles.greetingTitle}>
                Hello, {customerName.split(' ')[0]}!
              </Text>
              <Text style={styles.greetingSubtitle}>
                Let's make your community cleaner.
              </Text>
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationIcon}>
                <Text style={styles.locationEmoji}>⌖</Text>
              </View>

              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>
                  PICKUP LOCATION
                </Text>
                <Text style={styles.locationTitle}>
                  Your pickup address
                </Text>
                <Text style={styles.locationHint}>
                  Set your address when booking
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>
                    EASY WASTE COLLECTION
                  </Text>
                  <Text style={styles.heroTitle}>
                    Ready for a pickup?
                  </Text>
                  <Text style={styles.heroDescription}>
                    Book a convenient collection for
                    your household waste.
                  </Text>
                </View>

                <View style={styles.truckIllustration}>
                  <Text style={styles.truckEmoji}>🚛</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/schedule-pickup')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  Schedule a Pickup
                </Text>
                <Text style={styles.primaryButtonArrow}>→</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick access</Text>
              <Text style={styles.sectionSubtitle}>
                Your waste collection essentials.
              </Text>

              <View style={styles.quickGrid}>
                <View style={styles.quickCard}>
                  <View style={styles.quickIconGreen}>
                    <Text style={styles.quickEmoji}>▤</Text>
                  </View>
                  <Text style={styles.quickTitle}>My Orders</Text>
                  <Text style={styles.quickDescription}>
                    Track your pickups
                  </Text>
                </View>

                <View style={styles.quickCard}>
                  <View style={styles.quickIconMint}>
                    <Text style={styles.quickEmoji}>▦</Text>
                  </View>
                  <Text style={styles.quickTitle}>Schedule</Text>
                  <Text style={styles.quickDescription}>
                    Plan a collection
                  </Text>
                </View>

                <View style={styles.quickCard}>
                  <View style={styles.quickIconYellow}>
                    <Text style={styles.quickEmoji}>♻</Text>
                  </View>
                  <Text style={styles.quickTitle}>Waste Guide</Text>
                  <Text style={styles.quickDescription}>
                    Learn how to sort
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>
                  Your next pickup
                </Text>
                <Text style={styles.liveLabel}>YOUR ACTIVITY</Text>
              </View>

              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyEmoji}>▦</Text>
                </View>
                <Text style={styles.emptyTitle}>
                  Nothing scheduled yet
                </Text>
                <Text style={styles.emptyDescription}>
                  Your upcoming collection will appear here
                  once you've booked a pickup.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/schedule-pickup')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    Book your first pickup
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.ecoBanner}>
              <View style={styles.ecoIcon}>
                <Text style={styles.ecoEmoji}>♻</Text>
              </View>
              <View style={styles.ecoCopy}>
                <Text style={styles.ecoTitle}>
                  Every pickup makes a difference.
                </Text>
                <Text style={styles.ecoDescription}>
                  Together, we can build a cleaner and
                  greener community.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      <BottomNav />
      </View>
    </SafeAreaView>
  );
}
