import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function AuthLandingScreen() {
  const handleGoogle = () => {
    // Google authentication will be implemented later.
  };

  const handleApple = () => {
    // Apple authentication will be implemented later.
  };

  const handleFacebook = () => {
    // Facebook authentication will be implemented later.
  };

  return (
    <View style={styles.container}>
      {/* Top visual area */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>BG</Text>
        </View>

        <Text style={styles.heroTitle}>
          Welcome to BasuraGo
        </Text>

        <Text style={styles.heroSubtitle}>
          Smarter waste collection, right at your doorstep.
        </Text>
      </View>

      {/* Bottom authentication sheet */}
      <View style={styles.sheet}>
        <Text style={styles.title}>
          Sign up or log in
        </Text>

        <Text style={styles.subtitle}>
          Join BasuraGo and make waste collection easier.
        </Text>

        {/* Google */}
        <Pressable
          style={styles.socialButton}
          onPress={handleGoogle}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>

          <Text style={styles.socialButtonText}>
            Continue with Google
          </Text>
        </Pressable>

        {/* Apple */}
        <Pressable
          style={styles.socialButton}
          onPress={handleApple}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.appleIcon}>●</Text>
          </View>

          <Text style={styles.socialButtonText}>
            Continue with Apple
          </Text>
        </Pressable>

        {/* Facebook */}
        <Pressable
          style={styles.socialButton}
          onPress={handleFacebook}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.facebookIcon}>f</Text>
          </View>

          <Text style={styles.socialButtonText}>
            Continue with Facebook
          </Text>
        </Pressable>

        {/* More methods */}
        <Pressable
          style={styles.moreMethodsButton}
          onPress={() => router.push('/auth-methods')}
        >
          <Text style={styles.moreMethodsText}>
            View more methods
          </Text>
        </Pressable>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>
            Terms and Conditions
          </Text>{' '}
          and{' '}
          <Text style={styles.termsLink}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  iconContainer: {
    position: 'absolute',
    left: 18,
    width: 28,
    alignItems: 'center',
  },

  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },

  appleIcon: {
    fontSize: 17,
    color: '#111111',
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
    alignItems: 'center',
    paddingVertical: 12,
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
    textAlign: 'center',
    color: '#858D86',
    marginTop: 6,
  },

  termsLink: {
    color: '#1F6B3A',
    textDecorationLine: 'underline',
  },
});