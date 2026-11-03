import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBackOrReplace } from '@/navigation/back';

interface PrivacySectionProps {
  title: string;
  children: string;
}

function PrivacySection({ title, children }: PrivacySectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to account"
          onPress={() => goBackOrReplace('/account')}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹  Back to account</Text>
        </Pressable>

        <Text style={styles.eyebrow}>YOUR INFORMATION</Text>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.intro}>
          In-app privacy information based on features currently implemented in
          BasuraGo Customer.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important</Text>
          <Text style={styles.noticeBody}>
            This is not an approved legal privacy policy. BasuraGo has not
            configured an official policy URL or privacy contact in this app.
            The final policy and contact process need approval before public
            release.
          </Text>
        </View>

        <View style={styles.card}>
          <PrivacySection title="Information used by the app">
            The Customer app stores account and profile details such as your
            name, email address, and phone number and verification status. If
            you book a pickup, it processes the saved pickup address and
            coordinates, selected waste types and quantities, schedule, notes
            you provide, booking status, and pricing information. Firebase
            Authentication is used for sign-in; profile and service records
            are handled through Firebase services and the BasuraGo Backend.
          </PrivacySection>

          <PrivacySection title="How information is used">
            These details support account access, saving pickup locations,
            requesting and coordinating pickups, showing booking history and
            status, calculating and presenting estimates and final prices, and
            providing pickup tracking features.
          </PrivacySection>

          <PrivacySection title="Location and tracking">
            Customer location permission is requested when you choose to use
            your current location while adding or refreshing a pickup address.
            The app captures that point for the pickup address; this is not
            continuous Customer background tracking. The tracking screen can
            display the saved pickup point and a fresh location supplied by an
            assigned Rider. Rider GPS collection and publication are separate
            Rider-app processes.
          </PrivacySection>

          <PrivacySection title="Sharing for pickup service">
            Pickup and contact details are sent to BasuraGo Backend services
            to create and manage bookings. Relevant pickup details are made
            available to the assigned Rider and destination facility or staff
            as needed to coordinate collection and processing. The app also
            uses Firebase Authentication, Firestore, and callable Backend
            functions. Maps and device location/reverse-geocoding features use
            the platform and configured map/location providers. The app offers
            Google and Facebook sign-in; those providers handle their own
            authentication interactions.
          </PrivacySection>

          <PrivacySection title="Storage and retention">
            Pickup addresses, customer profiles, and pickup records are stored
            in Firebase-backed services. The app also temporarily stores a
            pending pickup submission on the device so it can retry using the
            same submission ID. The code does not establish a general data
            retention period or define when service records are removed.
          </PrivacySection>

          <PrivacySection title="Account and data deletion">
            The Customer app currently provides sign-out, which ends the local
            signed-in session; it does not delete your Firebase account,
            profile, addresses, or pickup history. No customer account or data
            deletion flow is implemented in this app. A deletion request
            cannot be submitted from this screen because no verified privacy
            contact or request service is configured.
          </PrivacySection>

          <PrivacySection title="Security and privacy contact">
            No official security or privacy contact details are configured in
            the app. Do not treat this information page as a channel for
            submitting personal-data requests or sensitive information.
          </PrivacySection>
        </View>

        <Text style={styles.footer}>
          This summary describes implementation found in the app and Backend
          integration. It does not define legal rights, retention periods, or
          deletion guarantees.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginBottom: 14,
    paddingRight: 12,
  },
  backText: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#38B84A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: '#173D2C',
    fontSize: 28,
    fontWeight: '800',
  },
  intro: {
    color: '#64736A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },
  notice: {
    backgroundColor: '#FFF8E8',
    borderColor: '#F1E2B9',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  noticeTitle: {
    color: '#604A15',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  noticeBody: {
    color: '#66582F',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    paddingHorizontal: 16,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1ED',
  },
  sectionTitle: {
    color: '#173D2C',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 7,
  },
  body: {
    color: '#536158',
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    color: '#849187',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 15,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.75,
  },
});
