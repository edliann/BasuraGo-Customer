import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  clearPendingFacebookCredential,
  getFacebookAuthErrorCode,
  signInWithFacebook,
} from '@/services/facebookAuth';
import {
  getGoogleSignInErrorDetails,
  signInWithGoogle,
} from '@/services/googleAuth';
import {
  getCustomerOnboardingErrorMessage,
  isCustomerOnboardingError,
} from '@/services/customerAuth';

import GoogleIcon from '@/components/GoogleIcon';
import FacebookIcon from '@/components/FacebookIcon';

export default function SignupScreen() {
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [facebookLoading, setFacebookLoading] =
    useState(false);
  const [activeLegalModal, setActiveLegalModal] =
    useState<'terms' | 'privacy' | null>(null);

  const handleGoogle = async () => {
    if (googleLoading) {
      return;
    }

    setGoogleLoading(true);

    try {
      const user = await signInWithGoogle();

      if (!user) {
        return;
      }

      router.replace('/');
    } catch (error) {
      if (__DEV__) {
        console.error(
          '[Google sign-in] signup screen caught error',
          getGoogleSignInErrorDetails(error),
        );
      }
      Alert.alert(
        'Google sign-in failed',
        isCustomerOnboardingError(error)
          ? getCustomerOnboardingErrorMessage(error)
          : 'We could not sign you in with Google. Please try again.',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleFacebook = async () => {
    if (facebookLoading) {
      return;
    }

    try {
      setFacebookLoading(true);

      const user = await signInWithFacebook();

      // A null result means the user cancelled Facebook sign-in.
      if (!user) {
        return;
      }

      router.replace('/');
    } catch (error) {
      const code = getFacebookAuthErrorCode(error);
      console.warn('Facebook sign-in failed:', code || 'unknown error');

      if (
        code === 'auth/account-exists-with-different-credential' ||
        code === 'auth/email-already-in-use'
      ) {
        Alert.alert(
          'Sign in to your existing account',
          'Sign in with the email and password you already use for this account. After Firebase confirms that sign-in, Facebook will be linked to that same account.',
          [
            {
              text: 'Not now',
              style: 'cancel',
              onPress: clearPendingFacebookCredential,
            },
            {
              text: 'Continue',
              onPress: () =>
                router.push({
                  pathname: '/login',
                  params: { linkFacebook: '1' },
                }),
            },
          ],
        );
      } else if (code === 'auth/credential-already-in-use') {
        clearPendingFacebookCredential();
        Alert.alert(
          'Facebook account already linked',
          'This Facebook account is already linked to another account. Sign in to that account to continue; accounts will not be merged automatically.',
        );
      } else if (code === 'auth/invalid-credential') {
        Alert.alert(
          'Facebook sign-in expired',
          'Please start Facebook sign-in again.',
        );
      } else if (code === 'auth/network-request-failed') {
        Alert.alert(
          'Connection problem',
          'Facebook sign-in could not reach Firebase. Check your connection and try again.',
        );
      } else {
        Alert.alert(
          'Facebook sign-in failed',
          'We could not sign you in with Facebook. Please try again.',
        );
      }
    } finally {
      setFacebookLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../assets/hero/basurago-logo.png')}
          style={styles.heroLogo}
          resizeMode="contain"
          accessibilityLabel="BasuraGo logo"
        />

        <Text style={styles.heroTitle}>
          Welcome to BasuraGo
        </Text>

        <Text style={styles.heroSubtitle}>
          Smarter waste collection, right at your doorstep.
        </Text>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>
          Sign up or log in
        </Text>

        <Text style={styles.subtitle}>
          Join BasuraGo and make waste collection easier.
        </Text>

        <Pressable
          style={[
            styles.socialButton,
            googleLoading && styles.disabledButton,
          ]}
          onPress={handleGoogle}
          disabled={googleLoading}
        >
          <View style={styles.iconContainer}>
            <GoogleIcon />
          </View>

          <Text style={styles.socialButtonText}>
            {googleLoading
              ? 'Signing in...'
              : 'Continue with Google'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.socialButton,
            facebookLoading && styles.disabledButton,
            { display: 'none' }, // Hide Facebook button for now
          ]}
          onPress={handleFacebook}
          disabled={facebookLoading}
        >
          <View style={styles.iconContainer}>
            <FacebookIcon />
          </View>

          <Text style={styles.socialButtonText}>
            {facebookLoading
              ? 'Signing in...'
              : 'Continue with Facebook'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.moreMethodsButton}
          onPress={() => router.push('/auth-methods')}
        >
          <Text style={styles.moreMethodsText}>
            View more methods
          </Text>
        </Pressable>

        <View style={styles.legalFooter}>
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => setActiveLegalModal('terms')}
              accessibilityRole="button"
            >
              Terms and Conditions
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => setActiveLegalModal('privacy')}
              accessibilityRole="button"
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>

    <Modal
      visible={activeLegalModal !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setActiveLegalModal(null)}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setActiveLegalModal(null)}
          accessibilityLabel="Close legal information"
        />

        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeLegalModal === 'terms'
                ? 'Terms and Conditions'
                : 'Privacy Policy'}
            </Text>

            <Pressable
              onPress={() => setActiveLegalModal(null)}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator
          >
            {activeLegalModal === 'terms' ? (
              <>
                <Text style={styles.legalHeading}>
                  Terms and Conditions
                </Text>
                <Text style={styles.legalUpdated}>
                  Please review these terms before using BasuraGo.
                </Text>

                <Text style={styles.legalHeading}>
                  1. Use of BasuraGo
                </Text>
                <Text style={styles.legalParagraph}>
                  BasuraGo is designed to help customers request and
                  manage waste collection services. You agree to provide
                  accurate information and use the app responsibly.
                </Text>

                <Text style={styles.legalHeading}>
                  2. Pickup Requests
                </Text>
                <Text style={styles.legalParagraph}>
                  Pickup availability, schedules, service areas, and
                  applicable fees may vary. A request is not confirmed
                  until BasuraGo displays its confirmed status.
                </Text>

                <Text style={styles.legalHeading}>
                  3. Customer Responsibilities
                </Text>
                <Text style={styles.legalParagraph}>
                  You are responsible for providing a valid pickup
                  address, accurate contact information, and truthful
                  details about the waste you submit for collection.
                </Text>

                <Text style={styles.legalHeading}>
                  4. Accounts and Security
                </Text>
                <Text style={styles.legalParagraph}>
                  Keep your account credentials secure and notify us if
                  you suspect unauthorized access to your account.
                </Text>

                <Text style={styles.legalHeading}>
                  5. Changes and Availability
                </Text>
                <Text style={styles.legalParagraph}>
                  Service availability and these terms may change as
                  BasuraGo develops. Material changes should be
                  communicated appropriately.
                </Text>

                <Text style={styles.legalHeading}>
                  6. Contact
                </Text>
                <Text style={styles.legalParagraph}>
                  Contact the BasuraGo team through the support channel
                  provided in the app for questions about these terms.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.legalHeading}>
                  Privacy Policy
                </Text>
                <Text style={styles.legalUpdated}>
                  This section explains how BasuraGo may handle customer
                  information. Finalize it to reflect your actual
                  practices before public release.
                </Text>

                <Text style={styles.legalHeading}>
                  1. Information We Collect
                </Text>
                <Text style={styles.legalParagraph}>
                  Depending on the features you use, BasuraGo may process
                  your name, contact details, authentication information,
                  pickup address, and service requests.
                </Text>

                <Text style={styles.legalHeading}>
                  2. How Information Is Used
                </Text>
                <Text style={styles.legalParagraph}>
                  Information may be used to manage your account,
                  coordinate pickups, provide customer support, maintain
                  security, and improve the service.
                </Text>

                <Text style={styles.legalHeading}>
                  3. Service Providers
                </Text>
                <Text style={styles.legalParagraph}>
                  BasuraGo may rely on service providers for
                  authentication, data storage, and app operations.
                  Access to information should be limited to what is
                  necessary for their functions.
                </Text>

                <Text style={styles.legalHeading}>
                  4. Data Protection
                </Text>
                <Text style={styles.legalParagraph}>
                  Appropriate technical and organizational safeguards
                  should be used to protect personal information against
                  unauthorized access, loss, or misuse.
                </Text>

                <Text style={styles.legalHeading}>
                  5. Your Privacy Rights
                </Text>
                <Text style={styles.legalParagraph}>
                  You may have rights to access, correct, or request
                  deletion of your personal information, subject to
                  applicable law and legitimate retention requirements.
                </Text>

                <Text style={styles.legalHeading}>
                  6. Contact and Requests
                </Text>
                <Text style={styles.legalParagraph}>
                  Provide an official BasuraGo privacy contact here so
                  customers can submit privacy questions or requests.
                </Text>
              </>
            )}
          </ScrollView>

          <Pressable
            style={styles.modalDoneButton}
            onPress={() => setActiveLegalModal(null)}
          >
            <Text style={styles.modalDoneText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F4',
  },

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 50,
  },

  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCEBDD',
    marginBottom: 28,
  },

  logoText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1F6B3A',
  },

  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: '#172019',
    marginBottom: 10,
  },

  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#647067',
    maxWidth: 320,
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 34,

    elevation: 8,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172019',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#68736B',
    marginBottom: 20,
  },

  socialButton: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D9DED9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },

  iconContainer: {
    position: 'absolute',
    left: 18,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },

  facebookIcon: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1877F2',
  },

  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202520',
  },

  moreMethodsButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 18,
  },

  moreMethodsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F6B3A',
    textDecorationLine: 'underline',
  },

  terms: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7A827C',
    textAlign: 'center',
  },

  termsLink: {
    color: '#1F6B3A',
    textDecorationLine: 'underline',
  },

  disabledButton: {
    opacity: 0.6,
  },

  heroLogo: {
    width: '100%',
    maxWidth: 360,
    height: 130,
    marginBottom: 28,
  },
    
  legalFooter: {
    marginTop: 0,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },

  modalSheet: {
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },

  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DCE3DD',
    alignSelf: 'center',
    marginBottom: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#172019',
    marginRight: 12,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F5F0',
  },

  modalCloseText: {
    fontSize: 18,
    color: '#405347',
  },

  modalScroll: {
    flexShrink: 1,
  },

  modalContent: {
    paddingBottom: 20,
  },

  legalHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F6B3A',
    marginTop: 18,
    marginBottom: 8,
  },

  legalUpdated: {
    fontSize: 13,
    lineHeight: 20,
    color: '#68736B',
    marginBottom: 8,
  },

  legalParagraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#465149',
  },

  modalDoneButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
    marginTop: 16,
  },

  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

});
