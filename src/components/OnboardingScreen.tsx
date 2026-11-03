import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

const ONBOARDING_KEY = '@basurago_onboarding_completed';

const slides = [
  {
    image: require('../../assets/onboarding/slide-1.png'),
    title: 'Welcome to BasuraGo',
    description:
      'A convenient way to request waste collection from your home.',
  },
  {
    image: require('../../assets/onboarding/slide-2.png'),
    title: 'Request a Pickup',
    description:
      'Choose your pickup location and tell us what type of waste you need collected.',
  },
  {
    image: require('../../assets/onboarding/slide-3.png'),
    title: 'Track Your Pickup',
    description:
      'Follow your pickup request and stay updated as your rider completes the collection.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savingCompletion, setSavingCompletion] = useState(false);

  const currentSlide = slides[currentIndex];

  const isLastSlide =
    currentIndex === slides.length - 1;

  const handleNext = async () => {
    if (!isLastSlide) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (savingCompletion) return;

    setSavingCompletion(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      router.replace('/signup');
    } catch (error) {
      console.error('[Onboarding] could not save completion state', error);
      Alert.alert(
        'Could not continue',
        'Please try again. Your onboarding progress has not been saved.',
      );
    } finally {
      setSavingCompletion(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.illustration}>
          <Image
            source={currentSlide.image}
            style={styles.illustrationImage}
            resizeMode="contain"
            accessibilityLabel={currentSlide.title}
          />
        </View>

        <Text style={styles.title}>
          {currentSlide.title}
        </Text>

        <Text style={styles.description}>
          {currentSlide.description}
        </Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex &&
                  styles.activeDot,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={handleNext}
          disabled={savingCompletion}
        >
          <Text style={styles.buttonText}>
            {savingCompletion ? 'Saving...' : isLastSlide ? 'Get Started' : 'Next'}
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
    paddingTop: 60,
    paddingBottom: 40,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  illustration: {
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },

  illustrationImage: {
    width: '100%',
    height: '100%',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 340,
  },

  bottom: {
    alignItems: 'center',
  },

  dots: {
    flexDirection: 'row',
    marginBottom: 24,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#D0D0D0',
  },

  activeDot: {
    width: 24,
    backgroundColor: '#1F7A3F',
  },

  button: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#1F7A3F',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
