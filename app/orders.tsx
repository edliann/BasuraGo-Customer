import {useCallback, useRef, useState} from 'react';
import {router, useFocusEffect} from 'expo-router';
import {
  AppState,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import BottomNav from '@/components/BottomNav';
import {useAuth} from '@/contexts/AuthContext';
import {goBackOrReplace} from '@/navigation/back';
import {
  getPickupCancellationLabel,
  getCustomerPickupHistory,
  type CustomerPickupHistoryItem,
} from '@/services/pickups';
import {formatPickupTime} from '@/utils/pickupTime';

const PICKUP_STATUS_FILTERS = [
  {value: 'all', label: 'All'},
  {value: 'pending', label: 'Waiting for a rider'},
  {value: 'accepted', label: 'Rider assigned'},
  {value: 'in_progress', label: 'In progress'},
  {value: 'awaiting_facility_receipt', label: 'Awaiting receipt'},
  {value: 'completed', label: 'Completed'},
  {value: 'cancelled', label: 'Cancelled'},
  {value: 'rejected', label: 'Needs attention'},
] as const;

type PickupStatusFilter = typeof PICKUP_STATUS_FILTERS[number]['value'];

const INITIAL_VISIBLE_PICKUPS = 5;
const PICKUP_PAGE_SIZE = 5;

function pickupStatusLabel(
  item: CustomerPickupHistoryItem,
  customerUid: string | null,
): string {
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
    case 'awaiting_facility_receipt':
      return 'Awaiting facility receipt';
    case 'completed': return 'Completed';
    case 'cancelled':
      return getPickupCancellationLabel(item.cancelledBy, customerUid);
    case 'canceled':
      return 'Cancelled';
    case 'rejected': return 'Needs attention';
    default: return 'Status updated';
  }
}

function formatPickupPrice(item: CustomerPickupHistoryItem): string | null {
  const amount = item.acceptedAmountCentavos;
  if (amount === null || item.currency !== 'PHP') return null;
  return `₱${(amount / 100).toFixed(2)}`;
}

function formatPickupSchedule(item: CustomerPickupHistoryItem): string {
  const date = item.scheduledDate || 'Date unavailable';
  const time = item.scheduledTime ? formatPickupTime(item.scheduledTime) : '';
  return time ? `${date} · ${time}` : date;
}

function openTracking(item: CustomerPickupHistoryItem): void {
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
      estimatedWeightKg: item.estimatedWeightKg === null ?
        '' : String(item.estimatedWeightKg),
      twoStagePricing: item.pricingStage === 'awaiting_final_price' ||
        item.pricingStage === 'awaiting_customer_confirmation'
        ? 'true'
        : '',
      items: JSON.stringify(item.items ?? []),
      facilityName: item.facilityName ?? '',
      status: item.status,
    },
  });
}

export default function OrdersScreen() {
  const {firebaseUser, loading: authLoading} = useAuth();
  const [pickups, setPickups] = useState<CustomerPickupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [statusFilter, setStatusFilter] = useState<PickupStatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PICKUPS);
  const refreshHandler = useRef<(() => void) | null>(null);
  const customerUid = firebaseUser?.uid ?? null;

  useFocusEffect(useCallback(() => {
    if (authLoading) return undefined;
    if (!customerUid) {
      setPickups([]);
      setLoading(false);
      setError(true);
      return undefined;
    }

    let active = true;
    let loadingRequest = false;
    let initialRequest = true;

    const refresh = async (manual = false) => {
      if (
        !active ||
        loadingRequest ||
        AppState.currentState !== 'active'
      ) return;
      loadingRequest = true;
      if (manual) {
        setRefreshing(true);
        setRefreshError('');
      }
      if (initialRequest) {
        setLoading(true);
        setError(false);
      }
      try {
        const result = await getCustomerPickupHistory();
        if (active) {
          setPickups(result);
          setError(false);
          if (manual) setRefreshError('');
        }
      } catch (cause: unknown) {
        if (__DEV__) {
          const details = typeof cause === 'object' && cause !== null
            ? cause as {code?: unknown; message?: unknown}
            : {};
          console.error('[Pickup history] Failed to load', {
            code: details.code,
            message: details.message,
          });
        }
        if (active) {
          setError(true);
          if (manual) {
            setRefreshError(
              'Pickup history could not be refreshed. Showing the last loaded data.',
            );
          }
        }
      } finally {
        loadingRequest = false;
        if (active && manual) setRefreshing(false);
        if (active && initialRequest) setLoading(false);
        initialRequest = false;
      }
    };

    refreshHandler.current = () => void refresh(true);
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);

    return () => {
      active = false;
      refreshHandler.current = null;
      setRefreshing(false);
      clearInterval(timer);
    };
  }, [authLoading, customerUid, retryCount]));

  const matchingPickups = pickups
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .map((item, index) => ({
      item,
      index,
      createdAtMs: item.createdAt ? Date.parse(item.createdAt) : NaN,
    }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.createdAtMs);
      const rightValid = Number.isFinite(right.createdAtMs);
      if (leftValid && rightValid) {
        return right.createdAtMs - left.createdAtMs || left.index - right.index;
      }
      if (leftValid) return -1;
      if (rightValid) return 1;
      return left.index - right.index;
    })
    .map(({item}) => item);
  const visiblePickups = matchingPickups.slice(0, visibleCount);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshHandler.current?.()}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace('/home')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹  Back</Text>
          </Pressable>

          <Text style={styles.eyebrow}>YOUR ACTIVITY</Text>
          <Text style={styles.title}>My pickups</Text>
          <Text style={styles.subtitle}>
            View the status and details of your pickup requests.
          </Text>

          {loading || authLoading ? (
            <View style={styles.stateCard} accessibilityRole="progressbar">
              <ActivityIndicator color="#176744" />
              <Text style={styles.stateTitle}>Loading your pickups…</Text>
            </View>
          ) : error && pickups.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>
                We couldn’t load your pickup history
              </Text>
              <Text style={styles.stateBody}>
                Check your connection and try again. Your existing requests
                have not been changed.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetryCount((value) => value + 1)}
                style={({pressed}) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : pickups.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>No pickups yet</Text>
              <Text style={styles.stateBody}>
                Pickup requests you schedule will appear here.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/schedule-pickup')}
                style={({pressed}) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Schedule a pickup</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickupList}>
              {error ? (
                <Text accessibilityRole="alert" style={styles.refreshWarning}>
                  Could not refresh pickup statuses. Showing the last loaded
                  information; check your connection and retry.
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                keyboardShouldPersistTaps="handled"
                accessibilityLabel="Filter pickups by status"
              >
                {PICKUP_STATUS_FILTERS.map((filter) => {
                  const selected = statusFilter === filter.value;
                  return (
                    <Pressable
                      key={filter.value}
                      accessibilityRole="button"
                      accessibilityState={{selected}}
                      onPress={() => {
                        setStatusFilter(filter.value);
                        setVisibleCount(INITIAL_VISIBLE_PICKUPS);
                      }}
                      style={({pressed}) => [
                        styles.filterChip,
                        selected && styles.filterChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected && styles.filterChipTextSelected,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.showingCount}>
                Showing {visiblePickups.length} of {matchingPickups.length}{' '}
                {matchingPickups.length === 1 ? 'request' : 'requests'}
              </Text>
              {visiblePickups.length === 0 ? (
                <View style={styles.stateCard}>
                  <Text style={styles.stateTitle}>No matching pickups</Text>
                  <Text style={styles.stateBody}>
                    There are no requests with this status yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.pickupSection}>
                  {visiblePickups.map((item) => {
                    const price = formatPickupPrice(item);
                    return (
                      <View key={item.pickupId} style={styles.pickupCard}>
                        <View style={styles.cardTop}>
                          <View style={styles.statusPill}>
                            <Text style={styles.statusText}>
                              {pickupStatusLabel(item, customerUid)}
                            </Text>
                          </View>
                          {price && <Text style={styles.price}>{price}</Text>}
                        </View>
                        {(item.items?.length ? item.items : [{
                          wasteTypeId: '',
                          wasteTypeName: item.wasteTypeName ?? 'Pickup request',
                          bagSizeId: '',
                          bagSizeLabel: item.bagSizeLabel ?? '',
                          quantity: item.quantity ?? 0,
                          estimatedWeightKg: item.estimatedWeightKg ?? 0,
                        }]).map((line, index) => (
                          <Text key={`${line.wasteTypeId}:${line.bagSizeId}:${index}`} style={styles.wasteType}>
                            {line.wasteTypeName}
                          </Text>
                        ))}
                        <Text style={styles.address}>
                          {item.pickupAddress || 'Pickup address unavailable'}
                        </Text>
                        <Text style={styles.schedule}>
                          {formatPickupSchedule(item)}
                        </Text>
                        {item.status === 'cancelled' &&
                        item.cancellationReason?.trim() ? (
                          <Text style={styles.extraDetail}>
                            Reason: {item.cancellationReason.trim()}
                          </Text>
                        ) : null}
                        {item.status === 'awaiting_facility_receipt' ? (
                          <Text style={styles.extraDetail}>
                            Collection is complete. Facility staff must record the
                            receipt before this pickup is completed.
                          </Text>
                        ) : null}
                        {(item.items?.length ? item.items : [{
                          wasteTypeId: '',
                          wasteTypeName: item.wasteTypeName ?? '',
                          bagSizeId: '',
                          bagSizeLabel: item.bagSizeLabel ?? '',
                          quantity: item.quantity ?? 0,
                          estimatedWeightKg: item.estimatedWeightKg ?? 0,
                        }]).map((line, index) => (
                          <Text key={`${line.wasteTypeId}:${line.bagSizeId}:${index}`} style={styles.extraDetail}>
                            {line.quantity} × {line.bagSizeLabel} · {line.estimatedWeightKg} kg estimated
                          </Text>
                        ))}
                        {item.pricingVersion ? (
                          <Text style={styles.extraDetail}>
                            Accepted price version: {item.pricingVersion}
                          </Text>
                        ) : null}
                        {item.breakdown?.basePickupFeeCentavos !== null &&
                        item.breakdown?.basePickupFeeCentavos !== undefined ? (
                          <Text style={styles.extraDetail}>
                            Base fee · ₱{(item.breakdown.basePickupFeeCentavos / 100).toFixed(2)}
                          </Text>
                        ) : null}
                        {item.breakdown?.distanceCentavos !== null &&
                        item.breakdown?.distanceCentavos !== undefined &&
                        item.breakdown.distanceCentavos > 0 ? (
                          <Text style={styles.extraDetail}>
                            {item.breakdown.facilityTransportDistanceMeters !== null
                              ? `Facility transport · ${(item.breakdown.facilityTransportDistanceMeters / 1000).toFixed(2)} km`
                              : item.breakdown.riderDistanceMeters !== null
                                ? `Legacy Rider route · ${(item.breakdown.riderDistanceMeters / 1000).toFixed(2)} km`
                                : 'Facility transport distance unavailable'}
                            {item.breakdown.facilityTransportTierIndex !== null
                              ? ` · tier ${item.breakdown.facilityTransportTierIndex + 1}`
                              : item.breakdown.riderDistanceTierIndex !== null
                                ? ` · legacy tier ${item.breakdown.riderDistanceTierIndex + 1}`
                                : ''}
                            · ₱{(item.breakdown.distanceCentavos / 100).toFixed(2)}
                          </Text>
                        ) : null}
                        {item.breakdown?.loadSurchargeCentavos !== null &&
                        item.breakdown?.loadSurchargeCentavos !== undefined ? (
                          <Text style={styles.extraDetail}>
                            Load surcharge · ₱{(item.breakdown.loadSurchargeCentavos / 100).toFixed(2)}
                          </Text>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Track ${item.wasteTypeName || 'pickup'} request`}
                          onPress={() => openTracking(item)}
                          style={({pressed}) => [
                            styles.trackButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.trackButtonText}>View pickup</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
              {visiblePickups.length < matchingPickups.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleCount((count) => count + PICKUP_PAGE_SIZE)}
                  style={({pressed}) => [
                    styles.viewMoreButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.viewMoreButtonText}>View More</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </ScrollView>
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F5F8F6'},
  container: {flex: 1},
  content: {flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 130},
  backButton: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12},
  backText: {color: '#176744', fontSize: 15, fontWeight: '700'},
  eyebrow: {color: '#38B84A', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 22},
  title: {color: '#173D2C', fontSize: 29, fontWeight: '800', marginTop: 5},
  subtitle: {color: '#64736A', fontSize: 14, lineHeight: 21, marginTop: 7},
  stateCard: {alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE8DE', borderRadius: 20, borderWidth: 1, marginTop: 22, padding: 22},
  stateTitle: {color: '#173D2C', fontSize: 17, fontWeight: '800', marginTop: 8, textAlign: 'center'},
  stateBody: {color: '#64736A', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center'},
  refreshError: {color: '#A23B32', fontSize: 13, lineHeight: 19, marginBottom: 10},
  primaryButton: {alignItems: 'center', backgroundColor: '#176744', borderRadius: 12, justifyContent: 'center', marginTop: 18, minHeight: 48, paddingHorizontal: 18},
  primaryButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
  pickupList: {gap: 14, marginTop: 22},
  pickupSection: {gap: 10},
  filterRow: {gap: 8, paddingRight: 4},
  filterChip: {backgroundColor: '#FFFFFF', borderColor: '#C9DCCF', borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14},
  filterChipSelected: {backgroundColor: '#176744', borderColor: '#176744'},
  filterChipText: {color: '#345245', fontSize: 13, fontWeight: '700'},
  filterChipTextSelected: {color: '#FFFFFF'},
  showingCount: {color: '#64736A', fontSize: 12, marginTop: -4},
  viewMoreButton: {alignItems: 'center', borderColor: '#176744', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 46, marginTop: 4},
  viewMoreButtonText: {color: '#176744', fontSize: 14, fontWeight: '800'},
  refreshWarning: {color: '#8A5A13', fontSize: 13, lineHeight: 19},
  pickupCard: {backgroundColor: '#FFFFFF', borderColor: '#DCE8DE', borderRadius: 20, borderWidth: 1, padding: 18},
  cardTop: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  statusPill: {backgroundColor: '#E8F5EC', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6},
  statusText: {color: '#176744', fontSize: 12, fontWeight: '700'},
  price: {color: '#173D2C', fontSize: 15, fontWeight: '800'},
  wasteType: {color: '#173D2C', fontSize: 18, fontWeight: '800', marginTop: 14},
  address: {color: '#46574D', fontSize: 14, lineHeight: 20, marginTop: 6},
  schedule: {color: '#64736A', fontSize: 13, fontWeight: '600', marginTop: 10},
  extraDetail: {color: '#64736A', fontSize: 13, marginTop: 6},
  trackButton: {alignItems: 'center', borderColor: '#176744', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 44},
  trackButtonText: {color: '#176744', fontSize: 14, fontWeight: '700'},
  pressed: {opacity: 0.78},
});
