import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  collection,
  doc,
} from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/services/firebase';
import {
  getActivePickupWasteTypes,
  getSavedPickupAddresses,
  submitPickup,
  type ActiveWasteType,
  type SavedPickupAddress,
  type SubmitPickupInput,
  type SubmittedPickup,
} from '@/services/pickups';

type SubmissionPayload = Omit<SubmitPickupInput, 'submissionId'>;

interface PendingSubmission {
  id: string;
  payload: SubmissionPayload;
}

function getErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code.replace(/^functions\//, '')
      : '';

  if (code === 'unauthenticated' || code === 'permission-denied') {
    return 'Your customer session or account is no longer active. Sign in again or contact support.';
  }
  if (code === 'failed-precondition') {
    return error instanceof Error
      ? error.message
      : 'No eligible facility could accept this pickup. Please try again later.';
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
  const date = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
  );
  return date.getFullYear() === Number(yearText) &&
    date.getMonth() === Number(monthText) - 1 &&
    date.getDate() === Number(dayText);
}

function isValidTime(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}

export default function SchedulePickupScreen() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<SavedPickupAddress[]>([]);
  const [wasteTypes, setWasteTypes] = useState<ActiveWasteType[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingWasteTypes, setLoadingWasteTypes] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [wasteTypeError, setWasteTypeError] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedWasteTypeId, setSelectedWasteTypeId] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState<SubmittedPickup | null>(
    null,
  );
  const submissionInFlight = useRef(false);
  const pendingSubmission = useRef<PendingSubmission | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingAddresses(true);
    setAddressError('');
    try {
      const result = await getSavedPickupAddresses(firebaseUser.uid);
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
      setAddressError(
        'Saved addresses could not be loaded. Check your connection and retry.',
      );
    } finally {
      setLoadingAddresses(false);
    }
  }, [firebaseUser]);

  const loadWasteTypes = useCallback(async () => {
    setLoadingWasteTypes(true);
    setWasteTypeError('');
    try {
      const result = await getActivePickupWasteTypes();
      setWasteTypes(result);
      setSelectedWasteTypeId((current) =>
        result.some((wasteType) => wasteType.id === current)
          ? current
          : result[0]?.id ?? '',
      );
    } catch (error) {
      console.error('Failed to load active pickup waste types:', error);
      setWasteTypeError(
        'Active waste types could not be loaded. Check your connection and retry.',
      );
    } finally {
      setLoadingWasteTypes(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace('/signup');
      return;
    }
    void loadAddresses();
    void loadWasteTypes();
  }, [authLoading, firebaseUser, loadAddresses, loadWasteTypes]);

  function updatePayloadField(
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setSubmitError('');
  }

  async function handleSubmit() {
    if (submissionInFlight.current || confirmation) return;
    setSubmitError('');

    if (!selectedAddressId) {
      setSubmitError('Choose one of your saved pickup addresses.');
      return;
    }
    if (!selectedWasteTypeId) {
      setSubmitError('Choose an active waste type.');
      return;
    }

    const weight = Number(estimatedWeight);
    if (
      !estimatedWeight.trim() ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      setSubmitError('Estimated weight must be greater than 0 kg.');
      return;
    }
    if (!isValidDate(scheduledDate)) {
      setSubmitError('Enter a valid date using YYYY-MM-DD.');
      return;
    }
    if (!isValidTime(scheduledTime)) {
      setSubmitError('Enter a valid time using 24-hour HH:MM format.');
      return;
    }

    const payload: SubmissionPayload = {
      addressId: selectedAddressId,
      wasteTypeId: selectedWasteTypeId,
      estimatedWeight: weight,
      scheduledDate: scheduledDate.trim(),
      scheduledTime: scheduledTime.trim(),
      notes: notes.trim(),
    };
    const pending = pendingSubmission.current;
    const attempt =
      pending && JSON.stringify(pending.payload) === JSON.stringify(payload)
        ? pending
        : {
            id: doc(collection(firestore, 'pickups')).id,
            payload,
          };
    pendingSubmission.current = attempt;

    submissionInFlight.current = true;
    setSubmitting(true);
    try {
      const result = await submitPickup({
        ...attempt.payload,
        submissionId: attempt.id,
      });
      setConfirmation(result);
      pendingSubmission.current = null;
    } catch (error) {
      console.error('Failed to submit customer pickup:', error);
      setSubmitError(getErrorMessage(error));
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleNewSubmission() {
    pendingSubmission.current = null;
    setConfirmation(null);
    setSelectedAddressId('');
    setSelectedWasteTypeId('');
    setEstimatedWeight('');
    setScheduledDate('');
    setScheduledTime('');
    setNotes('');
    setSubmitError('');
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
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.successTitle}>Pickup Request Submitted</Text>
          <Text style={styles.body}>
            Your pickup request has been confirmed.
          </Text>
          <Text style={styles.label}>Pickup reference</Text>
          <Text selectable style={styles.value}>
            {confirmation.pickupId}
          </Text>
          <Text style={styles.label}>Assigned facility</Text>
          {confirmation.facilityName && confirmation.facilityAddress ? (
            <Text style={styles.value}>
              {confirmation.facilityName}{'\n'}{confirmation.facilityAddress}
            </Text>
          ) : (
            <Text style={styles.value}>
              Destination details were not returned.
            </Text>
          )}
          <Pressable
            style={styles.button}
            onPress={handleNewSubmission}
          >
            <Text style={styles.buttonText}>Schedule Another Pickup</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/home')}
      >
        <Text style={styles.backLink}>‹ Back to Home</Text>
      </Pressable>
      <Text style={styles.title}>Schedule a Pickup</Text>
      <Text style={styles.body}>
        Provide your pickup details. BasuraGo will select an eligible facility.
      </Text>

      <View style={styles.card}>
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
          <Text style={styles.helper}>
            You do not have a usable saved address yet. Add an address to your
            customer profile before scheduling a pickup.
          </Text>
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
              disabled={submitting}
            >
              <Text style={styles.optionTitle}>
                {address.label || 'Saved address'}
                {address.isDefault ? ' · Default' : ''}
              </Text>
              <Text style={styles.optionText}>{address.address}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.card}>
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
              onPress={() =>
                updatePayloadField(
                  setSelectedWasteTypeId,
                  wasteType.id,
                )
              }
              disabled={submitting}
            >
              <Text style={styles.optionTitle}>{wasteType.name}</Text>
              {wasteType.description ? (
                <Text style={styles.optionText}>
                  {wasteType.description}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Schedule details</Text>
        <Text style={styles.label}>Estimated weight (kg)</Text>
        <TextInput
          style={styles.input}
          value={estimatedWeight}
          onChangeText={(value) =>
            updatePayloadField(setEstimatedWeight, value)
          }
          keyboardType="decimal-pad"
          placeholder="e.g. 5"
          editable={!submitting}
        />
        <Text style={styles.label}>Pickup date</Text>
        <TextInput
          style={styles.input}
          value={scheduledDate}
          onChangeText={(value) =>
            updatePayloadField(setScheduledDate, value)
          }
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          editable={!submitting}
        />
        <Text style={styles.label}>Pickup time</Text>
        <TextInput
          style={styles.input}
          value={scheduledTime}
          onChangeText={(value) =>
            updatePayloadField(setScheduledTime, value)
          }
          placeholder="HH:MM (24-hour)"
          autoCapitalize="none"
          editable={!submitting}
        />
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={(value) => updatePayloadField(setNotes, value)}
          placeholder="Anything the rider should know?"
          multiline
          maxLength={1000}
          editable={!submitting}
        />
      </View>

      {submitError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {submitError}
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.button,
          (submitting ||
            loadingAddresses ||
            loadingWasteTypes ||
            Boolean(addressError) ||
            Boolean(wasteTypeError) ||
            addresses.length === 0 ||
            wasteTypes.length === 0) &&
            styles.buttonDisabled,
        ]}
        onPress={() => void handleSubmit()}
        disabled={
          submitting ||
          loadingAddresses ||
          loadingWasteTypes ||
          Boolean(addressError) ||
          Boolean(wasteTypeError) ||
          addresses.length === 0 ||
          wasteTypes.length === 0
        }
      >
        {submitting ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.buttonText}>Submitting...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            {pendingSubmission.current ? 'Retry Submission' : 'Submit Pickup'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f7f8f7',
    padding: 24,
    paddingTop: 56,
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
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
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
  value: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 23,
  },
});
