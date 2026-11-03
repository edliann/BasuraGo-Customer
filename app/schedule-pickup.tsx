import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import RemixIcon from 'react-native-remix-icon';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  doc,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/services/firebase';
import { goBackOrReplace } from '@/navigation/back';
import {
  createPickupTimePickerValue,
  formatPickupTime,
  PICKUP_TIMEZONE,
  pickupTimeFromPickerEvent,
} from '@/utils/pickupTime';
import {
  calculateWasteTypeSubtotal,
  formatPesoAmount,
} from '@/utils/pricing';
import {
  getActivePickupWasteTypes,
  getPickupQuoteFailureMessage,
  getPickupQuoteFailureReason,
  getPickupSchedulingSettings,
  getSavedPickupAddresses,
  quotePickup,
  confirmPickupQuote,
  verifyPickupCancellation,
  type ActiveWasteType,
  type PickupQuoteItemInput,
  type PickupQuoteInput,
  type PickupSchedulingSettings,
  type SavedPickupAddress,
  type SubmittedPickup,
} from '@/services/pickups';
import {
  appendPickupQuoteItem,
  snapshotPickupQuoteItems,
} from '@/services/pickupItems';
import {
  InvalidPickupQuoteError,
  submitPickupRequest,
  type PersistedPickupQuote,
} from '@/services/pickupSubmission';
import {
  PickupPhotoPathConflictError,
  PickupPhotoRecoveryBlockedError,
  preparePickupTrashPhotoPaths,
  uploadPickupTrashPhotos,
  type PickupPhotoSelection,
} from '@/services/pickupPhotos';

type SubmissionPayload = PickupQuoteInput;
type TrashPhotoSource = 'camera' | 'gallery';

interface SelectedTrashPhoto extends PickupPhotoSelection {
  source: TrashPhotoSource;
}

function SelectedTrashPhotoPreview({
  uri,
  index,
}: {
  uri: string;
  index: number;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [uri]);

  return (
    <View style={styles.trashPhotoThumbnail}>
      {!failed ? (
        <Image
          source={{uri}}
          style={styles.trashPhotoThumbnailImage}
          accessibilityLabel={`Selected trash photo ${index + 1}`}
          resizeMode="cover"
          resizeMethod="resize"
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      ) : (
        <View style={styles.trashPhotoPreviewFallback}>
          <RemixIcon name="image-line" size={20} color="#87948A" />
        </View>
      )}
      {loading && !failed ? (
        <View style={styles.trashPhotoPreviewLoading}>
          <ActivityIndicator size="small" color="#176744" />
        </View>
      ) : null}
    </View>
  );
}

const MAX_TRASH_PHOTOS = 5;
const SUCCESS_CONFETTI = [
  {left: 14, top: 26, color: '#1f7a3f'},
  {left: 39, top: 8, color: '#e9a23b'},
  {left: 66, top: 23, color: '#6aa879'},
  {left: 105, top: 15, color: '#e9a23b'},
  {left: 136, top: 32, color: '#1f7a3f'},
  {left: 158, top: 9, color: '#6aa879'},
  {left: 84, top: 2, color: '#d9826b'},
];

interface ConfettiParticleProps {
  index: number;
  left: number;
  top: number;
  color: string;
}

function ConfettiParticle({index, left, top, color}: ConfettiParticleProps) {
  const progress = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.72, 1], [0, 1, 0.8, 0]),
    transform: [
      {translateY: interpolate(progress.value, [0, 1], [-8, 82])},
      {translateX: interpolate(progress.value, [0, 1], [0, index % 2 ? 12 : -12])},
      {rotate: `${interpolate(progress.value, [0, 1], [0, index % 2 ? 150 : -150])}deg`},
    ],
  }));

  useEffect(() => {
    progress.value = withDelay(
      index * 75,
      withTiming(1, {
        duration: 1300,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [index, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiParticle,
        {left, top, backgroundColor: color},
        style,
      ]}
    />
  );
}

const PICKUP_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface PendingSubmission {
  id: string;
  payload: SubmissionPayload;
  quote?: PersistedPickupQuote;
  trashPhotoPaths?: string[];
  trashPhotoUploadPending?: boolean;
  trashPhotoRecoveryBlocked?: boolean;
}

function getPendingSubmissionKey(customerId: string): string {
  return `basurago:pending-pickup:v1:${customerId}`;
}

function parsePendingSubmission(value: string): PendingSubmission | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !parsed.id ||
      !('payload' in parsed) ||
      typeof parsed.payload !== 'object' ||
      parsed.payload === null
    ) {
      return null;
    }
    const payload = parsed.payload as Record<string, unknown>;
    const validItems = Array.isArray(payload.items) &&
      payload.items.length >= 1 &&
      payload.items.length <= 20 &&
      payload.items.every((value) => {
        if (typeof value !== 'object' || value === null) return false;
        const item = value as Record<string, unknown>;
        return typeof item.wasteTypeId === 'string' &&
          typeof item.bagSizeId === 'string' &&
          typeof item.quantity === 'number' &&
          Number.isInteger(item.quantity) && item.quantity >= 1 &&
          item.quantity <= 20;
      }) &&
      payload.items.reduce((total: number, value) =>
        total + (value as {quantity: number}).quantity, 0) <= 20;
    const validLegacyItem =
      typeof payload.wasteTypeId === 'string' &&
      typeof payload.bagSizeId === 'string' &&
      typeof payload.quantity === 'number' &&
      Number.isInteger(payload.quantity) &&
      payload.quantity >= 1 && payload.quantity <= 20;
    if (
      typeof payload.addressId !== 'string' ||
      (!validItems && !validLegacyItem) ||
      typeof payload.scheduledDate !== 'string' ||
      typeof payload.scheduledTime !== 'string' ||
      (payload.notes !== undefined && typeof payload.notes !== 'string')
    ) {
      return null;
    }
    const quoteValue = 'quote' in parsed &&
      typeof parsed.quote === 'object' &&
      parsed.quote !== null &&
      'quoteId' in parsed.quote &&
      typeof parsed.quote.quoteId === 'string' &&
      'schemaVersion' in parsed.quote &&
      parsed.quote.schemaVersion === 2 &&
      'quoteType' in parsed.quote &&
      parsed.quote.quoteType === 'initial_estimate' &&
      'amountCentavos' in parsed.quote &&
      typeof parsed.quote.amountCentavos === 'number' &&
      'currency' in parsed.quote &&
      parsed.quote.currency === 'PHP' &&
      'pricingVersion' in parsed.quote &&
      typeof parsed.quote.pricingVersion === 'string' &&
      'expiresAt' in parsed.quote &&
      typeof parsed.quote.expiresAt === 'string' &&
      'breakdown' in parsed.quote &&
      typeof parsed.quote.breakdown === 'object' &&
      parsed.quote.breakdown !== null
      ? parsed.quote as PersistedPickupQuote
      : undefined;
    const trashPhotoPaths = 'trashPhotoPaths' in parsed
      ? parsed.trashPhotoPaths
      : undefined;
    const trashPhotoUploadPending = 'trashPhotoUploadPending' in parsed
      ? parsed.trashPhotoUploadPending
      : undefined;
    const trashPhotoRecoveryBlocked = 'trashPhotoRecoveryBlocked' in parsed
      ? parsed.trashPhotoRecoveryBlocked
      : undefined;
    if (
      trashPhotoPaths !== undefined &&
      (!Array.isArray(trashPhotoPaths) ||
        trashPhotoPaths.length > MAX_TRASH_PHOTOS ||
        !trashPhotoPaths.every((path) => typeof path === 'string' && path) ||
        new Set(trashPhotoPaths).size !== trashPhotoPaths.length)
    ) {
      return null;
    }
    if (
      trashPhotoUploadPending !== undefined &&
      typeof trashPhotoUploadPending !== 'boolean'
    ) {
      return null;
    }
    if (
      trashPhotoRecoveryBlocked !== undefined &&
      typeof trashPhotoRecoveryBlocked !== 'boolean'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      payload: payload as SubmissionPayload,
      ...(quoteValue ? { quote: quoteValue } : {}),
      ...(Array.isArray(trashPhotoPaths) && trashPhotoPaths.length > 0
        ? {trashPhotoPaths}
        : {}),
      ...(trashPhotoUploadPending === true
        ? {trashPhotoUploadPending: true}
        : {}),
      ...(trashPhotoRecoveryBlocked === true
        ? {trashPhotoRecoveryBlocked: true}
        : {}),
    };
  } catch {
    return null;
  }
}

function getCallableErrorCode(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code.replace(/^functions\//, '')
      : '';
}

function getSchedulingErrorReason(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'details' in error &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'reason' in error.details &&
    typeof error.details.reason === 'string'
      ? error.details.reason
      : '';
}

function getErrorMessage(error: unknown): string {
  const code = getCallableErrorCode(error);
  const schedulingReason = getSchedulingErrorReason(error);

  if (schedulingReason.startsWith('SCHEDULE_')) {
    return error instanceof Error
      ? error.message
      : 'That pickup date or time is no longer available. Choose another slot.';
  }
  if (schedulingReason === 'SCHEDULING_SETTINGS_UNAVAILABLE') {
    return 'Pickup scheduling has not been configured yet. Please try again later.';
  }
  if (schedulingReason === 'SCHEDULING_SETTINGS_INVALID') {
    return 'Pickup scheduling is temporarily unavailable. Please try again later.';
  }

  if (code === 'unauthenticated' || code === 'permission-denied') {
    return 'Your customer session or account is no longer active. Sign in again or contact support.';
  }
  if (code === 'failed-precondition') {
    return error instanceof Error
      ? error.message
      : 'No eligible facility could accept this pickup. Please try again later.';
  }
  if (code === 'not-found') {
    return 'The selected saved address is no longer available. Reload your addresses and choose another one.';
  }
  if (code === 'already-exists') {
    return 'This booking reference was already used. Start a new pickup request.';
  }
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network-request-failed'
  ) {
    return 'The service could not be reached. Check your connection and retry; the same submission ID will be reused.';
  }
  if (code === 'invalid-argument' && error instanceof Error) {
    return error.message;
  }
  return 'Unable to submit the pickup. Check your details and retry.';
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
  ));
  return date.getUTCFullYear() === Number(yearText) &&
    date.getUTCMonth() === Number(monthText) - 1 &&
    date.getUTCDate() === Number(dayText);
}

function isValidTime(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  if (!isValidDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getScheduleSelectionError(
  date: string,
  time: string,
  settings: PickupSchedulingSettings | null,
): string | null {
  if (!settings) return 'Pickup scheduling is not configured yet.';
  if (!isValidDate(date) || !isValidTime(time)) {
    return 'Choose a valid pickup date and time.';
  }
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (!settings.operatingDays.includes(weekday)) {
    return 'The selected date is not an operating day. Choose another date.';
  }
  if (time < settings.openingTime || time >= settings.closingTime) {
    return `Choose a pickup time from ${settings.openingTime} up to, but not including, ${settings.closingTime} Philippine time.`;
  }
  return null;
}

function sanitizeCallableError(error: unknown): { code: string; message: string } {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).replace(/^functions\//, '').slice(0, 80)
    : 'unknown';
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : 'No error message supplied';
  const message = rawMessage
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
  return { code, message };
}

export default function SchedulePickupScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const reducedMotion = useReducedMotion();
  const [addresses, setAddresses] = useState<SavedPickupAddress[]>([]);
  const [wasteTypes, setWasteTypes] = useState<ActiveWasteType[]>([]);
  const [pickupSchedule, setPickupSchedule] =
    useState<PickupSchedulingSettings | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingWasteTypes, setLoadingWasteTypes] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [wasteTypeError, setWasteTypeError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedWasteTypeId, setSelectedWasteTypeId] = useState('');
  const [selectedBagSizeId, setSelectedBagSizeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [requestItems, setRequestItems] = useState<PickupQuoteItemInput[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [trashPhotos, setTrashPhotos] =
    useState<SelectedTrashPhoto[]>([]);
  const [uploadedTrashPhotoPaths, setUploadedTrashPhotoPaths] =
    useState<string[]>([]);
  const [trashPhotoRetryLocked, setTrashPhotoRetryLocked] = useState(false);
  const [selectingTrashPhotos, setSelectingTrashPhotos] = useState(false);
  const [trashPhotoPickerSource, setTrashPhotoPickerSource] =
    useState<TrashPhotoSource | null>(null);
  const [trashPhotoError, setTrashPhotoError] = useState('');
  const [workflowStep, setWorkflowStep] = useState<0 | 1 | 2>(0);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingPendingSubmission, setCancellingPendingSubmission] =
    useState(false);
  const [requestingQuote, setRequestingQuote] = useState(false);
  const [restoringSubmission, setRestoringSubmission] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [quote, setQuote] = useState<PersistedPickupQuote | null>(null);
  const [confirmation, setConfirmation] = useState<SubmittedPickup | null>(
    null,
  );
  const pickupScheduleRequestInFlight = useRef(false);
  const addressesRequestInFlight = useRef(false);
  const wasteTypesRequestInFlight = useRef(false);
  const optionsRefreshInFlight = useRef(false);
  const submissionInFlight = useRef(false);
  const trashPhotoPickerInFlight = useRef(false);
  const pendingSubmission = useRef<PendingSubmission | null>(null);
  const pendingSubmissionCustomer = useRef<string | null>(null);

  const selectedWasteType = wasteTypes.find(
    (item) => item.id === selectedWasteTypeId,
  );

  const selectedBagSize = selectedWasteType?.bagSizeOptions.find(
    (item) => item.id === selectedBagSizeId,
  );
  const selectedWasteTypeSubtotal = selectedWasteType ?
    calculateWasteTypeSubtotal(selectedWasteType.pickupFee, quantity) : null;

  const estimatedWeight =
    selectedBagSize ? selectedBagSize.estimatedWeightKg * quantity : 0;
  const totalQuantity = requestItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const requestEstimatedWeight = requestItems.reduce((total, item) => {
    const wasteType = wasteTypes.find((candidate) =>
      candidate.id === item.wasteTypeId,
    );
    const bag = wasteType?.bagSizeOptions.find((candidate) =>
      candidate.id === item.bagSizeId,
    );
    return total + (bag ? bag.estimatedWeightKg * item.quantity : 0);
  }, 0);
  const firstRequestItem = requestItems[0];
  const firstRequestWasteType = wasteTypes.find((item) =>
    item.id === firstRequestItem?.wasteTypeId,
  );
  const firstRequestBagSize = firstRequestWasteType?.bagSizeOptions.find(
    (item) => item.id === firstRequestItem?.bagSizeId,
  );

  const loadAddresses = useCallback(async (isRefresh = false) => {
    if (!firebaseUser || addressesRequestInFlight.current) return;
    addressesRequestInFlight.current = true;
    if (!isRefresh) {
      setLoadingAddresses(true);
      setAddressError('');
    }
    try {
      const result = await getSavedPickupAddresses(firebaseUser.uid);
      setAddressError('');
      setAddresses(result);
      setSelectedAddressId((current) =>
        result.some((address) => address.id === current)
          ? current
          : result.find((address) => address.isDefault)?.id ??
            result[0]?.id ??
            '',
      );
    } catch (error) {
      console.error('Failed to load customer pickup addresses:', error);
      if (isRefresh) {
        setRefreshError('Saved pickup addresses could not be refreshed. Your form and selections are unchanged.');
      } else {
        setAddressError(
          'Saved addresses could not be loaded. Check your connection and retry.',
        );
      }
    } finally {
      addressesRequestInFlight.current = false;
      if (!isRefresh) setLoadingAddresses(false);
    }
  }, [firebaseUser]);

  const restorePendingSubmission = useCallback(async () => {
    if (!firebaseUser) {
      setRestoringSubmission(false);
      return;
    }
    if (pendingSubmissionCustomer.current === firebaseUser.uid) return;

    setRestoringSubmission(true);
    try {
      const key = getPendingSubmissionKey(firebaseUser.uid);
      const saved = await AsyncStorage.getItem(key);
      const pending = saved ? parsePendingSubmission(saved) : null;
      pendingSubmissionCustomer.current = firebaseUser.uid;
      pendingSubmission.current = pending;
      setUploadedTrashPhotoPaths(
        pending?.trashPhotoUploadPending
          ? []
          : pending?.trashPhotoPaths ?? [],
      );
      setTrashPhotoRetryLocked(Boolean(
        pending?.trashPhotoRecoveryBlocked ||
          pending?.trashPhotoUploadPending && !pending.trashPhotoPaths?.length,
      ));
      setTrashPhotoError('');
      if (pending) {
        const restoredItems = pending.payload.items ?? [{
          wasteTypeId: pending.payload.wasteTypeId ?? '',
          bagSizeId: pending.payload.bagSizeId ?? '',
          quantity: pending.payload.quantity ?? 1,
        }];
        setRequestItems(restoredItems);
        setSelectedAddressId(pending.payload.addressId);
        setSelectedWasteTypeId(restoredItems[0]?.wasteTypeId ?? '');
        setSelectedBagSizeId(restoredItems[0]?.bagSizeId ?? '');
        setQuantity(restoredItems[0]?.quantity ?? 1);
        setScheduledDate(pending.payload.scheduledDate);
        setScheduledTime(pending.payload.scheduledTime);
        setNotes(pending.payload.notes ?? '');
        setQuote(pending.quote ?? null);
        setWorkflowStep(pending.quote ? 2 : 1);
        setSubmitError(
          'An unfinished pickup request was restored. Review the details and submit it to continue.',
        );
      } else if (saved) {
        await AsyncStorage.removeItem(key);
        setSubmitError(
          'A saved pickup retry could not be read and was cleared. Review your details to start again.',
        );
      }
    } catch (error) {
      console.error('Failed to restore pending customer pickup:', error);
      setSubmitError(
        'The saved pickup retry could not be loaded. Check device storage before submitting another request.',
      );
    } finally {
      setRestoringSubmission(false);
    }
  }, [firebaseUser]);

  const loadWasteTypes = useCallback(async (isRefresh = false) => {
    if (wasteTypesRequestInFlight.current) return;
    wasteTypesRequestInFlight.current = true;
    if (!isRefresh) {
      setLoadingWasteTypes(true);
      setWasteTypeError('');
    }
    try {
      const result = await getActivePickupWasteTypes();
      setWasteTypeError('');
      setWasteTypes(result);
      setSelectedWasteTypeId((current) =>
        result.some((wasteType) => wasteType.id === current)
          ? current
          : result[0]?.id ?? '',
      );
      setSelectedBagSizeId((current) =>
        result.some((wasteType) => wasteType.bagSizeOptions.some((bag) => bag.id === current))
          ? current
          : result[0]?.bagSizeOptions[0]?.id ?? '',
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('[Pickup] listActiveWasteTypesFunction failed', sanitizeCallableError(error));
      }
      if (isRefresh) {
        setRefreshError('Available waste types could not be refreshed. Your form and selections are unchanged.');
      } else {
        setWasteTypeError(
          'Active waste types could not be loaded. Check your connection and retry.',
        );
      }
    } finally {
      wasteTypesRequestInFlight.current = false;
      if (!isRefresh) setLoadingWasteTypes(false);
    }
  }, []);

  const loadPickupSchedule = useCallback(async (isRefresh = false) => {
    if (pickupScheduleRequestInFlight.current) return;
    pickupScheduleRequestInFlight.current = true;
    if (!isRefresh) {
      setLoadingSchedule(true);
      setScheduleError('');
    }
    try {
      const result = await getPickupSchedulingSettings(
        firebaseUser?.uid ?? null,
      );
      setPickupSchedule(result.current);
      setScheduleError('');
    } catch (error) {
      const code = typeof error === 'object' && error !== null &&
        'code' in error && typeof error.code === 'string'
        ? error.code
        : '';
      if (code === 'customer/auth-required') {
        if (isRefresh) {
          setRefreshError('Your account could not be verified. Please retry after checking your connection.');
        } else {
          router.replace('/signup');
        }
        return;
      }
      console.error('Failed to load pickup scheduling settings:', error);
      if (isRefresh) {
        setRefreshError('Pickup operating hours could not be refreshed. Your form and selections are unchanged.');
      } else {
        setScheduleError(
          'Pickup operating hours could not be loaded. Check your connection and retry.',
        );
      }
    } finally {
      pickupScheduleRequestInFlight.current = false;
      if (!isRefresh) setLoadingSchedule(false);
    }
  }, [firebaseUser]);

  const refreshPickupOptions = useCallback(async () => {
    if (
      optionsRefreshInFlight.current ||
      submitting ||
      requestingQuote ||
      loadingAddresses ||
      loadingWasteTypes ||
      loadingSchedule ||
      restoringSubmission
    ) return;
    optionsRefreshInFlight.current = true;
    setRefreshing(true);
    setRefreshError('');
    try {
      await Promise.all([
        loadAddresses(true),
        loadWasteTypes(true),
        loadPickupSchedule(true),
      ]);
    } finally {
      optionsRefreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [
    loadAddresses,
    loadPickupSchedule,
    loadWasteTypes,
    loadingAddresses,
    loadingSchedule,
    loadingWasteTypes,
    requestingQuote,
    restoringSubmission,
    submitting,
  ]);

  useFocusEffect(useCallback(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace('/signup');
      return undefined;
    }
    void restorePendingSubmission();
    void loadAddresses();
    void loadWasteTypes();
    void loadPickupSchedule();
    return undefined;
  }, [
    authLoading,
    firebaseUser,
    loadAddresses,
    loadPickupSchedule,
    loadWasteTypes,
    restorePendingSubmission,
  ]));

  function updatePayloadField(
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setSubmitError('');
    setQuote(null);
    discardPendingSubmission();
  }

  function discardPendingSubmission(force = false): boolean {
    if (
      !force &&
      (pendingSubmission.current?.trashPhotoPaths?.length ||
        pendingSubmission.current?.trashPhotoUploadPending)
    ) {
      setSubmitError(
        'This request already has uploaded photos. Retry the same request before changing its details.',
      );
      return false;
    }
    const customerId = firebaseUser?.uid;
    pendingSubmission.current = null;
    setUploadedTrashPhotoPaths([]);
    setTrashPhotoRetryLocked(false);
    if (!customerId) return true;
    void AsyncStorage.removeItem(getPendingSubmissionKey(customerId))
      .catch((error: unknown) => {
        console.error('Failed to clear pending customer pickup:', error);
        setSubmitError(
          'The previous retry could not be cleared from device storage. Do not submit until storage is available.',
        );
      });
    return true;
  }

  function confirmCancelPendingSubmission() {
    const attempt = pendingSubmission.current;
    const customerId = firebaseUser?.uid;
    if (
      !attempt || !customerId || cancellingPendingSubmission || submitting ||
      requestingQuote
    ) return;

    Alert.alert(
      'Cancel this pickup request?',
      'We will check whether this request was created before clearing it. Any uploaded photos will remain private in storage and will not be deleted automatically.',
      [
        {text: 'Keep Request', style: 'cancel'},
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: () => void cancelPendingSubmission(attempt, customerId),
        },
      ],
    );
  }

  async function cancelPendingSubmission(
    attempt: PendingSubmission,
    customerId: string,
  ) {
    setCancellingPendingSubmission(true);
    try {
      const verification = await verifyPickupCancellation(attempt.id);
      if (verification.status === 'exists') {
        const blockedAttempt = {
          ...attempt,
          trashPhotoRecoveryBlocked: true,
        };
        pendingSubmission.current = blockedAttempt;
        setTrashPhotoRetryLocked(true);
        try {
          await AsyncStorage.setItem(
            getPendingSubmissionKey(customerId),
            JSON.stringify(blockedAttempt),
          );
        } catch (persistError) {
          console.error(
            'Could not persist the existing pickup cancellation lock:',
            persistError,
          );
        }
        Alert.alert(
          'Request already exists',
          `This pickup already exists with status "${verification.pickupStatus}". The local request lock was kept.`,
          [
            {text: 'Close', style: 'cancel'},
            {
              text: 'View Pickup',
              onPress: () => router.push({
                pathname: '/pickup-tracking',
                params: {pickupId: attempt.id},
              }),
            },
          ],
        );
        return;
      }
      if (verification.status !== 'absent') {
        throw new Error('The backend could not verify this pickup status.');
      }
      if (
        firebaseUser?.uid !== customerId ||
        pendingSubmission.current?.id !== attempt.id ||
        pendingSubmissionCustomer.current !== customerId
      ) {
        throw new Error('The pending request changed during verification.');
      }

      await AsyncStorage.removeItem(getPendingSubmissionKey(customerId));
      pendingSubmission.current = null;
      setUploadedTrashPhotoPaths([]);
      setTrashPhotoRetryLocked(false);
      setTrashPhotos([]);
      setTrashPhotoError('');
      setSubmitError('');
      setQuote(null);
      setConfirmation(null);
      setWorkflowStep(0);
      setRequestItems([]);
      setSelectedWasteTypeId('');
      setSelectedBagSizeId('');
      setQuantity(1);
      setSelectedAddressId('');
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');
    } catch (error) {
      console.error('Could not verify pending pickup cancellation:', error);
      Alert.alert(
        'Request was not cleared',
        'We could not verify that this pickup was never created. The saved request remains locked. Please try again when connected or contact support.',
      );
    } finally {
      setCancellingPendingSubmission(false);
    }
  }

  async function handleSelectTrashPhotos(
    source: TrashPhotoSource,
    replaceUri?: string,
  ) {
    const pending = pendingSubmission.current;
    const expectedPhotoCount = pending?.trashPhotoUploadPending
      ? pending.trashPhotoPaths?.length ?? 0
      : MAX_TRASH_PHOTOS;
    const remainingSlots = Math.min(
      MAX_TRASH_PHOTOS - trashPhotos.length,
      expectedPhotoCount - trashPhotos.length,
    );
    if (
      (!replaceUri && remainingSlots <= 0) ||
      (replaceUri && !trashPhotos.some((photo) => photo.uri === replaceUri)) ||
      trashPhotoRetryLocked ||
      uploadedTrashPhotoPaths.length > 0 ||
      trashPhotoPickerInFlight.current ||
      submitting ||
      requestingQuote
    ) return;

    trashPhotoPickerInFlight.current = true;
    setSelectingTrashPhotos(true);
    setTrashPhotoPickerSource(source);
    setTrashPhotoError('');
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        let permission = await ImagePicker.getCameraPermissionsAsync();
        if (!permission.granted) {
          permission = await ImagePicker.requestCameraPermissionsAsync();
        }
        if (!permission.granted) {
          setTrashPhotoError(
            permission.canAskAgain
              ? 'Allow camera access to take a trash photo, or choose one from your gallery.'
              : 'Camera access is turned off. Enable it in your device settings or choose a photo from your gallery.',
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
      } else {
        let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        }
        if (!permission.granted) {
          setTrashPhotoError(
            'Allow photo library access to add trash photos.',
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: remainingSlots,
        });
      }
      if (result.canceled || !result.assets) return;

      const selectedAssets = result.assets.map((asset) => ({
        uri: asset.uri,
        mimeType: asset.mimeType,
        source,
      }));
      if (replaceUri) {
        const replacement = selectedAssets[0];
        if (replacement) {
          setTrashPhotos((current) => current.map((photo) =>
            photo.uri === replaceUri ? replacement : photo,
          ));
        }
      } else {
        setTrashPhotos((current) => {
          const existingUris = new Set(current.map((photo) => photo.uri));
          const newPhotos = selectedAssets
            .filter((photo) => {
              if (existingUris.has(photo.uri)) return false;
              existingUris.add(photo.uri);
              return true;
            })
            .slice(0, MAX_TRASH_PHOTOS - current.length);
          return [...current, ...newPhotos];
        });
      }
    } catch (error) {
      console.error('Unable to select trash photos:', error);
      setTrashPhotoError(source === 'camera'
        ? 'We could not open the camera. Try again or choose a photo from your gallery.'
        : 'We could not open your photo library. Try again.');
    } finally {
      trashPhotoPickerInFlight.current = false;
      setSelectingTrashPhotos(false);
      setTrashPhotoPickerSource(null);
    }
  }

  function removeTrashPhoto(uri: string) {
    if (
      trashPhotoRetryLocked ||
      uploadedTrashPhotoPaths.length > 0 ||
      pendingSubmission.current?.trashPhotoUploadPending
    ) {
      setTrashPhotoError(
        'Photos for this pending request are locked to their saved upload paths. Resume the same upload before changing them.',
      );
      return;
    }
    setTrashPhotos((current) => current.filter((item) => item.uri !== uri));
    setTrashPhotoError('');
  }

  async function handleSubmit() {
    if (submissionInFlight.current || requestingQuote || confirmation) return;
    if (restoringSubmission) {
      setSubmitError('Wait for the saved pickup retry to finish loading.');
      return;
    }
    setSubmitError('');

    if (!firebaseUser) {
      setSubmitError('Sign in to schedule a pickup.');
      return;
    }
    if (loadingSchedule) {
      setSubmitError('Wait for pickup operating hours to finish loading.');
      return;
    }
    if (scheduleError) {
      setSubmitError(scheduleError);
      return;
    }

    if (!selectedAddressId) {
      setSubmitError('Choose one of your saved pickup addresses.');
      return;
    }

    if (requestItems.length === 0) {
      setSubmitError('Add at least one waste item to this request.');
      return;
    }

    if (totalQuantity > 20) {
      setSubmitError('A pickup request can contain up to 20 bags total.');
      return;
    }
    const scheduleSelectionError = getScheduleSelectionError(
      scheduledDate,
      scheduledTime,
      pickupSchedule,
    );
    if (scheduleSelectionError) {
      setSubmitError(scheduleSelectionError);
      return;
    }

    const payload: SubmissionPayload = {
      addressId: selectedAddressId,
      items: snapshotPickupQuoteItems(requestItems),
      scheduledDate: scheduledDate.trim(),
      scheduledTime: scheduledTime.trim(),
      notes: notes.trim(),
    };
    const pending = pendingSubmission.current;
    if (trashPhotoRetryLocked) {
      setSubmitError(
        'This pickup has an earlier photo upload with no saved paths. Contact support; this request cannot be safely resumed here.',
      );
      return;
    }
    if (
      pending?.trashPhotoUploadPending &&
      pending.trashPhotoPaths?.length &&
      trashPhotos.length !== pending.trashPhotoPaths.length
    ) {
      setSubmitError(
        `Reselect all ${pending.trashPhotoPaths.length} photos to resume this same pickup.`,
      );
      return;
    }
    if (
      pending?.trashPhotoUploadPending &&
      !pending.trashPhotoPaths?.length
    ) {
      setSubmitError(
        'This earlier photo upload has no saved paths and cannot be resumed safely. Contact support before continuing.',
      );
      return;
    }
    if (
      pending?.trashPhotoPaths?.length &&
      JSON.stringify(pending.payload) !== JSON.stringify(payload)
    ) {
      setSubmitError(
        'This request already has uploaded photos. Restore its original details and retry before starting another request.',
      );
      return;
    }
    const attempt: PendingSubmission =
      pending && JSON.stringify(pending.payload) === JSON.stringify(payload)
        ? {...pending, quote: pending.quote ?? quote ?? undefined}
        : {
            id: doc(collection(firestore, 'pickups')).id,
            payload,
          };
    try {
      await AsyncStorage.setItem(
        getPendingSubmissionKey(firebaseUser.uid),
        JSON.stringify(attempt),
      );
      pendingSubmission.current = attempt;
      pendingSubmissionCustomer.current = firebaseUser.uid;
      setUploadedTrashPhotoPaths(
        attempt.trashPhotoUploadPending ? [] : attempt.trashPhotoPaths ?? [],
      );
    } catch (error) {
      console.error('Failed to persist customer pickup retry:', error);
      setSubmitError(
        'This device could not save a safe retry reference. Resolve device storage before submitting the request.',
      );
      return;
    }

    submissionInFlight.current = true;
    setRequestingQuote(true);
    setSubmitting(true);
    try {
      const outcome = await submitPickupRequest(attempt, {
        requestQuote: async (quotePayload) => {
          try {
            return await quotePickup(quotePayload);
          } catch (error) {
            console.warn('[Pickup] quote request failed', {
              code: getCallableErrorCode(error) || 'unknown',
              reason: getPickupQuoteFailureReason(error) ?? 'unclassified',
            });
            throw new Error(
              getPickupQuoteFailureMessage(error) ?? getErrorMessage(error),
            );
          }
        },
        confirmQuote: confirmPickupQuote,
        ...(trashPhotos.length > 0 ? {
          preparePhotoPaths: async (currentAttempt: PendingSubmission) =>
            preparePickupTrashPhotoPaths(
              firebaseUser.uid,
              currentAttempt.id,
              trashPhotos,
            ),
          uploadPhotos: async (currentAttempt: PendingSubmission) => {
            await uploadPickupTrashPhotos(
              firebaseUser.uid,
              currentAttempt.id,
              trashPhotos,
              currentAttempt.trashPhotoPaths ?? [],
            );
          },
        } : {}),
        persistAttempt: async (nextAttempt) => {
          pendingSubmission.current = nextAttempt;
          pendingSubmissionCustomer.current = firebaseUser.uid;
          setUploadedTrashPhotoPaths(
            nextAttempt.trashPhotoUploadPending
              ? []
              : nextAttempt.trashPhotoPaths ?? [],
          );
          setTrashPhotoRetryLocked(Boolean(
            nextAttempt.trashPhotoRecoveryBlocked ||
              nextAttempt.trashPhotoUploadPending &&
                !nextAttempt.trashPhotoPaths?.length,
          ));
          await AsyncStorage.setItem(
            getPendingSubmissionKey(firebaseUser.uid),
            JSON.stringify(nextAttempt),
          );
          setQuote(nextAttempt.quote ?? null);
          setRequestingQuote(false);
        },
      });
      if (outcome.kind === 'quote_changed') {
        setSubmitError(
          'Pricing changed while your request was being submitted. No pickup was submitted; tap Submit Pickup Request to retry.',
        );
        return;
      }
      try {
        await AsyncStorage.removeItem(
          getPendingSubmissionKey(firebaseUser!.uid),
        );
      } catch (error) {
        console.error('Failed to clear confirmed pickup retry:', error);
      }
      setConfirmation(outcome.result);
      setQuote(null);
      discardPendingSubmission(true);
      setTrashPhotos([]);
      setUploadedTrashPhotoPaths([]);
    } catch (error) {
      console.error('Failed to submit customer pickup:', error);
      if (error instanceof InvalidPickupQuoteError) {
        setSubmitError(error.message);
      } else if (
        error instanceof PickupPhotoPathConflictError ||
        error instanceof PickupPhotoRecoveryBlockedError ||
        getCallableErrorCode(error) === 'already-exists'
      ) {
        const attemptToBlock = pendingSubmission.current;
        if (attemptToBlock) {
          const blockedAttempt = {
            ...attemptToBlock,
            trashPhotoRecoveryBlocked: true,
          };
          pendingSubmission.current = blockedAttempt;
          setTrashPhotoRetryLocked(true);
          await AsyncStorage.setItem(
            getPendingSubmissionKey(firebaseUser.uid),
            JSON.stringify(blockedAttempt),
          ).catch((storageError: unknown) => {
            console.error('Failed to persist blocked pickup recovery:', storageError);
          });
        }
        setSubmitError(
          'The saved photo paths conflict with an existing upload or pickup. This request is locked to prevent replacing its photos. Contact support with the request reference.',
        );
      } else if (
        getCallableErrorCode(error) === 'failed-precondition' &&
        error instanceof Error &&
        /request a new quote/i.test(error.message)
      ) {
        const retry = pendingSubmission.current;
        if (retry) {
          const { quote: _expiredQuote, ...withoutQuote } = retry;
          pendingSubmission.current = withoutQuote;
          setQuote(null);
          void AsyncStorage.setItem(
            getPendingSubmissionKey(firebaseUser.uid),
            JSON.stringify(withoutQuote),
          ).catch((storageError: unknown) => {
            console.error('Failed to clear expired pickup quote:', storageError);
          });
        }
        setSubmitError(
          'Pickup pricing expired or changed. Tap Submit Pickup Request to retry.',
        );
      } else if (error instanceof Error &&
          error.message.includes('AsyncStorage')) {
        setSubmitError(
          'The request could not be saved for a safe retry. Check device storage before trying again.',
        );
      } else {
        setSubmitError(
          getPickupQuoteFailureMessage(error) ?? getErrorMessage(error),
        );
      }
    } finally {
      submissionInFlight.current = false;
      setRequestingQuote(false);
      setSubmitting(false);
    }
  }

  function handleNewSubmission() {
    discardPendingSubmission();
    setQuote(null);
    setConfirmation(null);
    setSelectedAddressId('');
    setSelectedWasteTypeId('');
    setSelectedBagSizeId('');
    setQuantity(1);
    setRequestItems([]);
    setScheduledDate('');
    setScheduledTime('');
    setNotes('');
    setSubmitError('');
    setWorkflowStep(0);
  }

  function handleWorkflowBack() {
    setSubmitError('');
    if (workflowStep > 0) {
      setWorkflowStep((current) => (current - 1) as 0 | 1 | 2);
      return;
    }
    router.replace('/home');
  }

  function removeWasteSelection(index: number) {
    setRequestItems((current) => current.filter((_, itemIndex) =>
      itemIndex !== index,
    ));
    setQuote(null);
    setSubmitError('');
    discardPendingSubmission();
  }

  function handleAddWasteSelection() {
    if (!selectedWasteType || !selectedBagSize) {
      setSubmitError('Choose an active waste type and bag size first.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      setSubmitError('Quantity must be between 1 and 20 bags.');
      return;
    }
    if (totalQuantity + quantity > 20) {
      setSubmitError('A pickup request can contain up to 20 bags total.');
      return;
    }
    setRequestItems((current) => appendPickupQuoteItem(current, {
      wasteTypeId: selectedWasteTypeId,
      bagSizeId: selectedBagSizeId,
      quantity,
    }));
    setQuote(null);
    setSubmitError('');
    discardPendingSubmission();
  }

  function handleWasteTypeChange(wasteTypeId: string) {
    const wasteType = wasteTypes.find(
      (item) => item.id === wasteTypeId,
    );

    setSelectedWasteTypeId(wasteTypeId);
    setSelectedBagSizeId(wasteType?.bagSizeOptions[0]?.id ?? '');
    setQuantity(1);
    setSubmitError('');
    setQuote(null);
    discardPendingSubmission();
  }

  function handleScheduledTimeChange(value: string) {
    updatePayloadField(setScheduledTime, value);
    if (!scheduledDate || !isValidTime(value)) return;
    const selectionError = getScheduleSelectionError(
      scheduledDate,
      value,
      pickupSchedule,
    );
    if (selectionError) setSubmitError(selectionError);
  }

  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: parseLocalDate(scheduledDate) ?? new Date(),
      mode: 'date',
      onValueChange: (_event, selectedDate) => {
        if (!selectedDate) return;
        const selected = new Date(selectedDate);
        selected.setHours(12, 0, 0, 0);
        const value = formatLocalDate(selected);
        if (!isValidDate(value)) {
          setSubmitError('Choose a valid pickup date.');
          return;
        }
        if (!pickupSchedule) {
          setSubmitError('Pickup scheduling is not configured yet.');
          return;
        }
        const [year, month, day] = value.split('-').map(Number);
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
        if (!pickupSchedule.operatingDays.includes(weekday)) {
          setSubmitError(
            'That date is not an operating day. Please choose another date.',
          );
          return;
        }
        setScheduledDate(value);
        const selectionError = scheduledTime && isValidTime(scheduledTime)
          ? getScheduleSelectionError(value, scheduledTime, pickupSchedule)
          : null;
        setSubmitError(selectionError ?? '');
        setQuote(null);
        discardPendingSubmission();
      },
      onDismiss: () => {
        // Dismissing leaves the previously selected date unchanged.
      },
    });
  }

  function openTimePicker() {
    if (!pickupSchedule || !isValidDate(scheduledDate)) {
      setSubmitError('Choose a valid pickup date before selecting a time.');
      return;
    }

    DateTimePickerAndroid.open({
      value: createPickupTimePickerValue(
        scheduledDate,
        isValidTime(scheduledTime)
          ? scheduledTime
          : pickupSchedule.openingTime,
      ),
      mode: 'time',
      is24Hour: false,
      timeZoneName: PICKUP_TIMEZONE,
      onValueChange: (event) => {
        const value = pickupTimeFromPickerEvent(event);
        if (!value || !isValidTime(value)) {
          setSubmitError('The selected pickup time is invalid. Please choose again.');
          return;
        }
        handleScheduledTimeChange(value);
      },
      onDismiss: () => {
        // Dismissing leaves the previously selected time unchanged.
      },
      onError: (error) => {
        console.error('Failed to open the pickup time picker:', error);
        setSubmitError('The time picker could not be opened. Please try again.');
      },
    });
  }

  if (authLoading || !firebaseUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1f7a3f" />
        <Text style={styles.helper}>Checking your account...</Text>
      </View>
    );
  }

  if (confirmation) {
    const pickupAddress = addresses.find(
      (address) => address.id === selectedAddressId,
    );
    const scheduledDateValue = parseLocalDate(scheduledDate);
    const scheduledDateLabel = scheduledDateValue
      ? scheduledDateValue.toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      : null;
    const scheduledTimeLabel = isValidTime(scheduledTime)
      ? `${formatPickupTime(scheduledTime)} Philippine time`
      : null;

    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.confirmationTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace('/home')}
            style={styles.confirmationBackButton}
          >
            <RemixIcon name="arrow-left-line" size={22} color="#173D2C" />
          </Pressable>
          <Text style={styles.confirmationNavTitle}>Request Confirmed</Text>
          <View style={styles.confirmationNavSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={styles.confirmationContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.confirmationContent}>
            <View style={styles.successIllustration}>
              {!reducedMotion ? SUCCESS_CONFETTI.map((particle, index) => (
                <ConfettiParticle
                  key={`confetti-${index}`}
                  index={index}
                  left={particle.left}
                  top={particle.top}
                  color={particle.color}
                />
              )) : null}
              <Animated.View
                accessible
                accessibilityLabel="Pickup request submitted successfully"
                entering={!reducedMotion
                  ? ZoomIn.springify().damping(12).delay(80)
                  : undefined}
                style={styles.successBadge}
              >
                <RemixIcon name="check-line" size={46} color="#ffffff" />
              </Animated.View>
            </View>

            <Animated.View
              entering={!reducedMotion
                ? FadeInDown.duration(430).delay(120)
                : undefined}
              style={styles.confirmationHeading}
            >
              <Text style={styles.confirmationTitle}>Thank You!</Text>
              <Text style={styles.confirmationMessage}>
                Your pickup request has been submitted successfully.
              </Text>
            </Animated.View>

            <Animated.View
              entering={!reducedMotion
                ? FadeInUp.duration(450).delay(260)
                : undefined}
              style={styles.confirmationSummaryCard}
            >
              <View style={styles.summaryCardHeader}>
                <Text style={styles.summaryCardTitle}>Pickup summary</Text>
                <View style={styles.submittedBadge}>
                  <Text style={styles.submittedBadgeText}>
                    {confirmation.success ? 'Submitted' : 'Status unavailable'}
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryLabel}>Pickup request ID</Text>
              <Text selectable style={styles.confirmationPickupId}>
                {confirmation.pickupId}
              </Text>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryLabel}>Scheduled</Text>
                <Text style={styles.summaryValue}>
                  {scheduledDateLabel ?? 'Date unavailable'}
                  {scheduledTimeLabel ? ` · ${scheduledTimeLabel}` : ''}
                </Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryLabel}>Pickup address</Text>
                <Text style={styles.summaryValue}>
                  {pickupAddress?.address || 'Pickup address unavailable'}
                </Text>
              </View>
              {confirmation.facilityName ? (
                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryLabel}>Assigned facility</Text>
                  <Text style={styles.summaryValue}>
                    {confirmation.facilityName}
                    {confirmation.facilityAddress
                      ? ` · ${confirmation.facilityAddress}`
                      : ''}
                  </Text>
                </View>
              ) : null}
            </Animated.View>

            <Animated.View
              entering={!reducedMotion
                ? FadeInUp.duration(420).delay(330)
                : undefined}
              style={styles.pricingInfoCard}
            >
              <View style={styles.pricingInfoIcon}>
                <RemixIcon
                  name="information-line"
                  size={20}
                  color="#1f7a3f"
                />
              </View>
              <View style={styles.pricingInfoCopy}>
                <Text style={styles.pricingInfoTitle}>Pricing and collection</Text>
                <Text style={styles.pricingInfoText}>
                  The final price is calculated using the road route to the
                  assigned facility. Review and confirm or decline the quote in
                  pickup tracking before collection can begin.
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              entering={!reducedMotion
                ? FadeInUp.duration(380).delay(430)
                : undefined}
              style={styles.confirmationActions}
            >
              <Pressable
                accessibilityRole="button"
                style={styles.confirmationPrimaryButton}
                onPress={() => {
                  router.push({
                    pathname: '/pickup-tracking',
                    params: {
                      pickupId: confirmation.pickupId,
                      address: pickupAddress?.address ?? '',
                      addressLabel: pickupAddress?.label || 'Pickup location',
                      latitude: pickupAddress?.latitude.toString() ?? '',
                      longitude: pickupAddress?.longitude.toString() ?? '',
                      scheduledDate,
                      scheduledTime,
                      wasteType: firstRequestWasteType?.name ?? '',
                      bagSize: firstRequestBagSize?.label ?? '',
                      quantity: String(firstRequestItem?.quantity ?? 0),
                      estimatedWeightKg: String(requestEstimatedWeight),
                      twoStagePricing: 'true',
                      items: JSON.stringify(requestItems.map((item) => {
                        const wasteType = wasteTypes.find((candidate) =>
                          candidate.id === item.wasteTypeId,
                        );
                        const bag = wasteType?.bagSizeOptions.find((candidate) =>
                          candidate.id === item.bagSizeId,
                        );
                        return {
                          wasteTypeName: wasteType?.name ?? '',
                          bagSizeLabel: bag?.label ?? '',
                          quantity: item.quantity,
                          estimatedWeightKg: bag
                            ? bag.estimatedWeightKg * item.quantity
                            : 0,
                        };
                      })),
                      facilityName: confirmation.facilityName,
                      facilityAddress: confirmation.facilityAddress,
                    },
                  });
                }}
              >
                <Text style={styles.confirmationPrimaryButtonText}>
                  View Pickup Tracking
                </Text>
                <RemixIcon name="arrow-right-line" size={20} color="#ffffff" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.confirmationScheduleButton}
                onPress={handleNewSubmission}
              >
                <Text style={styles.confirmationScheduleButtonText}>
                  Schedule Another Pickup
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.confirmationHomeButton}
                onPress={() => router.replace('/home')}
              >
                <Text style={styles.confirmationHomeButtonText}>
                  Back to Home
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const pendingPhotoAttempt = pendingSubmission.current;
  const needsPhotoReselection = Boolean(
    pendingPhotoAttempt?.trashPhotoUploadPending &&
      pendingPhotoAttempt.trashPhotoPaths?.length &&
      trashPhotos.length !== pendingPhotoAttempt.trashPhotoPaths.length,
  );
  const remainingPhotoSelectionSlots = Math.max(
    0,
    Math.min(
      MAX_TRASH_PHOTOS - trashPhotos.length,
      (pendingPhotoAttempt?.trashPhotoUploadPending
        ? pendingPhotoAttempt.trashPhotoPaths?.length ?? 0
        : MAX_TRASH_PHOTOS) - trashPhotos.length,
    ),
  );
  const pendingPhotoPayloadMismatch = Boolean(
    pendingPhotoAttempt &&
      (pendingPhotoAttempt.trashPhotoUploadPending ||
        pendingPhotoAttempt.trashPhotoPaths?.length) &&
      JSON.stringify(pendingPhotoAttempt.payload) !== JSON.stringify({
        addressId: selectedAddressId,
        items: snapshotPickupQuoteItems(requestItems),
        scheduledDate: scheduledDate.trim(),
        scheduledTime: scheduledTime.trim(),
        notes: notes.trim(),
      }),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshPickupOptions()}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
      {refreshError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {refreshError}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={workflowStep === 0 ? 'Back to Home' : 'Go to previous step'}
        onPress={handleWorkflowBack}
      >
        <Text style={styles.backLink}>
          {workflowStep === 0 ? '‹ Back to Home' : '‹ Back'}
        </Text>
      </Pressable>
      <View style={styles.stepper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: workflowStep + 1 }}>
        {['Select Waste', 'Review Request', 'Submit Request'].map((label, index) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                index <= workflowStep && styles.stepNumberActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  index <= workflowStep && styles.stepNumberTextActive,
                ]}
              >
                {index < workflowStep ? '✓' : index + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                index === workflowStep && styles.stepLabelActive,
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.title}>
        {workflowStep === 0
          ? 'Select Your Waste'
          : workflowStep === 1
            ? 'Review Your Request'
            : 'Confirm Pickup Details'}
      </Text>
      <Text style={styles.body}>
        {workflowStep === 0
          ? 'Choose one type, bag size, and quantity, then add it to the request. ' +
            'Repeat for each waste type.'
          : workflowStep === 1
            ? 'Check your selected waste before adding the pickup location and schedule.'
            : 'Choose where and when the collection should take place.'}
      </Text>

      {workflowStep === 2 ? <View style={styles.scheduleCard}>
        <Text style={styles.sectionTitle}>Pickup operating schedule</Text>
        {loadingSchedule ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#1f7a3f" />
            <Text style={styles.helper}>Loading Philippine operating hours...</Text>
          </View>
        ) : scheduleError ? (
          <View>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {scheduleError}
            </Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadPickupSchedule()}
            >
              <Text style={styles.retryText}>Retry loading schedule</Text>
            </Pressable>
          </View>
        ) : pickupSchedule ? (
          <>
            <Text style={styles.scheduleText}>
              Timezone: Asia/Manila (Philippine time)
            </Text>
            <Text style={styles.scheduleText}>
              Operating days: {pickupSchedule.operatingDays
                .map((day) => PICKUP_WEEKDAYS[day])
                .join(', ')}
            </Text>
            <Text style={styles.scheduleText}>
              Pickup times: {pickupSchedule.openingTime}–{pickupSchedule.closingTime}
              {' '}(closing time is not bookable)
            </Text>
            <Text style={styles.scheduleText}>
              Same-day booking cutoff: {pickupSchedule.sameDayCutoff}
            </Text>
          </>
        ) : (
          <Text style={styles.scheduleWarning}>
            Pickup scheduling has not been configured by an administrator yet.
            New bookings are temporarily unavailable.
          </Text>
        )}
      </View> : null}

      {workflowStep === 2 ? <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pickup address</Text>
        {loadingAddresses ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#1f7a3f" />
            <Text style={styles.helper}>Loading saved addresses...</Text>
          </View>
        ) : addressError ? (
          <View>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {addressError}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => void loadAddresses()}>
              <Text style={styles.retryText}>Retry loading addresses</Text>
            </Pressable>
          </View>
        ) : addresses.length === 0 ? (
          <View>
            <Text style={styles.helper}>
              You do not have a usable saved address yet. Add a pickup location before scheduling.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => router.push('/pickup-addresses')}
            >
              <Text style={styles.secondaryButtonText}>Add pickup address</Text>
            </Pressable>
          </View>
        ) : (
          addresses.map((address) => (
            <Pressable
              key={address.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedAddressId === address.id }}
              style={[
                styles.option,
                selectedAddressId === address.id && styles.optionSelected,
              ]}
              onPress={() =>
                updatePayloadField(
                  setSelectedAddressId,
                  address.id,
                )
              }
              disabled={
                submitting || requestingQuote || loadingSchedule ||
                !pickupSchedule || Boolean(scheduleError)
              }
            >
              <Text style={styles.optionTitle}>
                {address.label || 'Saved address'}
                {address.isDefault ? ' · Default' : ''}
              </Text>
              <Text style={styles.optionText}>{address.address}</Text>
            </Pressable>
          ))
        )}
        {addresses.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            style={styles.addressManageButton}
            onPress={() => router.push('/pickup-addresses')}
            disabled={
              submitting || requestingQuote || loadingSchedule ||
              Boolean(scheduleError) || !pickupSchedule
            }
          >
            <Text style={styles.retryText}>Add another address</Text>
          </Pressable>
        ) : null}
      </View> : null}

      {workflowStep === 0 ? <View style={styles.card}>
        <Text style={styles.sectionTitle}>Waste type</Text>
        {loadingWasteTypes ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#1f7a3f" />
            <Text style={styles.helper}>Loading active waste types...</Text>
          </View>
        ) : wasteTypeError ? (
          <View>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {wasteTypeError}
            </Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadWasteTypes()}
            >
              <Text style={styles.retryText}>Retry loading waste types</Text>
            </Pressable>
          </View>
        ) : wasteTypes.length === 0 ? (
          <Text style={styles.helper}>
            No active waste types are currently available. Please try again
            later.
          </Text>
        ) : (
          wasteTypes.map((wasteType) => (
            <Pressable
              key={wasteType.id}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selectedWasteTypeId === wasteType.id,
              }}
              style={[
                styles.option,
                selectedWasteTypeId === wasteType.id && styles.optionSelected,
              ]}
              onPress={() => handleWasteTypeChange(wasteType.id)}
              disabled={submitting || requestingQuote}
              >
                <Text style={styles.optionTitle}>{wasteType.name}</Text>
              <Text style={styles.optionText}>
                Price: {formatPesoAmount(wasteType.pickupFee)} / bag
              </Text>
              {wasteType.description ? (
                <Text style={styles.optionText}>
                  {wasteType.description}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </View> : null}

      {workflowStep === 0 ? <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bag size and quantity</Text>
        <Text style={styles.label}>Bag size</Text>

        {!selectedWasteType ||
        selectedWasteType.bagSizeOptions.length === 0 ? (
          <Text style={styles.helper}>
            No bag sizes are configured for this waste type.
          </Text>
        ) : (
          selectedWasteType.bagSizeOptions.map((bagSize) => (
            <Pressable
              key={bagSize.id}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selectedBagSizeId === bagSize.id,
              }}
              style={[
                styles.option,
                selectedBagSizeId === bagSize.id &&
                  styles.optionSelected,
              ]}
              onPress={() => {
                setSelectedBagSizeId(bagSize.id);
                setSubmitError('');
                setQuote(null);
                discardPendingSubmission();
              }}
              disabled={submitting || requestingQuote}
            >
              <Text style={styles.optionTitle}>
                {bagSize.label}
              </Text>
              <Text style={styles.optionText}>
                Estimated weight: {bagSize.estimatedWeightKg} kg per bag
              </Text>
              {selectedWasteType ? (
                <Text style={styles.optionText}>
                  {formatPesoAmount(selectedWasteType.pickupFee)} / bag
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        <Text style={styles.label}>Quantity (bags)</Text>

        <View style={styles.quantityRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease bag quantity"
            style={styles.quantityButton}
            onPress={() => {
              setQuantity((current) => Math.max(1, current - 1));
              setSubmitError('');
              setQuote(null);
              discardPendingSubmission();
            }}
            disabled={submitting || requestingQuote || quantity <= 1}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </Pressable>

          <Text style={styles.quantityValue}>{quantity}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase bag quantity"
            style={styles.quantityButton}
            onPress={() => {
              setQuantity((current) => Math.min(20, current + 1));
              setSubmitError('');
              setQuote(null);
              discardPendingSubmission();
            }}
            disabled={submitting || requestingQuote || quantity >= 20}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </Pressable>
        </View>

        {selectedWasteType && selectedBagSize ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              Waste type subtotal: {quantity} × {
                formatPesoAmount(selectedWasteType.pickupFee)
              } = {formatPesoAmount(selectedWasteTypeSubtotal)}
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            Estimated load: {estimatedWeight} kg
          </Text>
          <Text style={styles.helper}>
            Load estimates use the configured weight per bag. The facility confirms
            the final weight when it receives your waste.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={handleAddWasteSelection}
          disabled={submitting || requestingQuote}
        >
          <Text style={styles.secondaryButtonText}>
            {selectedWasteType
              ? `Add ${selectedWasteType.name} to request`
              : 'Add item to request'}
          </Text>
        </Pressable>
        {requestItems.length > 0 ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              Request items · {totalQuantity} bag{totalQuantity === 1 ? '' : 's'}
            </Text>
            {requestItems.map((item, index) => {
              const wasteType = wasteTypes.find((candidate) =>
                candidate.id === item.wasteTypeId,
              );
              const bag = wasteType?.bagSizeOptions.find((candidate) =>
                candidate.id === item.bagSizeId,
              );
              return (
                <View key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`} style={styles.reviewItem}>
                  <View style={styles.reviewItemCopy}>
                    <Text style={styles.optionTitle}>
                      {wasteType?.name ?? 'Unavailable waste type'}
                    </Text>
                    <Text style={styles.optionText}>
                      {bag?.label ?? 'Unavailable bag size'} · {item.quantity} bag{item.quantity === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${wasteType?.name ?? 'waste'} from request`}
                    onPress={() => removeWasteSelection(index)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}
            <Text style={styles.optionText}>
              Estimated combined load: {requestEstimatedWeight} kg
            </Text>
          </View>
        ) : null}
      </View> : null}

      {workflowStep === 1 ? <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pickup item summary</Text>
        {requestItems.map((item, index) => {
          const wasteType = wasteTypes.find((candidate) =>
            candidate.id === item.wasteTypeId,
          );
          const bag = wasteType?.bagSizeOptions.find((candidate) =>
            candidate.id === item.bagSizeId,
          );
          const lineWeight = bag ? bag.estimatedWeightKg * item.quantity : 0;
          return (
            <View key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`} style={styles.reviewItem}>
              <View style={styles.reviewItemCopy}>
                <Text style={styles.optionTitle}>{wasteType?.name ?? 'Unavailable waste type'}</Text>
                <Text style={styles.optionText}>
                  {bag?.label ?? 'Unavailable bag size'} · {item.quantity} bag{item.quantity === 1 ? '' : 's'}
                </Text>
                <Text style={styles.optionText}>Estimated load: {lineWeight} kg</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${wasteType?.name ?? 'waste'} from request`}
                onPress={() => removeWasteSelection(index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
        <Text style={styles.optionText}>
          Total estimated load: {requestEstimatedWeight} kg · {totalQuantity} bags
        </Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Final price review</Text>
          <Text style={styles.helper}>
            After you submit this request, BasuraGo will calculate the final
            price using the road distance from your pickup location to the
            assigned facility. You can confirm or decline the final quote in
            tracking before collection begins.
          </Text>
        </View>
      </View> : null}

      {workflowStep === 2 ? <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pickup details</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Waste items</Text>
          {requestItems.map((item) => {
            const wasteType = wasteTypes.find((candidate) =>
              candidate.id === item.wasteTypeId,
            );
            const bag = wasteType?.bagSizeOptions.find((candidate) =>
              candidate.id === item.bagSizeId,
            );
            return (
              <Text key={`${item.wasteTypeId}:${item.bagSizeId}`} style={styles.optionText}>
                {wasteType?.name ?? 'Unavailable waste type'} · {bag?.label ?? 'Unavailable bag size'} · {item.quantity} bag{item.quantity === 1 ? '' : 's'}
              </Text>
            );
          })}
          <Text style={styles.optionText}>
            {totalQuantity} bags · {requestEstimatedWeight} kg estimated
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change waste items"
            onPress={() => setWorkflowStep(1)}
            style={styles.changeButton}
          >
            <Text style={styles.retryText}>Change items</Text>
          </Pressable>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Pricing and confirmation</Text>
          <Text style={styles.helper}>
            Submit your pickup request now. When the assigned facility’s road
            route is available, the final price will appear in tracking for
            your confirmation. Collection cannot begin until you confirm it.
          </Text>
        </View>
        <Text style={styles.label}>Pickup date</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose pickup date"
          style={styles.input}
          onPress={openDatePicker}
          disabled={submitting || requestingQuote}
        >
          <Text style={scheduledDate ? styles.pickerText : styles.pickerPlaceholder}>
            {scheduledDate || 'Choose a date'}
          </Text>
        </Pressable>
        <Text style={styles.label}>Pickup time</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scheduledTime
            ? `Pickup time ${formatPickupTime(scheduledTime)} Philippine time`
            : 'Choose pickup time in Philippine time'}
          style={styles.input}
          onPress={openTimePicker}
          disabled={submitting || requestingQuote || loadingSchedule ||
            !pickupSchedule || Boolean(scheduleError) || !isValidDate(scheduledDate)}
        >
          <Text style={scheduledTime ? styles.pickerText : styles.pickerPlaceholder}>
            {scheduledTime
              ? `${formatPickupTime(scheduledTime)} (Philippine time)`
              : 'Choose a time'}
          </Text>
        </Pressable>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={(value) => updatePayloadField(setNotes, value)}
          placeholder="Anything the rider should know?"
          multiline
          maxLength={1000}
          editable={!submitting && !requestingQuote}
        />
        <View style={styles.trashPhotosSection}>
          <Text style={styles.label}>Trash Photos</Text>
          <Text style={styles.helper}>
            Add up to {MAX_TRASH_PHOTOS} photos using your camera or photo gallery.
          </Text>
          <Text style={styles.helper}>
            {trashPhotoRetryLocked
              ? 'Photo upload needs review.'
              : uploadedTrashPhotoPaths.length > 0
                ? `${uploadedTrashPhotoPaths.length} photos uploaded for this pending request.`
                : trashPhotos.length >= MAX_TRASH_PHOTOS
                  ? 'Maximum photos selected.'
                  : pendingPhotoAttempt?.trashPhotoUploadPending
                    ? `Resume this pickup · ${trashPhotos.length}/${pendingPhotoAttempt.trashPhotoPaths?.length ?? 0} photos selected.`
                    : `${MAX_TRASH_PHOTOS - trashPhotos.length} photo slots remaining.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose trash photos from gallery"
            disabled={
              trashPhotoRetryLocked || uploadedTrashPhotoPaths.length > 0 ||
              remainingPhotoSelectionSlots <= 0 || selectingTrashPhotos ||
              submitting || requestingQuote
            }
            onPress={() => void handleSelectTrashPhotos('gallery')}
            style={[
              styles.trashPhotoPickerButton,
              (trashPhotoRetryLocked || uploadedTrashPhotoPaths.length > 0 ||
                remainingPhotoSelectionSlots <= 0 || selectingTrashPhotos ||
                submitting || requestingQuote) && styles.buttonDisabled,
            ]}
          >
            {selectingTrashPhotos && trashPhotoPickerSource === 'gallery' ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color="#1f7a3f" size="small" />
                <Text style={styles.trashPhotoPickerText}>Opening gallery...</Text>
              </View>
            ) : (
              <Text style={styles.trashPhotoPickerText}>Choose from Gallery</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a trash photo with the camera"
            disabled={
              trashPhotoRetryLocked || uploadedTrashPhotoPaths.length > 0 ||
              remainingPhotoSelectionSlots <= 0 || selectingTrashPhotos ||
              submitting || requestingQuote
            }
            onPress={() => void handleSelectTrashPhotos('camera')}
            style={[
              styles.trashPhotoPickerButton,
              (trashPhotoRetryLocked || uploadedTrashPhotoPaths.length > 0 ||
                remainingPhotoSelectionSlots <= 0 || selectingTrashPhotos ||
                submitting || requestingQuote) && styles.buttonDisabled,
            ]}
          >
            {selectingTrashPhotos && trashPhotoPickerSource === 'camera' ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color="#1f7a3f" size="small" />
                <Text style={styles.trashPhotoPickerText}>Opening camera...</Text>
              </View>
            ) : (
              <Text style={styles.trashPhotoPickerText}>Take Photo</Text>
            )}
          </Pressable>
          {trashPhotoRetryLocked ? (
            <View>
              <Text accessibilityRole="alert" style={styles.trashPhotoError}>
                {pendingSubmission.current?.trashPhotoRecoveryBlocked
                  ? 'A saved photo path conflicts with an existing upload or pickup, or storage access cannot verify it. Do not submit another request. Contact support and provide request reference '
                  : 'This older attempt has no saved photo paths, so its uploads cannot be safely reconciled here. Do not start another pickup. Contact support and provide request reference '}
                {pendingSubmission.current?.id ?? 'unavailable'}.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/help-support')}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Open Help and Support</Text>
              </Pressable>
            </View>
          ) : pendingPhotoAttempt?.trashPhotoUploadPending ? (
            <Text accessibilityRole="alert" style={styles.trashPhotoError}>
              {pendingPhotoPayloadMismatch
                ? 'Restore the original pickup details to resume this same request and its saved photo paths.'
                : needsPhotoReselection
                ? `Reselect ${pendingPhotoAttempt.trashPhotoPaths?.length ?? 0} photos to resume this same pickup. Its saved upload paths will be reused.`
                : 'Photos are ready to resume this same pickup using its saved upload paths.'}
            </Text>
          ) : pendingPhotoPayloadMismatch ? (
            <Text accessibilityRole="alert" style={styles.trashPhotoError}>
              Restore the original pickup details to retry the same request with its saved photos.
            </Text>
          ) : null}
          {uploadedTrashPhotoPaths.length > 0 && trashPhotos.length === 0 ? (
            <Text style={styles.helper}>
              Retry this same request to finish confirmation. Its uploaded photos are retained.
            </Text>
          ) : null}
          {trashPhotoError ? (
            <Text accessibilityRole="alert" style={styles.trashPhotoError}>
              {trashPhotoError}
            </Text>
          ) : null}
          {trashPhotos.length > 0 ? (
            <View style={styles.trashPhotoList}>
              {trashPhotos.map((photo, index) => (
                <View key={photo.uri} style={styles.trashPhotoItem}>
                  <SelectedTrashPhotoPreview uri={photo.uri} index={index} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove trash photo ${index + 1}`}
                    disabled={
                      uploadedTrashPhotoPaths.length > 0 ||
                      submitting ||
                      requestingQuote
                    }
                    onPress={() => removeTrashPhoto(photo.uri)}
                    style={styles.trashPhotoRemoveButton}
                  >
                    <Text style={styles.trashPhotoRemoveText}>Remove</Text>
                  </Pressable>
                  {photo.source === 'camera' &&
                    !pendingPhotoAttempt?.trashPhotoUploadPending ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retake trash photo ${index + 1}`}
                      disabled={submitting || requestingQuote || selectingTrashPhotos}
                      onPress={() => void handleSelectTrashPhotos('camera', photo.uri)}
                      style={styles.trashPhotoRetakeButton}
                    >
                      <Text style={styles.trashPhotoRetakeText}>Retake</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View> : null}

      </ScrollView>
      <View style={styles.footer}>
        {submitError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {submitError}
          </Text>
        ) : null}
        {pendingPhotoAttempt ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{disabled: cancellingPendingSubmission}}
            disabled={
              cancellingPendingSubmission || submitting || requestingQuote
            }
            onPress={confirmCancelPendingSubmission}
            style={[
              styles.retryButton,
              (cancellingPendingSubmission || submitting || requestingQuote) &&
                styles.buttonDisabled,
            ]}
          >
            <Text style={styles.retryText}>
              {cancellingPendingSubmission
                ? 'Checking request status...'
                : 'Cancel Request'}
            </Text>
          </Pressable>
        ) : null}
        {workflowStep === 0 ? (
          <Pressable
            accessibilityRole="button"
            style={[
              styles.button,
              (loadingWasteTypes || Boolean(wasteTypeError) ||
                requestItems.length === 0) &&
                styles.buttonDisabled,
            ]}
            disabled={
              loadingWasteTypes || Boolean(wasteTypeError) ||
              requestItems.length === 0
            }
            onPress={() => {
              setSubmitError('');
              setWorkflowStep(1);
            }}
          >
            <Text style={styles.buttonText}>
              Review Request · {totalQuantity} bag{totalQuantity === 1 ? '' : 's'}
            </Text>
          </Pressable>
        ) : workflowStep === 1 ? (
          <View style={styles.footerActions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.secondaryButton, styles.footerSecondaryButton]}
              onPress={() => setWorkflowStep(0)}
            >
              <Text style={styles.secondaryButtonText}>Change Waste</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.footerPrimaryButton,
                requestItems.length === 0 && styles.buttonDisabled]}
              disabled={requestItems.length === 0}
              onPress={() => {
                setSubmitError('');
                setWorkflowStep(2);
              }}
            >
              <Text style={styles.buttonText}>Continue to Details</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={[
              styles.button,
              (submitting || requestingQuote || restoringSubmission ||
                trashPhotoRetryLocked || needsPhotoReselection ||
                pendingPhotoPayloadMismatch ||
                loadingAddresses || loadingWasteTypes || loadingSchedule ||
                Boolean(addressError) || Boolean(wasteTypeError) ||
                Boolean(scheduleError) || !pickupSchedule ||
                addresses.length === 0 || requestItems.length === 0) &&
                styles.buttonDisabled,
            ]}
            onPress={() => void handleSubmit()}
            disabled={
              submitting || requestingQuote || restoringSubmission ||
              trashPhotoRetryLocked || needsPhotoReselection ||
              pendingPhotoPayloadMismatch ||
              loadingAddresses || loadingWasteTypes || loadingSchedule ||
              Boolean(addressError) || Boolean(wasteTypeError) ||
              Boolean(scheduleError) || !pickupSchedule ||
              addresses.length === 0 || requestItems.length === 0
            }
          >
            {requestingQuote ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color="#ffffff" />
                <Text style={styles.buttonText}>Preparing pickup request...</Text>
              </View>
            ) : submitting ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color="#ffffff" />
                <Text style={styles.buttonText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                Submit Pickup Request
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F8F6',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#DCE8DE',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerSecondaryButton: {
    flex: 0.8,
    marginTop: 0,
  },
  footerPrimaryButton: {
    flex: 1.2,
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7ECE8',
  },
  stepNumberActive: {
    backgroundColor: '#176744',
  },
  stepNumberText: {
    color: '#64736A',
    fontSize: 13,
    fontWeight: '700',
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#64736A',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#176744',
    fontWeight: '800',
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  reviewItemCopy: {
    flex: 1,
  },
  removeButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: '#A12B22',
    fontSize: 13,
    fontWeight: '700',
  },
  changeButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modelNotice: {
    color: '#64736A',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  optionPrice: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backLink: {
    color: '#1f7a3f',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 18,
  },
  scheduleCard: {
    backgroundColor: '#eff8f1',
    borderColor: '#d4ead9',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  scheduleText: {
    color: '#365244',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  scheduleWarning: {
    color: '#8a4b08',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  option: {
    borderColor: '#d1d5db',
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 9,
    padding: 13,
  },
  optionSelected: {
    backgroundColor: '#ecfdf3',
    borderColor: '#1f7a3f',
  },
  optionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  optionText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  helper: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 21,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 7,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderRadius: 9,
    minHeight: 50,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: {
    color: '#111827',
    fontSize: 16,
  },
  pickerPlaceholder: {
    color: '#9ca3af',
    fontSize: 16,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  trashPhotosSection: {
    marginTop: 16,
  },
  trashPhotoPickerButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  trashPhotoRetakeButton: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  trashPhotoRetakeText: {
    color: '#1f7a3f',
    fontSize: 12,
    fontWeight: '700',
  },
  trashPhotoPickerText: {
    color: '#1f7a3f',
    fontSize: 14,
    fontWeight: '700',
  },
  trashPhotoError: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  trashPhotoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  trashPhotoItem: {
    alignItems: 'center',
    width: 88,
  },
  trashPhotoThumbnail: {
    overflow: 'hidden',
    backgroundColor: '#eef2ef',
    borderRadius: 9,
    height: 80,
    width: 80,
  },
  trashPhotoThumbnailImage: {
    height: '100%',
    width: '100%',
  },
  trashPhotoPreviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashPhotoPreviewFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashPhotoRemoveButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  trashPhotoRemoveText: {
    color: '#A12B22',
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1f7a3f',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#1f7a3f',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  secondaryButtonText: {
    color: '#1f7a3f',
    fontSize: 15,
    fontWeight: '700',
  },
  addressManageButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#1f7a3f',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  successTitle: {
    color: '#166534',
    fontSize: 22,
    fontWeight: '800',
  },
  confirmationTopBar: {
    alignItems: 'center',
    backgroundColor: '#F5F8F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  confirmationBackButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  confirmationNavTitle: {
    color: '#173D2C',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmationNavSpacer: {
    width: 42,
  },
  confirmationContainer: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  confirmationContent: {
    flexGrow: 1,
  },
  successIllustration: {
    alignItems: 'center',
    height: 150,
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  successBadge: {
    alignItems: 'center',
    backgroundColor: '#1f7a3f',
    borderColor: '#dceee0',
    borderRadius: 48,
    borderWidth: 8,
    elevation: 3,
    height: 96,
    justifyContent: 'center',
    shadowColor: '#173D2C',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.14,
    shadowRadius: 8,
    width: 96,
  },
  confettiParticle: {
    borderRadius: 3,
    height: 10,
    position: 'absolute',
    width: 7,
  },
  confirmationHeading: {
    alignItems: 'center',
    marginBottom: 22,
  },
  confirmationTitle: {
    color: '#173D2C',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmationMessage: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center',
  },
  confirmationSummaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dce8de',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    padding: 18,
    shadowColor: '#173D2C',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  summaryCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  summaryCardTitle: {
    color: '#173D2C',
    fontSize: 17,
    fontWeight: '800',
  },
  submittedBadge: {
    backgroundColor: '#e8f4eb',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  submittedBadgeText: {
    color: '#1f7a3f',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#66736A',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmationPickupId: {
    color: '#173D2C',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 4,
  },
  summaryDivider: {
    backgroundColor: '#e7eee8',
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  summaryDetailRow: {
    borderBottomColor: '#eef2ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingVertical: 12,
  },
  summaryValue: {
    color: '#26372D',
    fontSize: 14,
    lineHeight: 20,
  },
  pricingInfoCard: {
    alignItems: 'flex-start',
    backgroundColor: '#eef6f0',
    borderColor: '#dce8de',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 14,
  },
  pricingInfoIcon: {
    alignItems: 'center',
    backgroundColor: '#dceee0',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pricingInfoCopy: {
    flex: 1,
  },
  pricingInfoTitle: {
    color: '#173D2C',
    fontSize: 14,
    fontWeight: '800',
  },
  pricingInfoText: {
    color: '#4c5b51',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  confirmationActions: {
    marginTop: 22,
  },
  confirmationPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#1f7a3f',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  confirmationPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  confirmationScheduleButton: {
    alignItems: 'center',
    backgroundColor: '#176744',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  confirmationScheduleButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmationHomeButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#1f7a3f',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  confirmationHomeButtonText: {
    color: '#1f7a3f',
    fontSize: 15,
    fontWeight: '800',
  },
  value: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 23,
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
  },

  quantityButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f7a3f',
    backgroundColor: '#ecfdf3',
  },

  quantityButtonText: {
    color: '#1f7a3f',
    fontSize: 24,
    fontWeight: '700',
  },

  quantityValue: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },

  summaryBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    marginTop: 16,
    padding: 14,
  },
  quoteBox: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#9ac9a8',
    borderRadius: 10,
    backgroundColor: '#f1f8f2',
  },
  quoteHeading: {
    color: '#245b35',
    fontSize: 14,
    fontWeight: '700',
  },
  quoteAmount: {
    marginTop: 4,
    marginBottom: 8,
    color: '#164526',
    fontSize: 24,
    fontWeight: '800',
  },

  summaryText: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
});
