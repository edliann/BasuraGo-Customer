import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function AuthMethodsScreen() {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>
          More ways to continue
        </Text>

        <Text style={styles.subtitle}>
          Choose how you want to access your BasuraGo account.
        </Text>

        <Pressable
          style={styles.methodButton}
          onPress={() => router.push('/email-signup')}
        >
          <Text style={styles.methodTitle}>
            Continue with Email
          </Text>

          <Text style={styles.methodDescription}>
            Sign up or log in using your email address.
          </Text>
        </Pressable>

        <Pressable
          style={styles.methodButton}
          onPress={() => {
            // Phone authentication will be implemented next.
          }}
        >
          <Text style={styles.methodTitle}>
            Continue with Phone
          </Text>

          <Text style={styles.methodDescription}>
            Verify your phone number with a one-time code.
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.accountText}>
          Already have a BasuraGo account?
        </Text>

        <Pressable
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.loginLink}>
            Log in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 35,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    fontSize: 36,
    fontWeight: '300',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#68736B',
    marginBottom: 28,
  },

  methodButton: {
    borderWidth: 1,
    borderColor: '#D9DED9',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },

  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  methodDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#68736B',
  },

  bottom: {
    alignItems: 'center',
  },

  accountText: {
    fontSize: 13,
    color: '#68736B',
    marginBottom: 6,
  },

  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});