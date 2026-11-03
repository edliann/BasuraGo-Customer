import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import {
  Alert,
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RemixIcon from 'react-native-remix-icon';
import { useAuth } from '@/contexts/AuthContext';
import {
  cancelPickupRequest,
  confirmPickupFinalPrice,
  declinePickupFinalPrice,
  getFinalPriceResolutionMessage,
  getPickupRiderContact,
  getPickupTracking,
  getCustomerPickupHistory,
  getPickupCancellationLabel,
  resolvePickupFinalPrice,
  type CustomerPickupHistoryItem,
  type FinalPickupPriceQuote,
  type PickupRiderContact,
  type PickupTrackingSnapshot,
} from '@/services/pickups';
import { goBackOrReplace } from '@/navigation/back';
import {getPickupActionEligibility} from '@/utils/pickupActionEligibility';
import { formatPesoCentavos } from '@/utils/pricing';

type TrackingParams = {
  pickupId?: string | string[];
  address?: string | string[];
  addressLabel?: string | string[];
  latitude?: string | string[];
  longitude?: string | string[];
  scheduledDate?: string | string[];
  scheduledTime?: string | string[];
  wasteType?: string | string[];
  bagSize?: string | string[];
  quantity?: string | string[];
  estimatedWeightKg?: string | string[];
  twoStagePricing?: string | string[];
  items?: string | string[];
  facilityName?: string | string[];
  facilityAddress?: string | string[];
  status?: string | string[];
};

const GOOGLE_MAP_STYLE = JSON.stringify([
  {
    elementType: 'geometry',
    stylers: [{ color: '#f1f3f1' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#606861' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f7f8f7' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#dfe4df' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#e8ebe8' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#e5ebe5' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e4e9e6' }],
  },
]);

const MAP_FRAME_HEIGHT = 290;
const MAP_FIT_PADDING_RATIO = 0.65;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

interface TrackingItem {
  wasteTypeName: string;
  bagSizeLabel: string;
  quantity: number;
  estimatedWeightKg: number;
}

function parseTrackingItems(value: string | string[] | undefined): TrackingItem[] {
  const serialized = first(value);
  if (!serialized || serialized.length > 4000) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || parsed.length > 20) return [];
    return parsed.flatMap((entry): TrackingItem[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const item = entry as Record<string, unknown>;
      if (
        typeof item.wasteTypeName !== 'string' ||
        typeof item.bagSizeLabel !== 'string' ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) || item.quantity < 1 ||
        typeof item.estimatedWeightKg !== 'number' ||
        !Number.isFinite(item.estimatedWeightKg) || item.estimatedWeightKg < 0
      ) return [];
      return [{
        wasteTypeName: item.wasteTypeName,
        bagSizeLabel: item.bagSizeLabel,
        quantity: item.quantity,
        estimatedWeightKg: item.estimatedWeightKg,
      }];
    });
  } catch {
    return [];
  }
}

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinate(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;
}

function cameraPositionToFitLocations(
  destination: { latitude: number; longitude: number },
  rider: { latitude: number; longitude: number },
) {
  let longitudeDelta = rider.longitude - destination.longitude;
  if (longitudeDelta > 180) longitudeDelta -= 360;
  if (longitudeDelta < -180) longitudeDelta += 360;

  const latitude = (destination.latitude + rider.latitude) / 2;
  const longitude =
    ((destination.longitude + longitudeDelta / 2 + 540) % 360) - 180;
  const longitudeScale = Math.max(
    0.01,
    Math.cos((latitude * Math.PI) / 180),
  );
  const latitudeSpanMeters =
    Math.abs(rider.latitude - destination.latitude) * 111_320;
  const longitudeSpanMeters =
    Math.abs(longitudeDelta) * 111_320 * longitudeScale;
  const spanMeters = Math.max(latitudeSpanMeters, longitudeSpanMeters);
  const zoom = spanMeters === 0
    ? 15
    : Math.max(
        3,
        Math.min(
          18,
          Math.log2(
            (156_543.03392 * longitudeScale * MAP_FRAME_HEIGHT *
              MAP_FIT_PADDING_RATIO) /
              spanMeters,
          ),
        ),
      );

  return { coordinates: { latitude, longitude }, zoom };
}

function formatPeso(centavos: string): string {
  const amount = finiteNumber(centavos);
  if (amount === null) return '—';
  return formatPesoCentavos(amount);
}

function parsePriceBreakdown(
  value: string | string[] | undefined,
): FinalPickupPriceQuote['breakdown'] | null {
  const serialized = first(value);
  if (!serialized || serialized.length > 4000) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const distanceCentavos = record.distanceCentavos;
    const totalCentavos = record.totalCentavos;
    if (
      typeof distanceCentavos !== 'number' ||
      !Number.isSafeInteger(distanceCentavos) ||
      distanceCentavos < 0 ||
      typeof totalCentavos !== 'number' ||
      !Number.isSafeInteger(totalCentavos) ||
      totalCentavos < 0
    ) return null;
    return {
      distanceCentavos,
      totalCentavos,
      loadSurchargeCentavos:
        typeof record.loadSurchargeCentavos === 'number' &&
        Number.isSafeInteger(record.loadSurchargeCentavos)
          ? record.loadSurchargeCentavos
          : null,
      ...(typeof record.basePickupFeeCentavos === 'number'
        ? { basePickupFeeCentavos: record.basePickupFeeCentavos }
        : {}),
      ...(typeof record.wasteTypeFeesCentavos === 'number' &&
      Number.isSafeInteger(record.wasteTypeFeesCentavos) &&
      record.wasteTypeFeesCentavos >= 0
        ? { wasteTypeFeesCentavos: record.wasteTypeFeesCentavos }
        : {}),
      ...(typeof record.minimumBookingPriceCentavos === 'number'
        ? { minimumBookingPriceCentavos: record.minimumBookingPriceCentavos }
        : {}),
      ...(typeof record.baseAmountCentavos === 'number'
        ? { baseAmountCentavos: record.baseAmountCentavos }
        : {}),
      ...(record.loadCategory === 'none' ||
      record.loadCategory === 'medium' ||
      record.loadCategory === 'large'
        ? { loadCategory: record.loadCategory }
        : {}),
      ...(typeof record.facilityTransportDistanceMeters === 'number'
        ? { facilityTransportDistanceMeters: record.facilityTransportDistanceMeters }
        : {}),
      ...(typeof record.facilityTransportTierIndex === 'number'
        ? { facilityTransportTierIndex: record.facilityTransportTierIndex }
        : {}),
      ...(typeof record.facilityTransportLowerBoundKm === 'number'
        ? { facilityTransportLowerBoundKm: record.facilityTransportLowerBoundKm }
        : {}),
      ...(typeof record.facilityTransportUpperBoundKm === 'number' ||
      record.facilityTransportUpperBoundKm === null
        ? { facilityTransportUpperBoundKm: record.facilityTransportUpperBoundKm }
        : {}),
      ...(typeof record.facilityId === 'string'
        ? { facilityId: record.facilityId }
        : {}),
      ...(typeof record.riderDistanceMeters === 'number'
        ? { riderDistanceMeters: record.riderDistanceMeters }
        : {}),
      ...(typeof record.riderDistanceTierIndex === 'number'
        ? { riderDistanceTierIndex: record.riderDistanceTierIndex }
        : {}),
      ...(typeof record.riderDistanceLowerBoundKm === 'number'
        ? { riderDistanceLowerBoundKm: record.riderDistanceLowerBoundKm }
        : {}),
      ...(typeof record.riderDistanceUpperBoundKm === 'number' ||
      record.riderDistanceUpperBoundKm === null
        ? { riderDistanceUpperBoundKm: record.riderDistanceUpperBoundKm }
        : {}),
      ...(typeof record.legacyWasteTypeFeeCentavos === 'number'
        ? { legacyWasteTypeFeeCentavos: record.legacyWasteTypeFeeCentavos }
        : {}),
    };
  } catch {
    return null;
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'pending': return 'Waiting for rider';
    case 'accepted': return 'Rider assigned';
    case 'in_progress': return 'Pickup in progress';
    case 'awaiting_facility_receipt':
      return 'Awaiting facility receipt';
    case 'completed': return 'Completed';
    case 'cancelled':
    case 'canceled': return 'Cancelled';
    default: return 'Status unavailable';
  }
}

export default function PickupTrackingScreen() {
  const params = useLocalSearchParams<TrackingParams>();
  const {firebaseUser} = useAuth();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);
  const [mapRetryCount, setMapRetryCount] = useState(0);
  const [tracking, setTracking] = useState<PickupTrackingSnapshot | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [riderContactState, setRiderContactState] = useState<{
    pickupId: string;
    status: string;
    loading: boolean;
    contact: PickupRiderContact | null;
    error: boolean;
  } | null>(null);
  const riderContactRequestSequence = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshHandler = useRef<(() => void) | null>(null);
  const [historyItem, setHistoryItem] =
    useState<CustomerPickupHistoryItem | null>(null);
  const historyItemRef = useRef<{
    pickupId: string;
    item: CustomerPickupHistoryItem | null;
  } | null>(null);
  const [priceHistoryError, setPriceHistoryError] = useState('');
  const [pickupEligibilityVerified, setPickupEligibilityVerified] =
    useState(false);
  const pickupEligibilityRef = useRef<{
    pickupId: string;
    verified: boolean;
    status: string;
    pricingStage: string | null;
    acceptedAmountCentavos: number | null;
    hasHistoryRecord: boolean;
  } | null>(null);
  const [finalPriceState, setFinalPriceState] = useState<{
    pickupId: string;
    quote: FinalPickupPriceQuote;
  } | null>(null);
  const [finalPriceError, setFinalPriceError] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [finalPriceLoading, setFinalPriceLoading] = useState(false);
  const [finalPriceActionPending, setFinalPriceActionPending] = useState(false);
  const [finalPriceConfirmed, setFinalPriceConfirmed] = useState(false);
  const [finalPriceDeclined, setFinalPriceDeclined] = useState(false);
  const finalPriceRef = useRef<{
    pickupId: string;
    quote: FinalPickupPriceQuote;
  } | null>(null);
  const finalPriceRequestInFlight = useRef(false);
  const finalPriceRequestSequence = useRef(0);
  const finalPriceActionInFlight = useRef(false);
  const finalPriceNotifiedQuoteId = useRef<string | null>(null);
  const finalPriceLastAttempt = useRef<{pickupId: string; at: number} | null>(
    null,
  );
  const verifiedPricingWorkflow = useRef<{
    pickupId: string;
    requiresFinalPrice: boolean;
  } | null>(null);
  const screenFocusedRef = useRef(false);
  const screenEpochRef = useRef(0);
  const trackingRefreshSequence = useRef(0);
  const mapLoadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleMapRef = useRef<GoogleMaps.MapView | null>(null);
  const [cameraReadyMapKey, setCameraReadyMapKey] = useState<string | null>(null);
  const cameraInteraction = useRef({
    mapKey: '',
    initialCameraMoveObserved: false,
    userMovedMap: false,
    riderCameraSet: false,
  });

  const pickupId = first(params.pickupId);
  const pickupIdRef = useRef(pickupId);
  pickupIdRef.current = pickupId;

  const updatePickupEligibility = (snapshot: {
    pickupId: string;
    verified: boolean;
    status: string;
    pricingStage: string | null;
    acceptedAmountCentavos: number | null;
    hasHistoryRecord: boolean;
  }) => {
    pickupEligibilityRef.current = snapshot;
    setPickupEligibilityVerified(snapshot.verified);
  };

  const isCurrentPickupOperation = (
    expectedPickupId: string,
    expectedEpoch: number,
  ) => screenFocusedRef.current &&
    pickupIdRef.current === expectedPickupId &&
    screenEpochRef.current === expectedEpoch;

  const clearFinalPriceQuote = () => {
    finalPriceRequestSequence.current += 1;
    finalPriceRequestInFlight.current = false;
    finalPriceRef.current = null;
    finalPriceNotifiedQuoteId.current = null;
    finalPriceLastAttempt.current = null;
    setFinalPriceState(null);
    setFinalPriceLoading(false);
  };

  const address = first(params.address);
  const addressLabel = first(params.addressLabel) || 'Pickup location';
  const trackingItems = parseTrackingItems(params.items);
  const twoStagePricing = first(params.twoStagePricing) === 'true' ||
    historyItem?.pricingStage === 'awaiting_final_price' ||
    historyItem?.pricingStage === 'awaiting_customer_confirmation';
  const savedPriceBreakdown = historyItem?.breakdown
    ? parsePriceBreakdown(JSON.stringify(historyItem.breakdown))
    : null;
  const historyAmount = historyItem?.acceptedAmountCentavos ?? null;

  useEffect(() => {
    screenEpochRef.current += 1;
    trackingRefreshSequence.current += 1;
    finalPriceRequestSequence.current += 1;
    finalPriceRequestInFlight.current = false;
    finalPriceActionInFlight.current = false;
    setFinalPriceActionPending(false);
    historyItemRef.current = {pickupId, item: null};
    updatePickupEligibility({
      pickupId,
      verified: false,
      status: '',
      pricingStage: null,
      acceptedAmountCentavos: null,
      hasHistoryRecord: false,
    });
    riderContactRequestSequence.current += 1;
    setTracking(null);
    setRiderContactState(null);
    setFinalPriceState(null);
    finalPriceRef.current = null;
    finalPriceNotifiedQuoteId.current = null;
    finalPriceLastAttempt.current = null;
    verifiedPricingWorkflow.current = null;
    setHistoryItem(null);
    setPriceHistoryError('');
    setFinalPriceError('');
    setCancellationError('');
    setFinalPriceConfirmed(false);
    setFinalPriceDeclined(false);
  }, [pickupId]);

  useEffect(() => {
    if (
      tracking?.status === 'accepted' ||
      tracking?.status === 'in_progress' ||
      tracking?.status === 'awaiting_facility_receipt'
    ) return;
    riderContactRequestSequence.current += 1;
    setRiderContactState(null);
  }, [pickupId, tracking?.status]);

  const refreshPricingHistory = useCallback(async (
    isCurrent: () => boolean = () =>
      screenFocusedRef.current && pickupIdRef.current === pickupId,
  ): Promise<boolean> => {
    if (!pickupId) return false;
    try {
      const pickups = await getCustomerPickupHistory();
      if (!isCurrent()) return false;
      const item = pickups.find((pickup) => pickup.pickupId === pickupId) ?? null;
      const requiresFinalPrice = item?.acceptedAmountCentavos === null &&
        (
          item.pricingStage === 'awaiting_final_price' ||
          item.pricingStage === 'awaiting_customer_confirmation' ||
          item.status === 'accepted'
        );
      setHistoryItem(item);
      historyItemRef.current = {pickupId, item};
      setPriceHistoryError('');
      verifiedPricingWorkflow.current = {pickupId, requiresFinalPrice};
      const currentEligibility = pickupEligibilityRef.current;
      if (
        currentEligibility?.pickupId === pickupId &&
        currentEligibility.verified
      ) {
        const updatedEligibility = getPickupActionEligibility(
          currentEligibility.status,
          item?.pricingStage ?? null,
          item?.acceptedAmountCentavos ?? null,
          item !== null,
        );
        updatePickupEligibility({
          pickupId,
          verified: true,
          status: currentEligibility.status,
          pricingStage: item?.pricingStage ?? null,
          acceptedAmountCentavos: item?.acceptedAmountCentavos ?? null,
          hasHistoryRecord: item !== null,
        });
        if (!updatedEligibility.canReviewFinalPrice) {
          clearFinalPriceQuote();
        }
      }
      return requiresFinalPrice;
    } catch (error) {
      if (!isCurrent()) return false;
      verifiedPricingWorkflow.current = {
        pickupId,
        requiresFinalPrice: false,
      };
      const currentEligibility = pickupEligibilityRef.current;
      updatePickupEligibility({
        pickupId,
        verified: false,
        status: currentEligibility?.pickupId === pickupId
          ? currentEligibility.status
          : '',
        pricingStage: currentEligibility?.pickupId === pickupId
          ? currentEligibility.pricingStage
          : null,
        acceptedAmountCentavos: currentEligibility?.pickupId === pickupId
          ? currentEligibility.acceptedAmountCentavos
          : null,
        hasHistoryRecord: currentEligibility?.pickupId === pickupId
          ? currentEligibility.hasHistoryRecord
          : false,
      });
      setPriceHistoryError(
        'Could not verify the pickup price status. Check your connection and retry.',
      );
      clearFinalPriceQuote();
      setTrackingError(
        'Could not verify the current pickup status. Refresh before taking action.',
      );
      throw error;
    }
  }, [pickupId]);

  const requestFinalPrice = useCallback(async (force = false) => {
    const eligibility = pickupEligibilityRef.current;
    if (
      !pickupId ||
      !screenFocusedRef.current ||
      !eligibility?.verified ||
      eligibility.pickupId !== pickupId ||
      !getPickupActionEligibility(
        eligibility.status,
        eligibility.pricingStage,
        eligibility.acceptedAmountCentavos,
        eligibility.hasHistoryRecord,
      ).canReviewFinalPrice ||
      finalPriceRequestInFlight.current ||
      finalPriceRef.current?.pickupId === pickupId
    ) return;
    const expectedEpoch = screenEpochRef.current;
    const requestSequence = ++finalPriceRequestSequence.current;
    const isCurrentRequest = () =>
      requestSequence === finalPriceRequestSequence.current &&
      isCurrentPickupOperation(pickupId, expectedEpoch);
    const lastAttempt = finalPriceLastAttempt.current;
    if (
      !force &&
      lastAttempt?.pickupId === pickupId &&
      Date.now() - lastAttempt.at < 60_000
    ) return;
    finalPriceRequestInFlight.current = true;
    setFinalPriceLoading(true);
    setFinalPriceError('');
    try {
      if (
        verifiedPricingWorkflow.current?.pickupId !== pickupId ||
        !verifiedPricingWorkflow.current.requiresFinalPrice
      ) {
        const requiresFinalPrice = await refreshPricingHistory(
          isCurrentRequest,
        );
        if (!isCurrentRequest()) return;
        if (!requiresFinalPrice) {
          setFinalPriceError(
            'The final price is not ready yet. Refresh after the assigned facility is set.',
          );
          return;
        }
      }
      finalPriceLastAttempt.current = {pickupId, at: Date.now()};
      const quote = await resolvePickupFinalPrice(pickupId);
      const latestEligibility = pickupEligibilityRef.current;
      if (
        isCurrentRequest() &&
        latestEligibility?.verified &&
        latestEligibility.pickupId === pickupId &&
        getPickupActionEligibility(
          latestEligibility.status,
          latestEligibility.pricingStage,
          latestEligibility.acceptedAmountCentavos,
          latestEligibility.hasHistoryRecord,
        ).canReviewFinalPrice
      ) {
        const next = {pickupId, quote};
        finalPriceRef.current = next;
        setFinalPriceState(next);
        if (finalPriceNotifiedQuoteId.current !== quote.quoteId) {
          finalPriceNotifiedQuoteId.current = quote.quoteId;
          Alert.alert(
            'Final price ready',
            'Your final price is ready to review. Confirm or decline it before collection begins.',
          );
        }
      }
    } catch (error) {
      if (isCurrentRequest()) {
        setFinalPriceError(getFinalPriceResolutionMessage(error));
      }
    } finally {
      if (requestSequence === finalPriceRequestSequence.current) {
        finalPriceRequestInFlight.current = false;
        setFinalPriceLoading(false);
      }
    }
  }, [pickupId, refreshPricingHistory]);

  const reconcileFailedPickupAction = useCallback(async (
    expectedPickupId: string,
    expectedEpoch: number,
  ): Promise<void> => {
    if (!isCurrentPickupOperation(expectedPickupId, expectedEpoch)) return;

    const previous = pickupEligibilityRef.current;
    updatePickupEligibility({
      pickupId: expectedPickupId,
      verified: false,
      status: previous?.pickupId === expectedPickupId
        ? previous.status
        : '',
      pricingStage: previous?.pickupId === expectedPickupId
        ? previous.pricingStage
        : null,
      acceptedAmountCentavos:
        previous?.pickupId === expectedPickupId
          ? previous.acceptedAmountCentavos
          : null,
      hasHistoryRecord:
        previous?.pickupId === expectedPickupId
          ? previous.hasHistoryRecord
          : false,
    });
    clearFinalPriceQuote();
    setTrackingError(
      'Refreshing the pickup status and price eligibility…',
    );

    const requestSequence = ++trackingRefreshSequence.current;
    const isCurrentRequest = () =>
      requestSequence === trackingRefreshSequence.current &&
      isCurrentPickupOperation(expectedPickupId, expectedEpoch);
    try {
      const [nextTracking, pickups] = await Promise.all([
        getPickupTracking(expectedPickupId),
        getCustomerPickupHistory(),
      ]);
      if (!isCurrentRequest()) return;

      const item =
        pickups.find((pickup) => pickup.pickupId === expectedPickupId) ?? null;
      const eligibility = getPickupActionEligibility(
        nextTracking.status,
        item?.pricingStage ?? null,
        item?.acceptedAmountCentavos ?? null,
        item !== null,
      );

      setTracking(nextTracking);
      setHistoryItem(item);
      historyItemRef.current = {pickupId: expectedPickupId, item};
      setPriceHistoryError('');
      setTrackingError('');
      verifiedPricingWorkflow.current = {
        pickupId: expectedPickupId,
        requiresFinalPrice: eligibility.canReviewFinalPrice,
      };
      updatePickupEligibility({
        pickupId: expectedPickupId,
        verified: true,
        status: nextTracking.status,
        pricingStage: item?.pricingStage ?? null,
        acceptedAmountCentavos: item?.acceptedAmountCentavos ?? null,
        hasHistoryRecord: item !== null,
      });

      if (!eligibility.canReviewFinalPrice) {
        clearFinalPriceQuote();
        setFinalPriceConfirmed(false);
      } else if (finalPriceRef.current?.pickupId !== expectedPickupId) {
        void requestFinalPrice(true);
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.warn(
        '[PickupTracking] unable to verify pickup eligibility after action failure',
        error,
      );
      updatePickupEligibility({
        pickupId: expectedPickupId,
        verified: false,
        status: previous?.pickupId === expectedPickupId
          ? previous.status
          : '',
        pricingStage: previous?.pickupId === expectedPickupId
          ? previous.pricingStage
          : null,
        acceptedAmountCentavos:
          previous?.pickupId === expectedPickupId
            ? previous.acceptedAmountCentavos
            : null,
        hasHistoryRecord:
          previous?.pickupId === expectedPickupId
            ? previous.hasHistoryRecord
            : false,
      });
      setTrackingError(
        'Could not verify the current pickup status. Refresh before taking action.',
      );
    }
  }, [pickupId, requestFinalPrice]);

  const handleConfirmFinalPrice = useCallback(async () => {
    const current = finalPriceRef.current;
    const eligibility = pickupEligibilityRef.current;
    if (
      !current ||
      current.pickupId !== pickupId ||
      !screenFocusedRef.current ||
      !eligibility?.verified ||
      eligibility.pickupId !== pickupId ||
      !getPickupActionEligibility(
        eligibility.status,
        eligibility.pricingStage,
        eligibility.acceptedAmountCentavos,
        eligibility.hasHistoryRecord,
      ).canReviewFinalPrice ||
      finalPriceActionInFlight.current ||
      finalPriceConfirmed
    ) return;
    const expectedEpoch = screenEpochRef.current;
    finalPriceActionInFlight.current = true;
    setFinalPriceActionPending(true);
    setFinalPriceError('');
    try {
      const result = await confirmPickupFinalPrice(pickupId, current.quote);
      if (
        isCurrentPickupOperation(pickupId, expectedEpoch) &&
        result.success &&
        result.pickupId === pickupId
      ) {
        setFinalPriceConfirmed(true);
        try {
          await refreshPricingHistory(() =>
            isCurrentPickupOperation(pickupId, expectedEpoch));
        } catch {
          console.warn('[PickupTracking] confirmed price history refresh failed');
        }
      }
    } catch (error) {
      if (isCurrentPickupOperation(pickupId, expectedEpoch)) {
        setFinalPriceError(getFinalPriceResolutionMessage(error));
      }
    } finally {
      if (isCurrentPickupOperation(pickupId, expectedEpoch)) {
        finalPriceActionInFlight.current = false;
        setFinalPriceActionPending(false);
      }
    }
  }, [finalPriceConfirmed, pickupId, refreshPricingHistory]);

  const handleDeclineFinalPrice = useCallback(() => {
    const eligibility = pickupEligibilityRef.current;
    if (
      finalPriceActionInFlight.current ||
      !pickupId ||
      !screenFocusedRef.current ||
      !eligibility?.verified ||
      eligibility.pickupId !== pickupId ||
      !getPickupActionEligibility(
        eligibility.status,
        eligibility.pricingStage,
        eligibility.acceptedAmountCentavos,
        eligibility.hasHistoryRecord,
      ).canReviewFinalPrice
    ) return;
    const expectedEpoch = screenEpochRef.current;
    Alert.alert(
      'Decline final price?',
      'Your pickup will be cancelled and its reserved capacity released.',
      [
        {text: 'Keep pickup', style: 'cancel'},
        {
          text: 'Decline and cancel',
          style: 'destructive',
          onPress: () => {
            const currentEligibility = pickupEligibilityRef.current;
            if (
              finalPriceActionInFlight.current ||
              !isCurrentPickupOperation(pickupId, expectedEpoch) ||
              !currentEligibility?.verified ||
              currentEligibility.pickupId !== pickupId ||
              !getPickupActionEligibility(
                currentEligibility.status,
                currentEligibility.pricingStage,
                currentEligibility.acceptedAmountCentavos,
                currentEligibility.hasHistoryRecord,
              ).canReviewFinalPrice
            ) return;
            finalPriceActionInFlight.current = true;
            setFinalPriceActionPending(true);
            setFinalPriceError('');
            void declinePickupFinalPrice(pickupId)
              .then((result) => {
                if (isCurrentPickupOperation(pickupId, expectedEpoch) &&
                    result.status === 'cancelled' &&
                    result.pickupId === pickupId) {
                  setFinalPriceDeclined(true);
                  clearFinalPriceQuote();
                  updatePickupEligibility({
                    pickupId,
                    verified: true,
                    status: 'cancelled',
                    pricingStage: null,
                    acceptedAmountCentavos: null,
                    hasHistoryRecord: false,
                  });
                  setTracking((current) => current
                    ? {
                        ...current,
                        status: 'cancelled',
                        cancelledBy: null,
                        cancellationReason: null,
                      }
                    : current);
                }
              })
              .catch(async (error: unknown) => {
                if (!isCurrentPickupOperation(pickupId, expectedEpoch)) return;
                setFinalPriceError(getFinalPriceResolutionMessage(error));
                await reconcileFailedPickupAction(pickupId, expectedEpoch);
              })
              .finally(() => {
                if (isCurrentPickupOperation(pickupId, expectedEpoch)) {
                  finalPriceActionInFlight.current = false;
                  setFinalPriceActionPending(false);
                }
              });
          },
        },
      ],
    );
  }, [pickupId, reconcileFailedPickupAction]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let loading = false;
    screenFocusedRef.current = true;
    const focusEpoch = ++screenEpochRef.current;
    trackingRefreshSequence.current += 1;
    finalPriceRequestSequence.current += 1;
    finalPriceRequestInFlight.current = false;
    finalPriceActionInFlight.current = false;
    setFinalPriceActionPending(false);
    clearFinalPriceQuote();
    const currentEligibility = pickupEligibilityRef.current;
    updatePickupEligibility({
      pickupId,
      verified: false,
      status: currentEligibility?.pickupId === pickupId
        ? currentEligibility.status
        : '',
      pricingStage: currentEligibility?.pickupId === pickupId
        ? currentEligibility.pricingStage
        : null,
      acceptedAmountCentavos:
        currentEligibility?.pickupId === pickupId
          ? currentEligibility.acceptedAmountCentavos
          : null,
      hasHistoryRecord:
        currentEligibility?.pickupId === pickupId
          ? currentEligibility.hasHistoryRecord
          : false,
    });
    const refresh = async (manual = false) => {
      if (!active || AppState.currentState !== 'active' || loading || !pickupId) return;
      loading = true;
      const requestSequence = ++trackingRefreshSequence.current;
      const isCurrentRequest = () =>
        active &&
        requestSequence === trackingRefreshSequence.current &&
        isCurrentPickupOperation(pickupId, focusEpoch);
      if (manual) setRefreshing(true);
      try {
        const next = await getPickupTracking(pickupId);
        if (!isCurrentRequest()) return;
        console.info('[PickupTracking] response received', {
          riderLocationReturned: next.riderLocation !== null &&
            next.riderLocation !== undefined,
          pickupStatus: [
            'pending',
            'accepted',
            'in_progress',
            'awaiting_facility_receipt',
            'completed',
            'cancelled',
            'canceled',
          ].includes(next.status) ? next.status : 'unknown',
        });
        setTracking(next);
        if (
          next.status === 'accepted' ||
          next.status === 'in_progress' ||
          next.status === 'awaiting_facility_receipt'
        ) {
          const requestSequence = ++riderContactRequestSequence.current;
          setRiderContactState({
            pickupId,
            status: next.status,
            loading: true,
            contact: null,
            error: false,
          });
          try {
            const contact = await getPickupRiderContact(pickupId);
            if (
              isCurrentRequest() &&
              requestSequence === riderContactRequestSequence.current
            ) {
              setRiderContactState({
                pickupId,
                status: next.status,
                loading: false,
                contact,
                error: false,
              });
            }
          } catch (error) {
            console.warn(
              '[PickupTracking] Rider contact could not be loaded',
              error,
            );
            if (
              isCurrentRequest() &&
              requestSequence === riderContactRequestSequence.current
            ) {
              setRiderContactState({
                pickupId,
                status: next.status,
                loading: false,
                contact: null,
                error: true,
              });
            }
          }
        } else {
          riderContactRequestSequence.current += 1;
          setRiderContactState(null);
        }
        try {
          const requiresFinalPrice = await refreshPricingHistory(
            isCurrentRequest,
          );
          if (!isCurrentRequest()) return;
          const latestHistory = historyItemRef.current;
          const item = latestHistory?.pickupId === pickupId
            ? latestHistory.item
            : null;
          updatePickupEligibility({
            pickupId,
            verified: true,
            status: next.status,
            pricingStage: item?.pricingStage ?? null,
            acceptedAmountCentavos: item?.acceptedAmountCentavos ?? null,
            hasHistoryRecord: item !== null,
          });
          const eligibility = getPickupActionEligibility(
            next.status,
            item?.pricingStage ?? null,
            item?.acceptedAmountCentavos ?? null,
            item !== null,
          );
          if (!eligibility.canReviewFinalPrice) {
            clearFinalPriceQuote();
          }
          setTrackingError('');
          if (requiresFinalPrice) void requestFinalPrice();
        } catch {
          if (isCurrentRequest()) {
            clearFinalPriceQuote();
            const latest = pickupEligibilityRef.current;
            updatePickupEligibility({
              pickupId,
              verified: false,
              status: latest?.pickupId === pickupId ? latest.status : next.status,
              pricingStage:
                latest?.pickupId === pickupId ? latest.pricingStage : null,
              acceptedAmountCentavos:
                latest?.pickupId === pickupId
                  ? latest.acceptedAmountCentavos
                  : null,
              hasHistoryRecord:
                latest?.pickupId === pickupId
                  ? latest.hasHistoryRecord
                  : false,
            });
          }
        }
      } catch {
        console.info('[PickupTracking] response unavailable');
        if (isCurrentRequest()) {
          clearFinalPriceQuote();
          const latest = pickupEligibilityRef.current;
          updatePickupEligibility({
            pickupId,
            verified: false,
            status: latest?.pickupId === pickupId ? latest.status : '',
            pricingStage:
              latest?.pickupId === pickupId ? latest.pricingStage : null,
            acceptedAmountCentavos:
              latest?.pickupId === pickupId
                ? latest.acceptedAmountCentavos
                : null,
            hasHistoryRecord:
              latest?.pickupId === pickupId
                ? latest.hasHistoryRecord
                : false,
          });
          setTrackingError(
            'Could not verify the current pickup status. Refresh before taking action.',
          );
        }
      } finally {
        loading = false;
        if (isCurrentPickupOperation(pickupId, focusEpoch) && manual) {
          setRefreshing(false);
        }
      }
    };
    refreshHandler.current = () => void refresh(true);
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      if (screenEpochRef.current === focusEpoch) {
        screenFocusedRef.current = false;
        screenEpochRef.current += 1;
        trackingRefreshSequence.current += 1;
        finalPriceRequestSequence.current += 1;
        finalPriceRequestInFlight.current = false;
        finalPriceActionInFlight.current = false;
      }
      refreshHandler.current = null;
      clearInterval(timer);
      appState.remove();
    };
  }, [pickupId, refreshPricingHistory, requestFinalPrice]));

  const latitude = tracking
    ? tracking.destination?.latitude ?? null
    : finiteNumber(first(params.latitude));
  const longitude = tracking
    ? tracking.destination?.longitude ?? null
    : finiteNumber(first(params.longitude));
  const hasDestination = isValidCoordinate(latitude, longitude);
  const status = tracking?.status ?? '';
  const isCancelled = status === 'cancelled';
  const cancellationActor = isCancelled
    ? tracking?.cancelledBy ?? historyItem?.cancelledBy
    : null;
  const cancellationReason = isCancelled
    ? tracking?.cancellationReason?.trim() ||
      historyItem?.cancellationReason?.trim() ||
      ''
    : '';
  const cancellationLabel = getPickupCancellationLabel(
    cancellationActor,
    firebaseUser?.uid,
    tracking?.riderId,
  );
  const currentEligibility =
    pickupEligibilityRef.current?.pickupId === pickupId &&
    pickupEligibilityRef.current.verified &&
    pickupEligibilityVerified
      ? pickupEligibilityRef.current
      : null;
  const actionEligibility = currentEligibility
    ? getPickupActionEligibility(
        currentEligibility.status,
        currentEligibility.pricingStage,
        currentEligibility.acceptedAmountCentavos,
        currentEligibility.hasHistoryRecord,
      )
    : {canCancelRequest: false, canReviewFinalPrice: false};
  const canCancelRequest = actionEligibility.canCancelRequest;
  const collectionStarted = [
    'in_progress',
    'awaiting_facility_receipt',
    'completed',
  ].includes(status);
  const riderContactAllowed = tracking?.pickupId === pickupId && (
    status === 'accepted' ||
    status === 'in_progress' ||
    status === 'awaiting_facility_receipt'
  );
  const currentRiderContactState =
    riderContactState?.pickupId === pickupId &&
    riderContactState.status === status
      ? riderContactState
      : null;
  const riderContact = currentRiderContactState?.contact ?? null;
  const handleCallRider = useCallback(async () => {
    const phoneNumber = riderContact?.phoneNumber;
    if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      Alert.alert(
        'Phone number unavailable',
        'A valid phone number is not available for your assigned Rider.',
      );
      return;
    }

    try {
      await Linking.openURL(`tel:${encodeURIComponent(phoneNumber)}`);
    } catch (error) {
      console.warn('[PickupTracking] unable to open Rider phone dialer', error);
      Alert.alert(
        'Unable to open phone dialer',
        'Could not open the phone dialer. Please try again.',
      );
    }
  }, [riderContact?.phoneNumber]);
  const handleCancelRequest = useCallback(() => {
    const eligibility = pickupEligibilityRef.current;
    if (
      !canCancelRequest ||
      !pickupId ||
      !screenFocusedRef.current ||
      !eligibility?.verified ||
      eligibility.pickupId !== pickupId ||
      !getPickupActionEligibility(
        eligibility.status,
        eligibility.pricingStage,
        eligibility.acceptedAmountCentavos,
        eligibility.hasHistoryRecord,
      ).canCancelRequest ||
      finalPriceActionInFlight.current
    ) return;

    const expectedEpoch = screenEpochRef.current;
    Alert.alert(
      'Cancel request?',
      'This will cancel your pickup request and release its reservation.',
      [
        {text: 'Keep request', style: 'cancel'},
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => {
            const current = pickupEligibilityRef.current;
            if (
              finalPriceActionInFlight.current ||
              !isCurrentPickupOperation(pickupId, expectedEpoch) ||
              !current?.verified ||
              current.pickupId !== pickupId ||
              !getPickupActionEligibility(
                current.status,
                current.pricingStage,
                current.acceptedAmountCentavos,
                current.hasHistoryRecord,
              ).canCancelRequest
            ) return;
            finalPriceActionInFlight.current = true;
            setFinalPriceActionPending(true);
            setCancellationError('');
            void cancelPickupRequest(pickupId)
              .then(async (result) => {
                if (!isCurrentPickupOperation(pickupId, expectedEpoch)) return;
                if (
                  result.status !== 'cancelled' ||
                  result.pickupId !== pickupId
                ) return;

                clearFinalPriceQuote();
                updatePickupEligibility({
                  pickupId,
                  verified: true,
                  status: 'cancelled',
                  pricingStage: null,
                  acceptedAmountCentavos: null,
                  hasHistoryRecord: false,
                });
                setTracking((current) => current
                  ? {
                      ...current,
                      status: 'cancelled',
                      cancelledBy: null,
                      cancellationReason: null,
                    }
                  : current);
                setRiderContactState(null);
                try {
                  const refreshedTracking = await getPickupTracking(pickupId);
                  if (!isCurrentPickupOperation(pickupId, expectedEpoch)) {
                    return;
                  }
                  setTracking(refreshedTracking);
                  setTrackingError('');
                } catch (error) {
                  if (!isCurrentPickupOperation(pickupId, expectedEpoch)) {
                    return;
                  }
                  console.warn(
                    '[PickupTracking] cancelled pickup refresh failed',
                    error,
                  );
                  setTrackingError(
                    'Your request was cancelled, but its latest status could not be refreshed. Pull down to retry.',
                  );
                }

                try {
                  await refreshPricingHistory(() =>
                    isCurrentPickupOperation(pickupId, expectedEpoch));
                  if (!isCurrentPickupOperation(pickupId, expectedEpoch)) {
                    return;
                  }
                  const latestHistory = historyItemRef.current;
                  const item = latestHistory?.pickupId === pickupId
                    ? latestHistory.item
                    : null;
                  updatePickupEligibility({
                    pickupId,
                    verified: true,
                    status: 'cancelled',
                    pricingStage: item?.pricingStage ?? null,
                    acceptedAmountCentavos:
                      item?.acceptedAmountCentavos ?? null,
                    hasHistoryRecord: item !== null,
                  });
                } catch (error) {
                  if (!isCurrentPickupOperation(pickupId, expectedEpoch)) {
                    return;
                  }
                  console.warn(
                    '[PickupTracking] cancelled pickup history refresh failed',
                    error,
                  );
                }
              })
              .catch(async (error: unknown) => {
                if (!isCurrentPickupOperation(pickupId, expectedEpoch)) return;
                const callableError =
                  typeof error === 'object' && error !== null
                    ? error as {code?: unknown; message?: unknown}
                    : null;
                setCancellationError(
                  error instanceof Error
                    ? error.message
                    : 'Your pickup request could not be cancelled. Refresh and try again.',
                );
                await reconcileFailedPickupAction(pickupId, expectedEpoch);
              })
              .finally(() => {
                if (isCurrentPickupOperation(pickupId, expectedEpoch)) {
                  finalPriceActionInFlight.current = false;
                  setFinalPriceActionPending(false);
                }
              });
          },
        },
      ],
    );
  }, [
    canCancelRequest,
    pickupId,
    reconcileFailedPickupAction,
    refreshPricingHistory,
  ]);
  const currentFinalQuote = finalPriceState?.pickupId === pickupId
    ? finalPriceState.quote
    : null;
  const acceptedAmount = historyAmount;
  const canReviewFinalPrice = actionEligibility.canReviewFinalPrice;
  const finalPricePending = canReviewFinalPrice && twoStagePricing &&
    historyItem?.acceptedAmountCentavos === null &&
    (
      historyItem.pricingStage === 'awaiting_final_price' ||
      historyItem.pricingStage === 'awaiting_customer_confirmation' ||
      status === 'accepted'
    );
  const displayedBreakdown =
    currentFinalQuote?.breakdown ?? savedPriceBreakdown;
  const itemizedPricingItems = currentFinalQuote?.items?.length
    ? currentFinalQuote.items
    : (historyItem?.items ?? []).filter((item) =>
      typeof item.pickupFeeCentavosPerBag === 'number' &&
      Number.isSafeInteger(item.pickupFeeCentavosPerBag) &&
      item.pickupFeeCentavosPerBag >= 0 &&
      typeof item.pickupFeeSubtotalCentavos === 'number' &&
      Number.isSafeInteger(item.pickupFeeSubtotalCentavos) &&
      item.pickupFeeSubtotalCentavos ===
        item.pickupFeeCentavosPerBag * item.quantity,
    );
  const hasSavedFinalPrice = acceptedAmount !== null &&
    savedPriceBreakdown !== null;
  const apiKeyConfigured =
    Constants.expoConfig?.extra?.googleMapsApiKeyConfigured === true;
  const destination = hasDestination
    ? { latitude: latitude!, longitude: longitude! }
    : null;

  const riderLocation = tracking?.riderLocation;
  const riderCoordinatesValid = !!riderLocation &&
    Number.isFinite(riderLocation.latitude) &&
    riderLocation.latitude >= -90 && riderLocation.latitude <= 90 &&
    Number.isFinite(riderLocation.longitude) &&
    riderLocation.longitude >= -180 && riderLocation.longitude <= 180;
  const riderTimestampMs = riderLocation
    ? Date.parse(riderLocation.updatedAt)
    : Number.NaN;
  const riderTimestampValid = Number.isFinite(riderTimestampMs);
  const riderTimestampFresh = riderTimestampValid &&
    riderTimestampMs <= Date.now() + 30000 &&
    Date.now() - riderTimestampMs <= 60000;
  const riderLocationIsFresh = !!riderLocation &&
    riderCoordinatesValid && riderTimestampFresh;
  const currentRider = riderLocationIsFresh && riderLocation
    ? { latitude: riderLocation.latitude, longitude: riderLocation.longitude }
    : null;
  const currentRiderExists = currentRider !== null;
  const markers = destination
    ? [{
        id: 'pickup-destination',
        coordinates: destination,
        title: addressLabel,
        snippet: address,
      }]
    : [];
  const googleMarkers = [
    ...markers,
    ...(currentRider ? [{
      id: 'assigned-rider',
      coordinates: currentRider,
      title: 'Assigned rider',
      snippet: 'Live GPS location',
      zIndex: 1,
    }] : []),
  ];
  const hasAssignedRiderGoogleMarker = googleMarkers.some(
    (marker) => marker.id === 'assigned-rider',
  );
  const appleMarkers = [
    ...markers,
    ...(currentRider ? [{
      id: 'assigned-rider',
      coordinates: currentRider,
      title: 'Rider location',
      tintColor: '#218A52',
    }] : []),
  ];

  const showGoogleMap =
    Platform.OS === 'android' && hasDestination && apiKeyConfigured;
  const showAppleMap =
    Platform.OS === 'ios' && hasDestination;
  const googleMapKey = `${pickupId}:${latitude}:${longitude}:${mapRetryCount}`;
  const riderMayBeOutsideViewport = !!currentRider && !!destination &&
    (
      Math.abs(currentRider.latitude - destination.latitude) > 0.005 ||
      Math.abs(currentRider.longitude - destination.longitude) > 0.01
    );

  useEffect(() => {
    if (!tracking) return;
    console.info('[PickupTracking] rider location validation', {
      riderLocationReturned: riderLocation !== null &&
        riderLocation !== undefined,
      coordinatesValid: riderCoordinatesValid,
      timestampValid: riderTimestampValid,
      timestampFresh: riderTimestampFresh,
      acceptedAsCurrentRider: currentRiderExists,
    });
  }, [
    currentRiderExists,
    riderCoordinatesValid,
    riderLocation,
    riderTimestampFresh,
    riderTimestampValid,
    tracking,
  ]);

  useEffect(() => {
    console.info('[PickupTracking] current rider state updated', {
      currentRiderExists,
    });
  }, [
    currentRider?.latitude,
    currentRider?.longitude,
    currentRiderExists,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    console.info('[PickupTracking] Google map render state', {
      mapViewRendering: showGoogleMap,
      riderMarkerIncluded: hasAssignedRiderGoogleMarker,
      cameraCenteredOnDestination: showGoogleMap && destination !== null,
      riderMayBeOutsideViewport,
      mapLoaded,
    });
  }, [
    hasAssignedRiderGoogleMarker,
    mapLoaded,
    riderMayBeOutsideViewport,
    showGoogleMap,
    currentRider?.latitude,
    currentRider?.longitude,
  ]);

  const handleGoogleCameraMove: NonNullable<
    GoogleMaps.MapProps['onCameraMove']
  > = (event) => {
    const cameraState = cameraInteraction.current;
    if (cameraState.mapKey !== googleMapKey) {
      cameraState.mapKey = googleMapKey;
      cameraState.initialCameraMoveObserved = false;
      cameraState.userMovedMap = false;
      cameraState.riderCameraSet = false;
    }

    if (!cameraState.initialCameraMoveObserved) {
      cameraState.initialCameraMoveObserved = true;
      const initialCameraMatchesDestination = !!destination &&
        typeof event.coordinates.latitude === 'number' &&
        typeof event.coordinates.longitude === 'number' &&
        Math.abs(event.coordinates.latitude - destination.latitude) < 0.0005 &&
        Math.abs(event.coordinates.longitude - destination.longitude) < 0.0005 &&
        Math.abs(event.zoom - 15) < 0.5;
      cameraState.userMovedMap = !initialCameraMatchesDestination;
      setCameraReadyMapKey(googleMapKey);
      return;
    }

    cameraState.userMovedMap = true;
  };

  useEffect(() => {
    if (
      !showGoogleMap ||
      !mapLoaded ||
      cameraReadyMapKey !== googleMapKey ||
      !destination ||
      !currentRider
    ) return;

    const cameraState = cameraInteraction.current;
    if (
      cameraState.mapKey !== googleMapKey ||
      cameraState.userMovedMap ||
      cameraState.riderCameraSet
    ) return;

    const map = googleMapRef.current;
    if (!map) return;

    map.setCameraPosition({
      ...cameraPositionToFitLocations(destination, currentRider),
      duration: 500,
    });
    cameraState.riderCameraSet = true;
  }, [
    cameraReadyMapKey,
    currentRider?.latitude,
    currentRider?.longitude,
    destination?.latitude,
    destination?.longitude,
    googleMapKey,
    mapLoaded,
    showGoogleMap,
  ]);

  useEffect(() => {
    setMapLoaded(false);
    setMapLoadTimedOut(false);

    if (!showGoogleMap) return;

    const timeout = setTimeout(() => {
      setMapLoadTimedOut(true);
      mapLoadTimeout.current = null;
    }, 10000);
    mapLoadTimeout.current = timeout;

    return () => {
      clearTimeout(timeout);
      if (mapLoadTimeout.current === timeout) {
        mapLoadTimeout.current = null;
      }
    };
  }, [
    pickupId,
    destination?.latitude,
    destination?.longitude,
    showGoogleMap,
    mapRetryCount,
  ]);

  const handleMapLoaded = () => {
    if (mapLoadTimeout.current) {
      clearTimeout(mapLoadTimeout.current);
      mapLoadTimeout.current = null;
    }
    setMapLoaded(true);
  };

  const retryMapLoad = () => {
    setMapLoaded(false);
    setMapLoadTimedOut(false);
    setMapRetryCount((count) => count + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace('/home')}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>‹ Back</Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>PICKUP TRACKING</Text>
            <Text style={styles.title}>Your pickup</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
        </View>

        {isCancelled ? (
          <View style={styles.cancellationNotice}>
            <Text style={styles.cancellationTitle}>{cancellationLabel}</Text>
            {cancellationReason ? (
              <Text style={styles.cancellationBody}>
                Reason: {cancellationReason}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.mapFrame}>
          {showGoogleMap ? (
            <>
              <GoogleMaps.View
                key={googleMapKey}
                ref={googleMapRef}
                style={StyleSheet.absoluteFill}
                cameraPosition={{
                  coordinates: destination ?? undefined,
                  zoom: 15,
                }}
                markers={googleMarkers}
                circles={currentRider ? [
                  {
                    id: 'rider-location-halo',
                    center: currentRider,
                    radius: 34,
                    color: '#33218A52',
                    lineColor: '#99218A52',
                    lineWidth: 2,
                  },
                  {
                    id: 'rider-location-dot',
                    center: currentRider,
                    radius: 11,
                    color: '#F0218A52',
                    lineColor: '#FFFFFFFF',
                    lineWidth: 3,
                  },
                ] : []}
                properties={{
                  mapStyleOptions: { json: GOOGLE_MAP_STYLE },
                  isTrafficEnabled: false,
                  isBuildingEnabled: true,
                }}
                uiSettings={{
                  compassEnabled: false,
                  mapToolbarEnabled: false,
                  myLocationButtonEnabled: false,
                  zoomControlsEnabled: false,
                }}
                onMapLoaded={handleMapLoaded}
                onCameraMove={handleGoogleCameraMove}
              />
              {!mapLoaded && !mapLoadTimedOut && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator color="#176B43" />
                  <Text style={styles.mapMessage}>Loading Google Maps…</Text>
                </View>
              )}
              {!mapLoaded && mapLoadTimedOut && (
                <View style={styles.mapLoading}>
                  <Text style={styles.mapMessage}>
                    Map is taking longer than expected
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={retryMapLoad}
                    style={styles.mapRetryButton}
                  >
                    <Text style={styles.mapRetryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : showAppleMap ? (
            <AppleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={{
                coordinates: destination ?? undefined,
                zoom: 15,
              }}
              markers={appleMarkers}
              colorScheme={AppleMaps.MapColorScheme.LIGHT}
            />
          ) : (
            <View style={styles.mapUnavailable}>
              <View style={styles.destinationIcon}>
                <Text style={styles.destinationGlyph}>⌖</Text>
              </View>
              <Text style={styles.mapUnavailableTitle}>
                {!hasDestination
                  ? 'Pickup location unavailable'
                  : Platform.OS === 'android'
                    ? 'Google Maps isn’t configured'
                    : 'Map preview unavailable'}
              </Text>
              <Text style={styles.mapUnavailableBody}>
                {!hasDestination
                  ? 'This booking does not include valid pickup coordinates.'
                  : Platform.OS === 'android'
                    ? 'Add a restricted Android Maps API key and rebuild the app to show the map.'
                    : 'Open this tracking screen on a supported mobile device.'}
              </Text>
            </View>
          )}

          {hasDestination && (
            <View style={styles.mapCaption}>
              <View style={styles.captionDot} />
              <Text numberOfLines={1} style={styles.mapCaptionText}>
                Pickup point
              </Text>
            </View>
          )}
        </View>

        <View style={styles.trackingNotice}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeGlyph}>i</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>
              {trackingError || (!pickupEligibilityVerified
                ? 'Verifying pickup status'
                : currentRider
                ? 'Rider location is updating'
                : status === 'pending'
                  ? 'Waiting for rider assignment'
                  : status
                    ? 'Rider location is unavailable'
                    : 'Loading live pickup status')}
            </Text>
            <Text style={styles.noticeBody}>
              {!pickupEligibilityVerified
                ? 'The displayed status is for reference only. Cancellation and price review are disabled until the current pickup status and price eligibility are verified.'
                : trackingError
                ? 'The last verified status remains visible; rider coordinates disappear when they become stale.'
                : status === 'awaiting_facility_receipt'
                  ? 'Collection is complete. Your pickup will be marked completed after authorized facility staff records receipt.'
                  : status === 'completed'
                    ? 'Facility receipt has been recorded. This pickup is complete.'
                : currentRider
                  ? 'The green marker is the assigned rider’s fresh GPS position. No road route or ETA is available yet.'
                  : 'The destination is your saved pickup location. The rider marker appears only after an assigned rider sends a fresh GPS update.'}
            </Text>
          </View>
        </View>

        {(twoStagePricing || currentFinalQuote || hasSavedFinalPrice) ? (
          <View style={styles.detailsCard}>
            <Text style={styles.cardEyebrow}>PRICE REVIEW</Text>
            <Text style={styles.cardTitle}>Pickup pricing</Text>
            {priceHistoryError ? (
              <Text accessibilityRole="alert" style={styles.priceError}>
                {priceHistoryError}
              </Text>
            ) : null}
            {finalPriceDeclined ? (
              <Text style={styles.noticeBody}>
                You declined the final price. The cancellation was sent to the
                Backend and the pickup is cancelled.
              </Text>
            ) : (
              <>
                {currentFinalQuote && !finalPriceConfirmed &&
                !hasSavedFinalPrice ? (
                  <Text style={styles.noticeTitle}>
                    Your final quote is ready to review
                  </Text>
                ) : null}
                {twoStagePricing && !currentFinalQuote &&
                    acceptedAmount === null ? (
                  <Text style={styles.noticeBody}>
                    Your request is submitted. The final price will appear
                    here after the road route from your pickup location to the
                    assigned facility is calculated. You can confirm or
                    decline it here before collection begins.
                  </Text>
                ) : null}
                {displayedBreakdown &&
                  displayedBreakdown.baseAmountCentavos !== undefined ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Base and minimum amount
                    </Text>
                    <Text style={styles.detailValue}>
                      {formatPeso(String(
                        displayedBreakdown.baseAmountCentavos,
                      ))}
                    </Text>
                  </View>
                ) : null}
                {itemizedPricingItems.length > 0 ? (
                  itemizedPricingItems.map((item, index) => (
                    <View
                      key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`}
                      style={styles.detailRow}
                    >
                      <Text style={styles.detailLabel}>
                        {item.wasteTypeName} ({item.bagSizeLabel}) — {item.quantity}
                        {' '}{item.quantity === 1 ? 'bag' : 'bags'} ×
                        {' '}{formatPesoCentavos(item.pickupFeeCentavosPerBag)}
                        {' '} / bag
                      </Text>
                      <Text style={styles.detailValue}>
                        {formatPesoCentavos(item.pickupFeeSubtotalCentavos)}
                      </Text>
                    </View>
                  ))
                ) : displayedBreakdown?.wasteTypeFeesCentavos !== undefined ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Waste type pickup fees</Text>
                    <Text style={styles.detailValue}>
                      {formatPesoCentavos(
                        displayedBreakdown.wasteTypeFeesCentavos,
                      )}
                    </Text>
                  </View>
                ) : null}
                {displayedBreakdown &&
                  displayedBreakdown.loadSurchargeCentavos !== null ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Load surcharge</Text>
                    <Text style={styles.detailValue}>
                      {formatPeso(String(
                        displayedBreakdown.loadSurchargeCentavos,
                      ))}
                    </Text>
                  </View>
                ) : null}
                {displayedBreakdown &&
                  displayedBreakdown.facilityTransportDistanceMeters !== undefined ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Pickup-to-facility road distance
                    </Text>
                    <Text style={styles.detailValue}>
                      {(displayedBreakdown.facilityTransportDistanceMeters / 1000)
                        .toFixed(2)} km
                    </Text>
                  </View>
                ) : null}
                {displayedBreakdown &&
                  displayedBreakdown.distanceCentavos >= 0 &&
                  (currentFinalQuote || hasSavedFinalPrice) ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Facility transport fee
                    </Text>
                    <Text style={styles.detailValue}>
                      {formatPeso(String(
                        displayedBreakdown.distanceCentavos,
                      ))}
                    </Text>
                  </View>
                ) : null}
                {(currentFinalQuote || hasSavedFinalPrice) ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {finalPriceConfirmed || hasSavedFinalPrice
                          ? 'Confirmed final total'
                          : 'Final total'}
                      </Text>
                      <Text style={styles.detailValue}>
                        {formatPeso(String(
                          currentFinalQuote?.amountCentavos ??
                            acceptedAmount ?? '',
                        ))}
                      </Text>
                    </View>
                    {!finalPriceConfirmed && !hasSavedFinalPrice ? (
                      <Text style={styles.noticeBody}>
                        Review this final price. It will not
                        be accepted unless you choose to accept it.
                      </Text>
                    ) : null}
                  </>
                ) : status === 'pending' && !finalPricePending ? (
                  <Text style={styles.noticeBody}>
                    Waiting for a rider to accept your pickup. The base fee
                    covers normal Rider dispatch.
                  </Text>
                ) : finalPricePending ? (
                  <>
                    <Text style={styles.noticeBody}>
                      {priceHistoryError ||
                        (finalPriceLoading
                        ? 'Calculating the road route to your assigned facility…'
                        : 'The Backend is calculating facility transport from your pickup location. Review the final price before collection can proceed.')}
                    </Text>
                    {finalPriceError ? (
                      <Text accessibilityRole="alert" style={styles.priceError}>
                        {finalPriceError}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={finalPriceLoading}
                      onPress={() => void requestFinalPrice(true)}
                      style={[
                        styles.priceActionButton,
                        finalPriceLoading && styles.priceActionDisabled,
                      ]}
                    >
                      {finalPriceLoading ? (
                        <ActivityIndicator color="#176B43" />
                      ) : (
                        <Text style={styles.priceActionText}>
                          Retry final price
                        </Text>
                      )}
                    </Pressable>
                  </>
                ) : null}
                {currentFinalQuote &&
                !finalPriceConfirmed &&
                canReviewFinalPrice ? (
                  <View style={styles.priceActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={finalPriceActionPending}
                      onPress={() => void handleConfirmFinalPrice()}
                      style={[
                        styles.priceActionButton,
                        styles.priceActionPrimaryButton,
                        finalPriceActionPending &&
                          styles.priceActionDisabled,
                      ]}
                    >
                      {finalPriceActionPending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.priceActionPrimaryText}>
                          Confirm final price
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={finalPriceActionPending}
                      onPress={handleDeclineFinalPrice}
                      style={[
                        styles.priceActionButton,
                        styles.declineActionButton,
                        finalPriceActionPending &&
                          styles.priceActionDisabled,
                      ]}
                    >
                      <Text style={styles.declineActionText}>
                        Decline and cancel
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {finalPriceError && currentFinalQuote ? (
                  <Text accessibilityRole="alert" style={styles.priceError}>
                    {finalPriceError}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {collectionStarted || riderContactAllowed ? (
          <View style={styles.cancelCard}>
            {collectionStarted ? (
              <Text style={styles.noticeBody}>
                Your Rider has already started the collection process. You can no longer cancel this request directly. Please contact your Rider to discuss cancellation.
              </Text>
            ) : null}
            {riderContactAllowed ? (
              <View style={styles.riderContactSection}>
                <View style={styles.riderContactHeading}>
                  <Text style={styles.cardEyebrow}>ASSIGNED RIDER</Text>
                  {currentRiderContactState?.loading ? (
                    <ActivityIndicator
                      size="small"
                      color="#176B43"
                      accessibilityLabel="Loading Rider contact"
                    />
                  ) : null}
                </View>
                {currentRiderContactState?.loading ? (
                  <Text style={styles.riderContactFallback}>
                    Loading Rider contact…
                  </Text>
                ) : currentRiderContactState?.error ? (
                  <Text style={styles.riderContactFallback}>
                    Rider contact could not be loaded. Pull down to retry.
                  </Text>
                ) : riderContact?.riderAssigned === false ? (
                  <Text style={styles.riderContactFallback}>
                    Your Rider has not been assigned yet.
                  </Text>
                ) : riderContact?.riderFound === false ? (
                  <Text style={styles.riderContactFallback}>
                    Rider contact information is currently unavailable.
                  </Text>
                ) : riderContact?.riderAssigned ? (
                  <>
                    <Text style={styles.riderContactName}>
                      {riderContact.riderName || 'Assigned Rider'}
                    </Text>
                    <View style={styles.riderContactActions}>
                      <Text style={styles.riderContactPhone}>
                        {riderContact.phoneNumber ||
                          'Phone number unavailable'}
                      </Text>
                      {riderContact.phoneNumber ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Call ${riderContact.riderName || 'assigned Rider'}`}
                          onPress={() => void handleCallRider()}
                          style={({pressed}) => [
                            styles.riderCallButton,
                            pressed && styles.riderCallButtonPressed,
                          ]}
                        >
                          <RemixIcon
                            name="phone-line"
                            size={19}
                            color="#FFFFFF"
                            accessible={false}
                          />
                          <Text style={styles.riderCallText}>Call</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <Text style={styles.riderContactFallback}>
                    Rider contact is not available yet.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {canCancelRequest ? (
          <View style={styles.cancelCard}>
            <Pressable
              accessibilityRole="button"
              disabled={finalPriceActionPending}
              onPress={handleCancelRequest}
              style={[
                styles.priceActionButton,
                styles.declineActionButton,
                finalPriceActionPending && styles.priceActionDisabled,
              ]}
            >
              {finalPriceActionPending ? (
                <ActivityIndicator color="#B42318" />
              ) : (
                <Text style={styles.declineActionText}>Cancel Request</Text>
              )}
            </Pressable>
            {cancellationError ? (
              <Text accessibilityRole="alert" style={styles.priceError}>
                {cancellationError}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.cardEyebrow}>BOOKING DETAILS</Text>
              <Text style={styles.cardTitle}>{addressLabel}</Text>
            </View>
            <Text style={styles.price}>
              {currentFinalQuote
                ? formatPeso(String(currentFinalQuote.amountCentavos))
                : acceptedAmount !== null
                  ? formatPeso(String(acceptedAmount))
                  : twoStagePricing
                  ? 'Final price pending'
                    : '—'}
            </Text>
          </View>

          <Text style={styles.address}>{address || 'Address unavailable'}</Text>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup date</Text>
            <Text style={styles.detailValue}>
              {tracking?.scheduledDate || first(params.scheduledDate) || '—'}
              {(tracking?.scheduledTime || first(params.scheduledTime))
                ? ` · ${tracking?.scheduledTime || first(params.scheduledTime)}`
                : ''}
            </Text>
          </View>
          {trackingItems.length ? trackingItems.map((item, index) => (
            <View key={`${item.wasteTypeName}:${item.bagSizeLabel}:${index}`} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.wasteTypeName}</Text>
              <Text style={styles.detailValue}>
                {item.bagSizeLabel} · {item.quantity} bag{item.quantity === 1 ? '' : 's'}
                {item.estimatedWeightKg ? ` · ${item.estimatedWeightKg} kg` : ''}
              </Text>
            </View>
          )) : (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Waste type</Text>
                <Text style={styles.detailValue}>
                  {first(params.wasteType) || '—'}
                </Text>
              </View>
              {!!first(params.bagSize) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bag size</Text>
                  <Text style={styles.detailValue}>{first(params.bagSize)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bags and estimated weight</Text>
                <Text style={styles.detailValue}>
                  {first(params.quantity) || '—'} bags
                  {first(params.estimatedWeightKg)
                    ? ` · ${first(params.estimatedWeightKg)} kg`
                    : ''}
                </Text>
              </View>
            </>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Assigned facility</Text>
            <Text style={styles.detailValue}>
              {first(params.facilityName) || 'Assigned facility'}
            </Text>
          </View>
          {!!first(params.facilityAddress) && (
            <Text style={styles.facilityAddress}>
              {first(params.facilityAddress)}
            </Text>
          )}
          <View style={styles.divider} />
          <Text style={styles.referenceLabel}>PICKUP REFERENCE</Text>
          <Text selectable style={styles.reference}>
            {pickupId || 'Unavailable'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F8F5' },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  backLink: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingRight: 14 },
  backLinkText: { color: '#176B43', fontSize: 14, fontWeight: '700' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 18 },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#398052', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#17271D', fontSize: 29, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#E7F3E9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#398052' },
  statusText: { color: '#286541', fontSize: 11, fontWeight: '800' },
  mapFrame: { height: MAP_FRAME_HEIGHT, overflow: 'hidden', borderRadius: 22, backgroundColor: '#E9EDEA', borderWidth: 1, borderColor: '#DDE5DF' },
  mapLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(245,248,245,0.92)' },
  mapMessage: { color: '#536259', fontSize: 12, fontWeight: '600' },
  mapRetryButton: { marginTop: 4, borderRadius: 999, backgroundColor: '#176B43', paddingHorizontal: 18, paddingVertical: 9 },
  mapRetryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  mapUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  destinationIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCEEE0', alignItems: 'center', justifyContent: 'center' },
  destinationGlyph: { color: '#176B43', fontSize: 26, fontWeight: '700' },
  mapUnavailableTitle: { marginTop: 12, color: '#27372D', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  mapUnavailableBody: { maxWidth: 270, marginTop: 6, color: '#718078', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  mapCaption: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 8, maxWidth: '80%' },
  captionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C74F45' },
  mapCaptionText: { color: '#3E4B43', fontSize: 11, fontWeight: '700' },
  trackingNotice: { flexDirection: 'row', marginTop: 14, padding: 15, borderRadius: 17, backgroundColor: '#EDF3EF', borderWidth: 1, borderColor: '#E0E8E2' },
  cancellationNotice: { marginBottom: 14, padding: 15, borderRadius: 16, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F0E1BC' },
  cancellationTitle: { color: '#674D1E', fontSize: 13, fontWeight: '800' },
  cancellationBody: { marginTop: 5, color: '#6E5B36', fontSize: 12, lineHeight: 18 },
  noticeIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#DCEADF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  noticeGlyph: { color: '#176B43', fontWeight: '900', fontSize: 14 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#294434', fontSize: 12, fontWeight: '800' },
  noticeBody: { marginTop: 4, color: '#63746A', fontSize: 11, lineHeight: 17 },
  detailsCard: { marginTop: 14, padding: 17, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E8E1' },
  cancelCard: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E8E1' },
  riderContactSection: { marginTop: 8 },
  riderContactHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riderContactFallback: { marginTop: 7, color: '#63746A', fontSize: 12, lineHeight: 18 },
  riderContactName: { marginTop: 8, color: '#213329', fontSize: 15, fontWeight: '800' },
  riderContactActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  riderContactPhone: { flex: 1, color: '#63746A', fontSize: 12 },
  riderCallButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#176B43', paddingHorizontal: 15 },
  riderCallButtonPressed: { opacity: 0.8 },
  riderCallText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  priceError: { marginTop: 10, color: '#A12B22', fontSize: 12, lineHeight: 18 },
  priceActions: { gap: 8, marginTop: 14 },
  priceActionButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#176B43', paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  priceActionDisabled: { opacity: 0.55 },
  priceActionText: { color: '#176B43', fontSize: 13, fontWeight: '800' },
  priceActionPrimaryButton: { backgroundColor: '#176B43' },
  priceActionPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  declineActionButton: { borderColor: '#B42318' },
  declineActionText: { color: '#B42318', fontSize: 13, fontWeight: '800' },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: '#779080', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  cardTitle: { marginTop: 5, color: '#213329', fontSize: 16, fontWeight: '800' },
  price: { color: '#176B43', fontSize: 16, fontWeight: '900' },
  address: { marginTop: 8, color: '#66756B', fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#EEF2EE', marginVertical: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 11 },
  detailLabel: { flex: 1, color: '#78847C', fontSize: 11 },
  detailValue: { flex: 1.2, color: '#2C3D32', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  facilityAddress: { marginLeft: '45%', marginTop: 3, color: '#89948D', fontSize: 10, lineHeight: 15, textAlign: 'right' },
  referenceLabel: { color: '#87938B', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  reference: { color: '#2C3D32', fontSize: 11, fontWeight: '700', marginTop: 5 },
});
