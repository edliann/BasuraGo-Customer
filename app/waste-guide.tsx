
import { router } from 'expo-router';
import { goBackOrReplace } from '@/navigation/back';
import {
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const categories = [
  {
    title: 'Biodegradable',
    subtitle: 'Food scraps and garden waste',
    image: require('../assets/wasteGuide/biodegradable-icon.png'),
    color: '#E5F4E8',
    examples: 'Fruit peels, vegetable scraps, leftover food, leaves',
    tip: 'Keep organic waste separate. Drain excess liquids and follow your local collection or composting rules.',
  },
  {
    title: 'Recyclable',
    subtitle: 'Materials that can be recovered',
    image: require('../assets/wasteGuide/recyclable-icon.png'),
    color: '#E5EFFB',
    examples: 'Clean paper, cardboard, metal cans, glass bottles, accepted plastic containers',
    tip: 'Empty and clean containers. Keep paper and cardboard dry, and check which plastics your local recycler accepts.',
  },
  {
    title: 'Residual',
    subtitle: 'Waste that cannot be recovered locally',
    image: require('../assets/wasteGuide/residuals-icon.png'),
    color: '#F0F0F0',
    examples: 'Used tissues, contaminated wrappers, certain multilayer sachets',
    tip: 'Keep residual waste separate from clean recyclables. Accepted materials depend on your local waste program.',
  },
  {
    title: 'Special and Hazardous',
    subtitle: 'Items requiring careful handling',
    image: require('../assets/wasteGuide/special-hazardous-icon.png'),
    color: '#FFF0D9',
    examples: 'Batteries, fluorescent lamps, chemicals, e-waste, expired medicines',
    tip: 'Never mix hazardous items with ordinary household waste. Ask your barangay or an authorized collection facility how to dispose of them safely.',
  },
];

export default function WasteGuideScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => goBackOrReplace('/home')}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BASURAGO GUIDE</Text>
          <Text style={styles.headerTitle}>Waste Guide</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Sort smarter. Keep communities cleaner.
          </Text>
          <Text style={styles.heroDescription}>
            A simple guide to separating household waste
            before collection.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Know your waste
        </Text>
        <Text style={styles.sectionDescription}>
          Separate waste at home and check your local
          collection rules before disposal.
        </Text>

        {categories.map((category) => (
          <View key={category.title} style={styles.categoryCard}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: category.color },
              ]}
            >
              <Image
                source={category.image}
                style={styles.categoryIconImage}
                resizeMode="contain"
                accessible
                accessibilityLabel={`${category.title} waste category icon`}
              />
            </View>

            <View style={styles.categoryContent}>
              <Text style={styles.categoryTitle}>
                {category.title}
              </Text>
              <Text style={styles.categorySubtitle}>
                {category.subtitle}
              </Text>

              <Text style={styles.label}>Examples</Text>
              <Text style={styles.body}>
                {category.examples}
              </Text>

              <View style={styles.tipBox}>
                <Text style={styles.tipLabel}>SORTING TIP</Text>
                <Text style={styles.tipText}>
                  {category.tip}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.reminder}>
          <Text style={styles.reminderTitle}>
            Remember
          </Text>
          <Text style={styles.body}>
            Reduce what you throw away, reuse items when
            possible, and keep recyclables clean and dry.
            Waste rules and accepted materials can differ
            between barangays and collection facilities.
          </Text>
        </View>

        <Pressable
          style={styles.pickupButton}
          onPress={() => router.push('/schedule-pickup')}
        >
          <Text style={styles.pickupButtonText}>
            Schedule a Pickup
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
    color: '#176744',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#38A451',
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#173D2C',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  hero: {
    backgroundColor: '#176744',
    borderRadius: 20,
    padding: 22,
    marginBottom: 26,
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#E6F3E9',
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#173D2C',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64736A',
    marginTop: 6,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E1EAE2',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  categoryIconImage: {
    width: 44,
    height: 44,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#173D2C',
  },
  categorySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64736A',
    marginTop: 3,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#176744',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4E5E53',
  },
  tipBox: {
    backgroundColor: '#F3F8F3',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#176744',
    marginBottom: 5,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#405347',
  },
  reminder: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#E8F2E9',
    marginTop: 8,
  },
  reminderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#176744',
    marginBottom: 8,
  },
  pickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 22,
  },
  pickupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pickupArrow: {
    color: '#FFFFFF',
    fontSize: 25,
    marginLeft: 10,
    marginTop: -2,
  },
});
