
import { router, useFocusEffect, usePathname } from 'expo-router';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  FlatList,
  useWindowDimensions,
  Animated,
  Easing,
  Image,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCustomerProfile } from '@/services/customerProfile';
import {
  getCustomerPickupHistory,
  type CustomerPickupHistoryItem,
} from '@/services/pickups';
import { formatPickupTime } from '@/utils/pickupTime';
import { getNextActivePickup } from '@/utils/nextPickup';

import BottomNav from '@/components/BottomNav';

import styles from './home.styles';

export default function HomeScreen() {
  const pathname = usePathname();
  const isHomeRoute = pathname === '/home';

  const stickyHeaderProgress = useRef(new Animated.Value(0)).current;
  const isStickyHeaderVisible = useRef(false);

  useEffect(() => {
    if (pathname !== '/home') {
      stickyHeaderProgress.stopAnimation();
      stickyHeaderProgress.setValue(0);
      isStickyHeaderVisible.current = false;
    }
  }, [pathname, stickyHeaderProgress]);

  const { firebaseUser, loading: authLoading } = useAuth();

  const [customerName, setCustomerName] = useState(
    firebaseUser?.displayName?.trim() || 'Customer'
  );

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [nextPickup, setNextPickup] =
    useState<CustomerPickupHistoryItem | null>(null);
  const [pickupLoading, setPickupLoading] = useState(true);
  const [pickupError, setPickupError] = useState(false);
  const pickupRefreshHandler = useRef<(() => Promise<void>) | null>(null);
  const profileRequestInFlight = useRef(false);
  const profileRequestSequence = useRef(0);

  const loadCustomerProfile = useCallback(async (isRefresh = false) => {
    if (!firebaseUser?.uid || profileRequestInFlight.current) return;

    profileRequestInFlight.current = true;
    const requestId = ++profileRequestSequence.current;
    if (isRefresh) {
      setRefreshError('');
    }

    try {
      const profile = await getCustomerProfile(firebaseUser.uid);
      if (requestId !== profileRequestSequence.current) return;

      setCustomerName(
        profile?.fullName?.trim() ||
          firebaseUser.displayName?.trim() ||
          'Customer'
      );
      setRefreshError('');
    } catch (error) {
      console.error('Failed to load customer profile:', error);
      if (requestId === profileRequestSequence.current && isRefresh) {
        setRefreshError('Your profile could not be refreshed. Showing the last loaded data.');
      }
    } finally {
      if (requestId === profileRequestSequence.current) {
        profileRequestInFlight.current = false;
      }
    }
  }, [firebaseUser]);

  const customerUid = firebaseUser?.uid ?? null;

  useFocusEffect(useCallback(() => {
    if (authLoading) return undefined;
    if (!customerUid) {
      setNextPickup(null);
      setPickupLoading(false);
      setPickupError(true);
      pickupRefreshHandler.current = null;
      return undefined;
    }

    let active = true;
    let requestInFlight = false;
    let hasLoadedPickups = false;
    setPickupLoading(true);
    setPickupError(false);

    const loadPickups = async (manual = false): Promise<void> => {
      if (
        !active ||
        requestInFlight ||
        AppState.currentState !== 'active'
      ) return;
      requestInFlight = true;
      if (manual) {
        setPickupError(false);
        if (!hasLoadedPickups) setPickupLoading(true);
      }

      try {
        const history = await getCustomerPickupHistory();
        if (!active) return;
        setNextPickup(getNextActivePickup(history));
        setPickupError(false);
        hasLoadedPickups = true;
      } catch (error) {
        console.error('[Home] Failed to load pickup history:', error);
        if (active) setPickupError(true);
      } finally {
        requestInFlight = false;
        if (active) setPickupLoading(false);
      }
    };

    pickupRefreshHandler.current = () => loadPickups(true);
    void loadPickups();
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') void loadPickups();
      },
    );

    return () => {
      active = false;
      pickupRefreshHandler.current = null;
      appStateSubscription.remove();
    };
  }, [authLoading, customerUid]));

  const refreshHome = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadCustomerProfile(true),
      pickupRefreshHandler.current?.() ?? Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [loadCustomerProfile]);

  const openNextPickup = (item: CustomerPickupHistoryItem) => {
    router.push({
      pathname: '/pickup-tracking',
      params: {
        pickupId: item.pickupId,
        address: item.pickupAddress ?? '',
        addressLabel: 'Pickup location',
        scheduledDate: item.scheduledDate ?? '',
        scheduledTime: item.scheduledTime ?? '',
        wasteType: item.wasteTypeName ?? '',
        bagSize: item.bagSizeLabel ?? '',
        quantity: item.quantity === null ? '' : String(item.quantity),
        estimatedWeightKg: item.estimatedWeightKg === null
          ? ''
          : String(item.estimatedWeightKg),
        twoStagePricing: item.pricingStage === 'awaiting_final_price' ||
          item.pricingStage === 'awaiting_customer_confirmation'
          ? 'true'
          : '',
        items: JSON.stringify(item.items ?? []),
        facilityName: item.facilityName ?? '',
        status: item.status,
      },
    });
  };

  const nextPickupStatusLabel = (item: CustomerPickupHistoryItem): string => {
    if (item.pricingStage === 'awaiting_final_price') {
      return 'Final price being calculated';
    }
    if (item.pricingStage === 'awaiting_customer_confirmation') {
      return 'Final price ready to review';
    }
    switch (item.status) {
      case 'pending': return 'Waiting for a rider';
      case 'accepted': return 'Rider assigned';
      case 'in_progress': return 'Pickup in progress';
      case 'awaiting_facility_receipt': return 'Awaiting facility receipt';
      default: return 'Pickup update';
    }
  };

  const nextPickupSchedule = nextPickup
    ? [
      nextPickup.scheduledDate || 'Date unavailable',
      nextPickup.scheduledTime
        ? formatPickupTime(nextPickup.scheduledTime)
        : '',
    ].filter(Boolean).join(' · ')
    : '';
  const nextPickupItems = nextPickup?.items?.length
    ? nextPickup.items
    : nextPickup
      ? [{
        wasteTypeId: '',
        wasteTypeName: nextPickup.wasteTypeName ?? 'Pickup request',
        bagSizeId: '',
        bagSizeLabel: nextPickup.bagSizeLabel ?? '',
        quantity: nextPickup.quantity ?? 0,
        estimatedWeightKg: nextPickup.estimatedWeightKg ?? 0,
      }]
      : [];

  useEffect(() => {
    void loadCustomerProfile();
    return () => {
      profileRequestSequence.current += 1;
      profileRequestInFlight.current = false;
      setRefreshing(false);
    };
  }, [loadCustomerProfile]);

  const { width: screenWidth } = useWindowDimensions();
  const adWidth = screenWidth - 40;

  const adListRef = useRef<FlatList<number>>(null);
  const [activeAdIndex, setActiveAdIndex] = useState(0);

  const ads = [0, 1];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAdIndex((current) => {
        const next = (current + 1) % ads.length;

        adListRef.current?.scrollToIndex({
          index: next,
          animated: true,
        });

        return next;
      });
    }, 9000);

    return () => clearInterval(timer);
  }, []);

  const handleScroll = (offsetY: number) => {
    const shouldShow = offsetY > 10;

    if (shouldShow === isStickyHeaderVisible.current) {
      return;
    }

    isStickyHeaderVisible.current = shouldShow;

    Animated.timing(stickyHeaderProgress, {
      toValue: shouldShow ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

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
        {/* Compact header appears when scrolling */}

        {isHomeRoute && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.stickyHeader,
              {
                opacity: stickyHeaderProgress,
                transform: [
                  {
                    translateY: stickyHeaderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              source={require('../assets/images/basurago-logo.png')}
              style={styles.stickyBrandLogo}
              resizeMode="contain"
              accessibilityLabel="BasuraGo logo"
            />
          </Animated.View>
        )}


        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshHome()}
              tintColor="#176744"
              colors={['#176744']}
            />
          }
          scrollEventThrottle={16}
          onScroll={(event) => {
            handleScroll(event.nativeEvent.contentOffset.y);
          }}
        >
          {refreshError ? (
            <Text accessibilityRole="alert" style={styles.refreshError}>
              {refreshError}
            </Text>
          ) : null}
          {/* Original large header scrolls normally */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require('../assets/images/basurago-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityLabel="BasuraGo logo"
              />
            </View>

            <View style={styles.greeting}>
              <Text style={styles.greetingEyebrow}>
                WELCOME TO BASURAGO
              </Text>

              <Text style={styles.greetingTitle}>
                Hello, {customerName}!
              </Text>

              <Text style={styles.greetingSubtitle}>
                Let's make your community cleaner.
              </Text>
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
                  <Image
                    source={require('../assets/images/basurago-truck-icon.png')}
                    style={styles.truckImage}
                    resizeMode="contain"
                    accessibilityLabel="BasuraGo collection truck"
                  />
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
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick access</Text>
              <Text style={styles.sectionSubtitle}>
                Your waste collection essentials.
              </Text>

              <View style={styles.quickGrid}>
                {/* My Orders */}
                <Pressable
                  style={styles.quickCard}
                  onPress={() => router.replace('/orders')}
                  accessibilityRole="button"
                  accessibilityLabel="Open My Orders"
                >
                  <View style={styles.quickIconGreen}>
                    <Image
                      source={require('../assets/images/order-icon.png')}
                      style={styles.quickAccessImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.quickTitle}>My Orders</Text>
                  <Text style={styles.quickDescription}>
                    Track your pickups
                  </Text>
                </Pressable>

                {/* Schedule */}
                <Pressable
                  style={styles.quickCard}
                  onPress={() => router.push('/schedule-pickup')}
                  accessibilityRole="button"
                  accessibilityLabel="Schedule a pickup"
                >
                  <View style={styles.quickIconMint}>
                    <Image
                      source={require('../assets/images/schedule-icon.png')}
                      style={styles.quickAccessImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.quickTitle}>Schedule</Text>
                  <Text style={styles.quickDescription}>
                    Plan a collection
                  </Text>
                </Pressable>

                {/* Waste Guide */}
                <Pressable
                  style={styles.quickCard}
                  onPress={() => router.push('/waste-guide')}
                  accessibilityRole="button"
                  accessibilityLabel="Open Waste Guide"
                >
                  <View style={styles.quickIconYellow}>
                    <Image
                      source={require('../assets/images/waste-guide-icon.png')}
                      style={styles.quickAccessImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.quickTitle}>Waste Guide</Text>
                  <Text style={styles.quickDescription}>
                    Learn how to sort
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Advertisement carousel */}
            <View style={styles.adSection}>
              <FlatList
                ref={adListRef}
                data={ads}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `basurago-ad-${item}`}
                getItemLayout={(_, index) => ({
                  length: adWidth,
                  offset: adWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / adWidth
                  );

                  setActiveAdIndex(index);
                }}
                renderItem={({ item }) => (
                  <Image
                    source={
                      item === 0
                        ? require('../assets/advertisements/ad-1.png')
                        : require('../assets/advertisements/ad-2.png')
                    }
                    style={[
                      styles.adImage,
                      { width: adWidth, height: adWidth * 9 / 16 },
                    ]}
                    resizeMode="contain"
                    accessibilityLabel={`BasuraGo advertisement ${item + 1}`}
                  />
                )}
              />

              <View style={styles.adIndicators}>
                {ads.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.adDot,
                      activeAdIndex === index && styles.adDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>
                  Your next pickup
                </Text>
                <Text style={styles.liveLabel}>YOUR ACTIVITY</Text>
              </View>

              {authLoading || pickupLoading ? (
                <View style={styles.pickupStateCard} accessibilityRole="progressbar">
                  <ActivityIndicator color="#176744" />
                  <Text style={styles.pickupStateText}>
                    Loading your next pickup…
                  </Text>
                </View>
              ) : pickupError && !nextPickup ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    We couldn’t load your pickups
                  </Text>
                  <Text style={styles.emptyDescription}>
                    Check your connection and try again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void pickupRefreshHandler.current?.()}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              ) : nextPickup ? (
                <View>
                  {pickupError ? (
                    <Text accessibilityRole="alert" style={styles.pickupWarning}>
                      Could not refresh pickup details. Showing the last loaded
                      information.
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open your next pickup details"
                    onPress={() => openNextPickup(nextPickup)}
                    style={({ pressed }) => [
                      styles.pickupCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.pickupCardTop}>
                      <Text style={styles.pickupStatus}>
                        {nextPickupStatusLabel(nextPickup)}
                      </Text>
                      <Text style={styles.pickupArrow}>›</Text>
                    </View>
                    <Text style={styles.pickupSchedule}>
                      {nextPickupSchedule}
                    </Text>
                    {nextPickupItems.slice(0, 2).map((item, index) => (
                      <Text
                        key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`}
                        style={styles.pickupWaste}
                      >
                        {item.wasteTypeName}
                        {item.quantity > 0
                          ? ` · ${item.quantity} × ${item.bagSizeLabel}`
                          : ''}
                      </Text>
                    ))}
                    {nextPickupItems.length > 2 ? (
                      <Text style={styles.pickupMore}>
                        + {nextPickupItems.length - 2} more waste types
                      </Text>
                    ) : null}
                    <Text style={styles.pickupAddress}>
                      {nextPickup.pickupAddress || 'Pickup address unavailable'}
                    </Text>
                    <Text style={styles.pickupLink}>
                      View pickup details
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyCard}>
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
              )}
            </View>

            <View style={styles.ecoBanner}>
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
