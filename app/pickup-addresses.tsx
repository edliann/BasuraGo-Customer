import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { useAuth } from '@/contexts/AuthContext';
import { goBackOrReplace } from '@/navigation/back';
import {
  isMeaningfulPickupAddress,
  savePickupAddress,
} from '@/services/pickups';

export default function PickupAddressesScreen() {
  const { firebaseUser } = useAuth();
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function captureLocation() {
    setError('');
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission is needed to save a pickup point. You can enable it in device settings and try again.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      if (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ) {
        setError('The device returned an invalid location. Please try again.');
        return;
      }

      setCoordinates({ latitude, longitude });
      setLocationConfirmed(false);
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        const place = results[0];
        const suggestedAddress = place
          ? [place.streetNumber, place.street, place.district, place.city, place.region, place.postalCode]
            .filter((part): part is string => Boolean(part?.trim()))
            .join(', ')
          : '';
        if (suggestedAddress) setAddress(suggestedAddress);
      } catch {
        // Coordinates remain valid; the customer can enter the address text manually.
      }
    } catch {
      setError('Could not get your current location. Check device location settings and retry.');
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleSave() {
    if (!firebaseUser?.uid) {
      setError('Sign in again before saving a pickup address.');
      return;
    }
    if (!isMeaningfulPickupAddress(address)) {
      setError('Enter a full street address or a clear landmark and area.');
      return;
    }
    if (!coordinates || !locationConfirmed) {
      setError('Capture the pickup location and confirm it marks the pickup entrance.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await savePickupAddress(firebaseUser.uid, {
        label,
        address,
        ...coordinates,
      });
      goBackOrReplace('/account');
    } catch (saveError) {
      const code =
        typeof saveError === 'object' && saveError !== null && 'code' in saveError
          ? String(saveError.code)
          : '';
      setError(code.includes('permission-denied')
        ? 'Your customer account cannot save an address right now. Check that it is active, then retry.'
        : 'The address could not be saved. Check your connection and retry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => goBackOrReplace('/account')}
      >
        <Text style={styles.backLink}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Pickup address</Text>
      <Text style={styles.description}>
        Stand at the pickup entrance and capture its device location. Confirm the address details before saving.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Label</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Home, work, etc."
          maxLength={40}
        />
        <Text style={styles.label}>Full pickup address</Text>
        <TextInput
          style={[styles.input, styles.addressInput]}
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            setLocationConfirmed(false);
          }}
          placeholder="Street, building or landmark, area"
          multiline
          maxLength={300}
        />
        <Text style={styles.helper}>
          Use the reverse-geocoded suggestion or enter the address shown at the captured pickup point.
        </Text>

        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, locationLoading && styles.disabled]}
          onPress={() => void captureLocation()}
          disabled={locationLoading || saving}
        >
          {locationLoading ? <ActivityIndicator color="#1f7a3f" /> : null}
          <Text style={styles.secondaryButtonText}>
            {locationLoading ? 'Getting location...' : coordinates ? 'Refresh current location' : 'Use current location'}
          </Text>
        </Pressable>
        {coordinates ? (
          <>
            <Text style={styles.locationStatus}>Pickup coordinates captured.</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: locationConfirmed }}
              style={styles.confirmRow}
              onPress={() => setLocationConfirmed((current) => !current)}
            >
              <View style={[styles.checkbox, locationConfirmed && styles.checkboxChecked]}>
                {locationConfirmed ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.confirmText}>This point marks the pickup entrance.</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.helper}>A valid device location is required; no coordinates are generated from the address text.</Text>
        )}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.saveButton, (saving || locationLoading || !isMeaningfulPickupAddress(address) || !coordinates || !locationConfirmed) && styles.disabled]}
        onPress={() => void handleSave()}
        disabled={saving || locationLoading || !isMeaningfulPickupAddress(address) || !coordinates || !locationConfirmed}
      >
        {saving ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.saveButtonText}>{saving ? 'Saving address...' : 'Save pickup address'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f7f8f7', padding: 24, paddingTop: 56 },
  backLink: { color: '#1f7a3f', fontSize: 16, fontWeight: '700', marginBottom: 18 },
  title: { color: '#111827', fontSize: 28, fontWeight: '800' },
  description: { color: '#4b5563', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18 },
  label: { color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 7, marginTop: 14 },
  input: { backgroundColor: '#fff', borderColor: '#d1d5db', borderRadius: 9, borderWidth: 1, color: '#111827', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  addressInput: { minHeight: 94, textAlignVertical: 'top' },
  helper: { color: '#6b7280', fontSize: 13, lineHeight: 19, marginTop: 8 },
  secondaryButton: { alignItems: 'center', borderColor: '#1f7a3f', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 18, minHeight: 48, padding: 12 },
  secondaryButtonText: { color: '#1f7a3f', fontSize: 15, fontWeight: '700' },
  locationStatus: { color: '#166534', fontSize: 13, marginTop: 10 },
  confirmRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 12 },
  checkbox: { alignItems: 'center', borderColor: '#9ca3af', borderRadius: 4, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 },
  checkboxChecked: { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  checkboxMark: { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmText: { color: '#374151', flex: 1, fontSize: 14 },
  error: { color: '#b42318', fontSize: 14, lineHeight: 21, marginTop: 14 },
  saveButton: { alignItems: 'center', backgroundColor: '#1f7a3f', borderRadius: 10, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 16, minHeight: 52, padding: 14 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
