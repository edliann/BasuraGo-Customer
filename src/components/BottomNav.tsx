
import { router, usePathname } from 'expo-router';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import styles from './BottomNav.styles';

function NavItem({
  label,
  symbol,
  active,
  onPress,
}: {
  label: string;
  symbol: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.navIconWrap,
          active && styles.navIconWrapActive,
        ]}
      >
        <Text
          style={[
            styles.navSymbol,
            active && styles.navSymbolActive,
          ]}
        >
          {symbol}
        </Text>
      </View>

      <Text
        style={[
          styles.navLabel,
          active && styles.navLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.bottomNavContainer}>
      <LinearGradient
        colors={[
          'rgba(245,248,246,0)',
          'rgba(245,248,246,0.55)',
          'rgba(245,248,246,0.92)',
        ]}
        locations={[0, 0.55, 1]}
        style={styles.navFeather}
        pointerEvents="none"
      />

      <View style={styles.bottomNav}>
        <NavItem
          label="Home"
          symbol="⌂"
          active={pathname === '/home'}
          onPress={() => router.replace('/home')}
        />

        <NavItem
          label="Orders"
          symbol="▤"
          active={pathname.startsWith('/orders')}
          onPress={() => router.push('/orders')}
        />

        <NavItem
          label="Account"
          symbol="♙"
          active={pathname === '/account'}
          onPress={() => router.replace('/account')}
        />
      </View>
    </View>
  );
}
