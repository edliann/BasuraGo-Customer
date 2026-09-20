import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

export default function SignupScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable
            style={styles.skipButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          {/* Temporary illustration area */}
          <View style={styles.illustration}>
            <Text style={styles.illustrationText}>
              BasuraGo
            </Text>
          </View>
        </View>

        {/* Bottom Sheet */}
        <View style={styles.sheet}>
          <Text style={styles.title}>
            Sign up or log in
          </Text>

          <Text style={styles.subtitle}>
            SIGN UP TO GET YOUR DISCOUNT
          </Text>

          {/* Google */}
          <Pressable
            style={styles.googleButton}
            onPress={() => {
              // Google authentication will be added later.
            }}
          >
            <Text style={styles.googleIcon}>G</Text>

            <Text style={styles.googleText}>
              Continue with Google
            </Text>
          </Pressable>

          {/* Apple */}
          <Pressable
            style={styles.appleButton}
            onPress={() => {
              // Apple authentication will be added later.
            }}
          >
            <Text style={styles.appleIcon}>●</Text>

            <Text style={styles.appleText}>
              Continue with Apple
            </Text>
          </Pressable>

          {/* Facebook */}
          <Pressable
            style={styles.facebookButton}
            onPress={() => {
              // Facebook authentication will be added later.
            }}
          >
            <Text style={styles.facebookIcon}>f</Text>

            <Text style={styles.facebookText}>
              Continue with Facebook
            </Text>
          </Pressable>

          {/* More methods */}
          <Pressable
            style={styles.moreMethodsButton}
            onPress={() => router.push('/email-signup')}
          >
            <Text style={styles.moreMethodsText}>
              View more methods
            </Text>
          </Pressable>

          {/* Terms */}
          <Text style={styles.terms}>
            By signing up you agree to our{' '}
            <Text style={styles.link}>
              Terms and Conditions
            </Text>{' '}
            and{' '}
            <Text style={styles.link}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FF2583',
  },

  scrollContent: {
    flexGrow: 1,
  },

  hero: {
    minHeight: 430,
    backgroundColor: '#FF2583',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  skipButton: {
    position: 'absolute',
    right: 24,
    top: 16,
    zIndex: 10,
  },

  skipText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
  },

  illustration: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },

  illustrationText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 36,
  },

  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#24272B',
    marginBottom: 28,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#24272B',
    marginBottom: 16,
  },

  googleButton: {
    height: 58,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 14,
  },

  googleIcon: {
    position: 'absolute',
    left: 24,
    fontSize: 24,
    fontWeight: '700',
    color: '#4285F4',
  },

  googleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#5F6368',
  },

  appleButton: {
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 14,
    backgroundColor: '#292D32',
  },

  appleIcon: {
    position: 'absolute',
    left: 25,
    color: '#FFFFFF',
    fontSize: 22,
  },

  appleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  facebookButton: {
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 22,
    backgroundColor: '#1877F2',
  },

  facebookIcon: {
    position: 'absolute',
    left: 26,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  facebookText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  moreMethodsButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginBottom: 26,
  },

  moreMethodsText: {
    fontSize: 16,
    color: '#24272B',
    textDecorationLine: 'underline',
  },

  terms: {
    fontSize: 14,
    lineHeight: 21,
    color: '#777777',
    textAlign: 'center',
  },

  link: {
    color: '#E91E63',
    textDecorationLine: 'underline',
  },
});