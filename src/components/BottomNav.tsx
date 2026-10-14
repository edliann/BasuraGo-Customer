
import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import RemixIcon from 'react-native-remix-icon';
import type { IconName } from 'react-native-remix-icon';

import styles from './BottomNav.styles';

function NavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
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
        <RemixIcon
          name={icon}
          size={23}
          color={active ? '#176744' : '#8B9690'}
        />
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
          icon="home-5-line"
          active={pathname === '/home'}
          onPress={() => router.replace('/home')}
        />

        <NavItem
          label="Orders"
          icon="file-list-3-line"
          active={pathname.startsWith('/orders')}
          onPress={() => router.push('/orders')}
        />

        <NavItem
          label="Account"
          icon="user-3-line"
          active={pathname === '/account'}
          onPress={() => router.replace('/account')}
        />
      </View>
    </View>
  );
}
