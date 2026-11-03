import {
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import {
  collection,
  addDoc,
  GeoPoint,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

import app, { firebaseAuth, firestore } from '@/services/firebase';

const functions = getFunctions(app, 'us-central1');

export interface SubmitPickupInput {
  submissionId: string;
  quoteId: string;
  acceptedAmountCentavos: number;
  acceptedPricingVersion: string;
  addressId: string;
  items?: PickupQuoteItemInput[];
  wasteTypeId?: string;
  bagSizeId?: string;
  quantity?: number;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  trashPhotoPaths?: string[];
}

export interface PickupQuoteItemInput {
  wasteTypeId: string;
  bagSizeId: string;
  quantity: number;
}

export interface PickupQuoteItemSnapshot extends PickupQuoteItemInput {
  wasteTypeName: string;
  bagSizeLabel: string;
  estimatedWeightKg: number;
  pickupFeeCentavosPerBag: number;
  pickupFeeSubtotalCentavos: number;
}

export interface LegacySubmitPickupInput {
  submissionId: string;
  addressId: string;
  wasteTypeId: string;
  bagSizeId: string;
  quantity: number;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
}

export interface LegacySubmittedPickup {
  success: true;
  pickupId: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
}

export interface SubmittedPickup {
  success: true;
  pickupId: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
  acceptedAmountCentavos: number;
  currency: 'PHP';
  acceptedQuoteId: string;
  acceptedPricingVersion: string;
}

export interface PickupQuote {
  schemaVersion: 2;
  quoteType: 'initial_estimate';
  quoteId: string;
  amountCentavos: number;
  currency: 'PHP';
  breakdown: {
    legacyWasteTypeFeeCentavos?: number;
    wasteTypeFeesCentavos?: number;
    basePickupFeeCentavos?: number;
    minimumBookingPriceCentavos?: number;
    baseAmountCentavos?: number;
    loadCategory?: 'none' | 'medium' | 'large';
    billableDistanceMeters?: number | null;
    facilityTransportDistanceMeters?: number;
    facilityTransportTierIndex?: number;
    facilityTransportLowerBoundKm?: number;
    facilityTransportUpperBoundKm?: number | null;
    facilityId?: string;
    distanceCentavos: number | null;
    loadSurchargeCentavos: number | null;
    minimumAppliedCentavos?: number;
    totalCentavos: number;
  };
  inputSnapshot: {
    addressId: string;
    address: string;
    latitude: number;
    longitude: number;
    wasteTypeId: string;
    wasteTypeName: string;
    bagSizeId: string;
    bagSizeLabel: string;
    estimatedWeightKg: number;
    quantity: number;
    scheduledDate: string;
    scheduledTime: string;
    notes: string;
    items?: PickupQuoteItemSnapshot[];
  };
  pricingSource: 'legacy-waste-type-fixed-fee' | 'centralized-pricing';
  pricingVersion: string;
  schedulingVersion: number;
  issuedAt: string;
  expiresAt: string;
}

export interface FinalPickupPriceQuote {
  quoteId: string;
  amountCentavos: number;
  currency: 'PHP';
  breakdown: {
    legacyWasteTypeFeeCentavos?: number;
    wasteTypeFeesCentavos?: number;
    basePickupFeeCentavos?: number;
    minimumBookingPriceCentavos?: number;
    baseAmountCentavos?: number;
    loadCategory?: 'none' | 'medium' | 'large';
    distanceCentavos: number;
    loadSurchargeCentavos: number | null;
    totalCentavos: number;
    facilityTransportDistanceMeters?: number;
    facilityTransportTierIndex?: number;
    facilityTransportLowerBoundKm?: number;
    facilityTransportUpperBoundKm?: number | null;
    facilityId?: string;
    riderDistanceMeters?: number;
    riderDistanceTierIndex?: number;
    riderDistanceLowerBoundKm?: number;
    riderDistanceUpperBoundKm?: number | null;
  };
  items?: PickupQuoteItemSnapshot[];
  pricingVersion: string;
}

export interface ConfirmedFinalPickupPrice {
  success: true;
  pickupId: string;
  alreadyConfirmed: boolean;
}

export interface CancelledPickup {
  pickupId: string;
  status: 'cancelled';
  alreadyCancelled: boolean;
}

const FINAL_PRICE_FAILURE_REASONS = [
  'PRICING_FACILITY_COORDINATES_UNAVAILABLE',
  'PRICING_FACILITY_ROUTE_UNAVAILABLE',
  'PRICING_FACILITY_ASSIGNMENT_UNAVAILABLE',
  'PRICING_FACILITY_ASSIGNMENT_CHANGED',
  'PRICING_PICKUP_LOCATION_UNAVAILABLE',
  'PRICING_FACILITY_TRANSPORT_TIERS_UNRESOLVED',
  'PRICING_RIDER_NO_DRIVABLE_ROUTE',
  'PRICING_RIDER_ROUTE_PROVIDER_CONFIGURATION',
  'PRICING_RIDER_ROUTE_PROVIDER_CAPACITY',
  'PRICING_RIDER_ROUTE_PROVIDER_TIMEOUT',
  'PRICING_RIDER_ROUTE_PROVIDER_NETWORK',
  'PRICING_RIDER_ROUTE_INVALID',
  'PRICING_RIDER_ROUTE_UNAVAILABLE',
  'PRICING_RIDER_ROUTE_RESOLUTION_FAILED',
  'PRICING_ACCEPTANCE_LOCATION_INVALID',
  'PRICING_RIDER_DISTANCE_TIERS_UNRESOLVED',
  'PRICING_PICKUP_ADDRESS_CHANGED',
] as const;

export function getFinalPriceResolutionMessage(error: unknown): string {
  const reason = typeof error === 'object' &&
    error !== null &&
    'details' in error &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'reason' in error.details &&
    typeof error.details.reason === 'string' &&
    (FINAL_PRICE_FAILURE_REASONS as readonly string[])
      .includes(error.details.reason)
    ? error.details.reason
    : '';
  if (reason === 'PRICING_FACILITY_COORDINATES_UNAVAILABLE') {
    return 'The assigned facility needs valid map coordinates. Your request is saved; an administrator must update the facility before pricing can finish.';
  }
  if (reason === 'PRICING_FACILITY_ROUTE_UNAVAILABLE') {
    return 'The road route to the assigned facility is unavailable. Your pickup is saved; retry when routing is available.';
  }
  if (
    reason === 'PRICING_FACILITY_ASSIGNMENT_CHANGED' ||
    reason === 'PRICING_FACILITY_ASSIGNMENT_UNAVAILABLE'
  ) {
    return 'The assigned facility or its reservation changed. Refresh the pickup and retry final pricing.';
  }
  if (reason === 'PRICING_PICKUP_LOCATION_UNAVAILABLE') {
    return 'The saved pickup location is unavailable for route pricing. Contact support before accepting a final price.';
  }
  if (reason === 'PRICING_FACILITY_TRANSPORT_TIERS_UNRESOLVED') {
    return 'Facility transport pricing is not configured. Contact support before accepting a final price.';
  }
  if (reason === 'PRICING_RIDER_NO_DRIVABLE_ROUTE') {
    return 'The road route could not be calculated. Your pickup is saved; retry when routing is available.';
  }
  if (reason) {
    return 'The final price service is temporarily unavailable. Your pickup is still saved; please retry later.';
  }
  const code = typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code.replace(/^functions\//, '')
    : '';
  if (code === 'failed-precondition') {
    return 'The pickup state changed or the final price is not ready. Refresh the pickup and try again.';
  }
  if (code === 'permission-denied' || code === 'not-found') {
    return 'This pickup is no longer available for price review.';
  }
  return 'The final price could not be loaded. Your pickup is still saved; check your connection and retry.';
}

export interface PickupSchedulingSettings {
  schemaVersion: 1;
  timezone: 'Asia/Manila';
  operatingDays: number[];
  openingTime: string;
  closingTime: string;
  sameDayCutoff: string;
}

export interface PickupSchedulingResponse {
  current: PickupSchedulingSettings | null;
  version: number | null;
}

export interface QuoteChangedResult {
  success: false;
  quoteChanged: true;
  revisedQuote: PickupQuote;
}

export interface SavedPickupAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
  latitude: number;
  longitude: number;
}

export interface PickupTrackingSnapshot {
  pickupId: string;
  status: string;
  riderId?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  destination: { latitude: number; longitude: number } | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  riderLocation: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
}

export function getPickupCancellationLabel(
  cancelledBy: string | null | undefined,
  customerUid: string | null | undefined,
  assignedRiderId?: string | null,
): string {
  if (cancelledBy && customerUid && cancelledBy === customerUid) {
    return 'Cancelled by you.';
  }
  if (cancelledBy && assignedRiderId && cancelledBy === assignedRiderId) {
    return 'Cancelled by your Rider.';
  }
  return 'Pickup cancelled.';
}

export interface PickupRiderContact {
  riderAssigned: boolean;
  riderFound: boolean;
  riderName: string | null;
  phoneNumber: string | null;
}

export interface CustomerPickupHistoryItem {
  pickupId: string;
  status: string;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  pricingStage: string | null;
  finalPriceResolutionReason: string | null;
  pickupAddress: string | null;
  wasteTypeName: string | null;
  bagSizeLabel: string | null;
  quantity: number | null;
  estimatedWeightKg: number | null;
  actualWeightKg: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  acceptedAmountCentavos: number | null;
  pricingVersion: string | null;
  pricingSource: string | null;
  breakdown: {
    legacyWasteTypeFeeCentavos: number | null;
    wasteTypeFeesCentavos: number | null;
    basePickupFeeCentavos: number | null;
    minimumBookingPriceCentavos: number | null;
    baseAmountCentavos: number | null;
    loadCategory: 'none' | 'medium' | 'large' | null;
    riderId: string | null;
    billableDistanceMeters: number | null;
    riderDistanceMeters: number | null;
    riderDistanceTierIndex: number | null;
    riderDistanceLowerBoundKm: number | null;
    riderDistanceUpperBoundKm: number | null;
    riderLocationUpdatedAt: string | null;
    facilityTransportDistanceMeters: number | null;
    facilityTransportTierIndex: number | null;
    facilityTransportLowerBoundKm: number | null;
    facilityTransportUpperBoundKm: number | null;
    facilityId: string | null;
    distanceCentavos: number | null;
    loadSurchargeCentavos: number | null;
    totalCentavos: number | null;
  } | null;
  items: {
    wasteTypeId: string;
    wasteTypeName: string;
    bagSizeId: string;
    bagSizeLabel: string;
    quantity: number;
    estimatedWeightKg: number;
    pickupFeeCentavosPerBag: number | null;
    pickupFeeSubtotalCentavos: number | null;
  }[] | null;
  currency: string | null;
  facilityName: string | null;
  createdAt: string | null;
}

export interface NewPickupAddress {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface BagSizeOption {
  id: string;
  label: string;
  estimatedWeightKg: number;
}

export interface ActiveWasteType {
  id: string;
  name: string;
  description: string;
  pricingModel: 'fixed';
  pickupFee: number;
  currency: 'PHP';
  bagSizeOptions: BagSizeOption[];
}

export type PickupQuoteInput = Omit<SubmitPickupInput,
  'submissionId' | 'quoteId' | 'acceptedAmountCentavos' |
  'acceptedPricingVersion' | 'trashPhotoPaths'>;

const PICKUP_QUOTE_FAILURE_REASONS = [
  'PRICING_PICKUP_ADDRESS_UNAVAILABLE',
  'PRICING_PICKUP_ADDRESS_INVALID',
  'PRICING_PICKUP_ADDRESS_CHANGED',
  'PRICING_RIDER_CANDIDATE_LIMIT',
  'PRICING_RIDER_LOCATION_UNAVAILABLE',
  'PRICING_RIDER_ROUTE_UNAVAILABLE',
  'PRICING_RIDER_ROUTE_INVALID',
  'PRICING_RIDER_NO_DRIVABLE_ROUTE',
  'PRICING_RIDER_ROUTE_PROVIDER_CONFIGURATION',
  'PRICING_RIDER_ROUTE_PROVIDER_CAPACITY',
  'PRICING_RIDER_ROUTE_PROVIDER_TIMEOUT',
  'PRICING_RIDER_ROUTE_PROVIDER_NETWORK',
  'PRICING_RIDER_ROUTE_RESULT_INVALID',
  'PRICING_RIDER_ROUTE_RESOLUTION_FAILED',
] as const;

export type PickupQuoteFailureReason =
  typeof PICKUP_QUOTE_FAILURE_REASONS[number];

export function getPickupQuoteFailureReason(
  error: unknown,
): PickupQuoteFailureReason | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('details' in error) ||
    typeof error.details !== 'object' ||
    error.details === null ||
    !('reason' in error.details) ||
    error.details.reason !== 'PRICING_RIDER_DISTANCE_UNAVAILABLE' ||
    !('resolverReason' in error.details)
  ) {
    return null;
  }
  const resolverReason = error.details.resolverReason;
  return typeof resolverReason === 'string' &&
    (PICKUP_QUOTE_FAILURE_REASONS as readonly string[])
      .includes(resolverReason)
    ? resolverReason as PickupQuoteFailureReason
    : null;
}

export function getPickupQuoteFailureMessage(
  error: unknown,
): string | null {
  switch (getPickupQuoteFailureReason(error)) {
    case 'PRICING_RIDER_LOCATION_UNAVAILABLE':
      return 'The pricing service unexpectedly required a Rider location while preparing your request. No pickup was saved; please retry or contact support if this continues.';
    case 'PRICING_RIDER_NO_DRIVABLE_ROUTE':
      return 'The pricing service unexpectedly required a Rider road route while preparing your request. No pickup was saved; please retry or contact support if this continues.';
    case 'PRICING_PICKUP_ADDRESS_UNAVAILABLE':
    case 'PRICING_PICKUP_ADDRESS_INVALID':
      return 'Your saved pickup address is unavailable. Reload your addresses or choose another address.';
    case 'PRICING_PICKUP_ADDRESS_CHANGED':
      return 'Your pickup address changed while preparing the request. Confirm the address and submit again.';
    case 'PRICING_RIDER_CANDIDATE_LIMIT':
    case 'PRICING_RIDER_ROUTE_UNAVAILABLE':
    case 'PRICING_RIDER_ROUTE_INVALID':
    case 'PRICING_RIDER_ROUTE_PROVIDER_CONFIGURATION':
    case 'PRICING_RIDER_ROUTE_PROVIDER_CAPACITY':
    case 'PRICING_RIDER_ROUTE_PROVIDER_TIMEOUT':
    case 'PRICING_RIDER_ROUTE_PROVIDER_NETWORK':
    case 'PRICING_RIDER_ROUTE_RESULT_INVALID':
    case 'PRICING_RIDER_ROUTE_RESOLUTION_FAILED':
      return 'The pricing service unexpectedly attempted Rider-distance pricing while preparing your request. No pickup was saved; please retry or contact support if this continues.';
    default:
      return null;
  }
}

function getSavedLocation(value: unknown): {
  latitude: number;
  longitude: number;
} | null {
  const location = value instanceof GeoPoint
    ? { latitude: value.latitude, longitude: value.longitude }
    : typeof value === 'object' && value !== null
      ? value as { latitude?: unknown; longitude?: unknown; lat?: unknown; lng?: unknown }
      : null;
  if (!location) return null;
  const latitude = typeof location.latitude === 'number'
    ? location.latitude
    : location.lat;
  const longitude = typeof location.longitude === 'number'
    ? location.longitude
    : location.lng;
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) ||
    latitude < -90 || latitude > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) ||
    longitude < -180 || longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function isMeaningfulPickupAddress(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= 8 && normalized.split(' ').length >= 2;
}

const submitPickupCallable = httpsCallable<
  LegacySubmitPickupInput,
  LegacySubmittedPickup
>(functions, 'submitPickupFunction');

const confirmPickupQuoteCallable = httpsCallable<
  SubmitPickupInput,
  SubmittedPickup | QuoteChangedResult
>(functions, 'confirmPickupQuoteFunction');

const quotePickupCallable = httpsCallable<
  PickupQuoteInput,
  PickupQuote
>(functions, 'quotePickupFunction');

const listActiveWasteTypesCallable = httpsCallable<
  Record<string, never>,
  { wasteTypes: ActiveWasteType[] }
>(functions, 'listActiveWasteTypesFunction');

const getPickupSchedulingSettingsCallable = httpsCallable<
  Record<string, never>,
  PickupSchedulingResponse
>(functions, 'getPickupSchedulingSettingsFunction');

const getPickupTrackingCallable = httpsCallable<
  { pickupId: string },
  PickupTrackingSnapshot
>(functions, 'getPickupTrackingFunction');

export type PickupCancellationVerification =
  | { status: 'exists'; pickupStatus: string }
  | { status: 'absent' }
  | { status: 'unverified' };

const verifyPickupCancellationCallable = httpsCallable<
  { submissionId: string },
  PickupCancellationVerification
>(functions, 'verifyPickupCancellationFunction');

const getPickupRiderContactCallable = httpsCallable<
  { pickupId: string },
  PickupRiderContact
>(functions, 'getPickupRiderContactFunction');

const listCustomerPickupHistoryCallable = httpsCallable<
  Record<string, never>,
  { pickups: CustomerPickupHistoryItem[] }
>(functions, 'listCustomerPickupHistoryFunction');

const resolvePickupFinalPriceCallable = httpsCallable<
  { pickupId: string },
  FinalPickupPriceQuote
>(functions, 'resolvePickupFinalPriceFunction');

const confirmPickupFinalPriceCallable = httpsCallable<
  {
    pickupId: string;
    quoteId: string;
    acceptedAmountCentavos: number;
    pricingVersion: string;
  },
  ConfirmedFinalPickupPrice
>(functions, 'confirmPickupFinalPriceFunction');

const cancelPickupCallable = httpsCallable<
  { pickupId: string },
  CancelledPickup
>(functions, 'cancelPickupFunction');

async function cancelPickupWithCallable(
  pickupId: string,
): Promise<CancelledPickup> {
  const currentUser = firebaseAuth.currentUser;
  let tokenObtained = false;
  let tokenClaimsValid = false;

  if (currentUser) {
    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      tokenObtained = tokenResult.token.length > 0;
      tokenClaimsValid =
        tokenResult.claims.aud === firebaseAuth.app.options.projectId &&
        tokenResult.claims.iss ===
          `https://securetoken.google.com/${firebaseAuth.app.options.projectId}`;
    } catch {
      tokenObtained = false;
      tokenClaimsValid = false;
    }
  }

  const result = await cancelPickupCallable({ pickupId });
  if (
    result.data?.status !== 'cancelled' ||
    result.data.pickupId !== pickupId ||
    typeof result.data.alreadyCancelled !== 'boolean'
  ) {
    throw new Error('The pickup cancellation was not verified.');
  }
  return result.data;
}

export async function getCustomerPickupHistory(): Promise<
  CustomerPickupHistoryItem[]
> {
  const result = await listCustomerPickupHistoryCallable({});
  return result.data.pickups.map((item) => {
    const cancellationMetadata = normalizeCancellationMetadata(
      item.status,
      item.cancelledBy,
      item.cancellationReason,
    );
    return {...item, ...cancellationMetadata};
  });
}

export async function getPickupTracking(
  pickupId: string,
): Promise<PickupTrackingSnapshot> {
  const result = await getPickupTrackingCallable({ pickupId });
  return {
    ...result.data,
    riderId:
      typeof result.data.riderId === 'string' &&
      result.data.riderId.trim().length <= 128
        ? result.data.riderId.trim() || null
        : null,
    ...normalizeCancellationMetadata(
      result.data.status,
      result.data.cancelledBy,
      result.data.cancellationReason,
    ),
  };
}

export async function verifyPickupCancellation(
  submissionId: string,
): Promise<PickupCancellationVerification> {
  try {
    const result = await verifyPickupCancellationCallable({submissionId});
    if (
      result.data?.status === 'exists' &&
      typeof result.data.pickupStatus === 'string'
    ) {
      return result.data;
    }
    if (
      result.data?.status === 'absent' ||
      result.data?.status === 'unverified'
    ) return result.data;
    console.error(
      'verifyPickupCancellationFunction returned an invalid status.',
    );
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : 'unknown';
    console.error('verifyPickupCancellationFunction failed:', {
      code,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return {status: 'unverified'};
}

function normalizeCancellationMetadata(
  status: string,
  cancelledBy: unknown,
  cancellationReason: unknown,
): {cancelledBy: string | null; cancellationReason: string | null} {
  if (status !== 'cancelled') {
    return {cancelledBy: null, cancellationReason: null};
  }
  const normalize = (value: unknown, maximumLength: number): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= maximumLength
      ? normalized
      : null;
  };
  return {
    cancelledBy: normalize(cancelledBy, 128),
    cancellationReason: normalize(cancellationReason, 500),
  };
}

export async function getPickupRiderContact(
  pickupId: string,
): Promise<PickupRiderContact> {
  const result = await getPickupRiderContactCallable({ pickupId });
  const contact = result.data;
  if (
    !contact ||
    typeof contact.riderAssigned !== 'boolean' ||
    typeof contact.riderFound !== 'boolean' ||
    (contact.riderName !== null && typeof contact.riderName !== 'string') ||
    (contact.phoneNumber !== null &&
      typeof contact.phoneNumber !== 'string')
  ) {
    throw new Error('The Rider contact response was invalid.');
  }

  const riderName = contact.riderName?.trim() || null;
  const storedPhone = contact.phoneNumber?.trim() || '';
  const phoneNumber = /^\+[1-9]\d{7,14}$/.test(storedPhone)
    ? storedPhone
    : null;

  return {
    riderAssigned: contact.riderAssigned,
    riderFound: contact.riderFound,
    riderName,
    phoneNumber,
  };
}

export async function resolvePickupFinalPrice(
  pickupId: string,
): Promise<FinalPickupPriceQuote> {
  const result = await resolvePickupFinalPriceCallable({ pickupId });
  const quote = result.data;
  if (
    !quote ||
    typeof quote.quoteId !== 'string' ||
    !quote.quoteId ||
    !Number.isSafeInteger(quote.amountCentavos) ||
    quote.amountCentavos < 0 ||
    quote.currency !== 'PHP' ||
    typeof quote.pricingVersion !== 'string' ||
    !quote.pricingVersion ||
    typeof quote.breakdown !== 'object' ||
    quote.breakdown === null ||
    !Number.isSafeInteger(quote.breakdown.distanceCentavos) ||
    quote.breakdown.distanceCentavos < 0 ||
    !Number.isSafeInteger(quote.breakdown.totalCentavos) ||
    quote.breakdown.totalCentavos !== quote.amountCentavos
  ) {
    throw new Error('The final pickup price response was invalid.');
  }
  return quote;
}

export async function confirmPickupFinalPrice(
  pickupId: string,
  quote: FinalPickupPriceQuote,
): Promise<ConfirmedFinalPickupPrice> {
  const result = await confirmPickupFinalPriceCallable({
    pickupId,
    quoteId: quote.quoteId,
    acceptedAmountCentavos: quote.amountCentavos,
    pricingVersion: quote.pricingVersion,
  });
  if (
    result.data?.success !== true ||
    result.data.pickupId !== pickupId ||
    typeof result.data.alreadyConfirmed !== 'boolean'
  ) {
    throw new Error('The final pickup price confirmation was not verified.');
  }
  return result.data;
}

export async function cancelPickupRequest(
  pickupId: string,
): Promise<CancelledPickup> {
  return cancelPickupWithCallable(pickupId);
}

export async function declinePickupFinalPrice(
  pickupId: string,
): Promise<CancelledPickup> {
  return cancelPickupWithCallable(pickupId);
}

export async function getSavedPickupAddresses(
  customerId: string,
): Promise<SavedPickupAddress[]> {
  const addressesRef = collection(
    firestore,
    'customers',
    customerId,
    'addresses',
  );

  const snapshot = await getDocs(addressesRef);

  return snapshot.docs.flatMap((addressDoc) => {
    const data = addressDoc.data();
    const location = getSavedLocation(data.location);

    if (
      typeof data.address !== 'string' ||
      !isMeaningfulPickupAddress(data.address) ||
      !location
    ) {
      return [];
    }

    return [{
      id: addressDoc.id,
      label: typeof data.label === 'string' ? data.label : '',
      address: data.address.trim(),
      isDefault: data.isDefault === true,
      ...location,
    }];
  });
}

export async function savePickupAddress(
  customerId: string,
  input: NewPickupAddress,
): Promise<string> {
  const address = input.address.trim();
  const label = input.label.trim();
  const { latitude, longitude } = input;

  if (
    !customerId ||
    !isMeaningfulPickupAddress(address) ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Enter a meaningful address and capture a valid location.');
  }

  const addressesRef = collection(
    firestore,
    'customers',
    customerId,
    'addresses',
  );
  const created = await addDoc(addressesRef, {
    label: label || 'Pickup address',
    address,
    location: new GeoPoint(latitude, longitude),
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return created.id;
}

export async function getActivePickupWasteTypes(): Promise<
  ActiveWasteType[]
> {
  const result = await listActiveWasteTypesCallable({});
  return result.data.wasteTypes;
}

export async function getPickupSchedulingSettings(
  expectedAuthContextUid: string | null,
): Promise<PickupSchedulingResponse> {
  const userBeforeToken = firebaseAuth.currentUser;
  const authContextUidMatches =
    userBeforeToken?.uid === expectedAuthContextUid;
  const sameFirebaseApp = firebaseAuth.app === functions.app;
  const sameFirebaseProject =
    firebaseAuth.app.options.projectId === functions.app.options.projectId;
  let tokenReady = false;

  if (
    userBeforeToken &&
    authContextUidMatches &&
    sameFirebaseApp &&
    sameFirebaseProject
  ) {
    await userBeforeToken.getIdToken();
    tokenReady = true;
  }

  const currentUser = firebaseAuth.currentUser;
  if (__DEV__) {
    console.info('[Pickup scheduling auth diagnostic]', {
      currentUserPresent: Boolean(currentUser),
      authContextUidMatchesCurrentUser:
        currentUser?.uid === expectedAuthContextUid,
      sameFirebaseApp,
      sameFirebaseProject,
      tokenReady,
    });
  }

  if (!currentUser) {
    throw Object.assign(
      new Error('Sign in to load pickup scheduling settings.'),
      { code: 'customer/auth-required' },
    );
  }
  if (
    currentUser.uid !== expectedAuthContextUid ||
    !sameFirebaseApp ||
    !sameFirebaseProject ||
    !tokenReady
  ) {
    throw Object.assign(
      new Error('The signed-in session changed before loading pickup scheduling settings.'),
      { code: 'customer/auth-state-mismatch' },
    );
  }

  const result = await getPickupSchedulingSettingsCallable({});
  return result.data;
}

export async function submitPickup(
  input: LegacySubmitPickupInput,
): Promise<LegacySubmittedPickup> {
  const result = await submitPickupCallable(input);
  return result.data;
}

export async function confirmPickupQuote(
  input: SubmitPickupInput,
): Promise<SubmittedPickup | QuoteChangedResult> {
  const result = await confirmPickupQuoteCallable(input);
  return result.data;
}

export async function quotePickup(
  input: PickupQuoteInput,
): Promise<PickupQuote> {
  const result = await quotePickupCallable(input);
  return result.data;
}
