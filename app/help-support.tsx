import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBackOrReplace } from '@/navigation/back';

const SUPPORT_EMAIL = 'basurago.support2026@gmail.com';

const FAQ_ITEMS = [
  {
    question: 'How do I book a pickup?',
    answer:
      'Save a pickup address with its location confirmed, choose the waste types, bag sizes, and quantities, then select an available date and time and submit your request. The final price is calculated after a facility is assigned.',
  },
  {
    question: 'How do I review the pickup price?',
    answer:
      'After your request is submitted and a facility is assigned, the Backend calculates the final price using the road distance from your pickup location to that facility. The final quote appears in tracking for you to confirm or decline. The Rider cannot begin collection until you confirm it.',
  },
  {
    question: 'How do I cancel a pickup?',
    answer:
      'When a final price is ready, you can decline it from the tracking screen. The app confirms your choice before sending the cancellation to the Backend. Other cancellation options depend on the pickup state and are not exposed in every screen.',
  },
  {
    question: 'How does pickup tracking work?',
    answer:
      'Open a pickup from Orders to refresh its status. The map can show the saved pickup point and, when an assigned rider has sent a fresh location update, that rider location. An unavailable or stale rider location may not appear as a live position.',
  },
  {
    question: 'I cannot access my account. What can I try?',
    answer:
      'Check your connection and use the same sign-in method you used to create your account. The current app does not include an in-app password recovery flow. If access remains unavailable, email BasuraGo support for assistance.',
  },
];

export default function HelpSupportScreen() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [problemDescription, setProblemDescription] = useState('');

  async function openSupportEmail(
    subject: string,
    body: string,
  ) {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Unable to open email',
        `No email application could open this draft. You can email ${SUPPORT_EMAIL} from your email app.`,
      );
    }
  }

  function contactSupport() {
    void openSupportEmail(
      'BasuraGo Customer Support',
      'Hello BasuraGo Support,\n\nI need help with:\n\n\nThank you.',
    );
  }

  function reportProblem() {
    if (!problemDescription.trim()) {
      Alert.alert(
        'Describe the problem',
        'Add a short description before preparing your email.',
      );
      return;
    }

    void openSupportEmail(
      'BasuraGo App Problem Report',
      `Hello BasuraGo Support,\n\nI would like to report the following problem:\n\n${problemDescription.trim()}\n\nThank you.`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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

          <Text style={styles.eyebrow}>BASURAGO HELP</Text>
          <Text style={styles.title}>Help and support</Text>
          <Text style={styles.intro}>
            Find answers about booking and managing a pickup, or get in touch
            with our support team by email.
          </Text>

          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>Contact Support</Text>
            <Text style={styles.body}>
              Email us at {SUPPORT_EMAIL}. Your email application will open
              with a suggested subject and a polite message template.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={contactSupport}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Contact Support</Text>
            </Pressable>
            <Text style={styles.caption}>
              Review and send the email from your email application. No
              personal or account information is added automatically.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Frequently asked questions</Text>
          <View style={styles.card}>
            {FAQ_ITEMS.map((item, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <View key={item.question}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() =>
                      setExpandedFaq(isExpanded ? null : index)
                    }
                    style={({ pressed }) => [
                      styles.faqButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.question}>{item.question}</Text>
                    <Text style={styles.chevron}>
                      {isExpanded ? '−' : '+'}
                    </Text>
                  </Pressable>
                  {isExpanded ? (
                    <Text style={styles.answer}>{item.answer}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Report a problem</Text>
            <Text style={styles.body}>
              Describe the issue and we will prepare an email draft to
              {` ${SUPPORT_EMAIL}`}. The description is included only in that
              draft.
            </Text>
            <TextInput
              accessibilityLabel="Problem description"
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="What were you trying to do?"
              placeholderTextColor="#8A9B8F"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.input}
            />
            <Text style={styles.characterCount}>
              {problemDescription.length}/1000
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={reportProblem}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Prepare Problem Report
              </Text>
            </Pressable>
            <Text style={styles.caption}>
              Your email application will open. Review the report and send it
              yourself; it is not submitted or saved by BasuraGo.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  flex: {
    flex: 1,
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
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#173D2C',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    padding: 17,
    marginBottom: 14,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    padding: 17,
  },
  cardTitle: {
    color: '#173D2C',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: '#536158',
    fontSize: 14,
    lineHeight: 21,
  },
  faqButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  question: {
    flex: 1,
    color: '#173D2C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  chevron: {
    color: '#176744',
    fontSize: 22,
    fontWeight: '600',
  },
  answer: {
    color: '#536158',
    fontSize: 13,
    lineHeight: 20,
    paddingBottom: 15,
    paddingRight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF1ED',
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 12,
    backgroundColor: '#FAFCFA',
    color: '#173D2C',
    fontSize: 14,
    lineHeight: 20,
    padding: 13,
    marginTop: 14,
  },
  characterCount: {
    color: '#849187',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 5,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#176744',
    borderRadius: 12,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
    borderRadius: 12,
    marginTop: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  caption: {
    color: '#849187',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.75,
  },
});
