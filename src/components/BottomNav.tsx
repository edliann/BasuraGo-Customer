
import { router, usePathname } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import styles from './BottomNav.styles';

function NavItem({
  label,
  image,
  active,
  onPress,
}: {
  label: string;
  image: number;
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
        <Image
          source={image}
          style={[styles.navImage, !active && styles.navImageInactive]}
          resizeMode="contain"
          accessible={false}
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
  const isOrdersRoute = pathname.startsWith('/orders');

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
          image={require('../../assets/bottomNav/home-icon.png')}
          active={pathname === '/home'}
          onPress={() => {
            if (pathname !== '/home') router.replace('/home');
          }}
        />

        <NavItem
          label="Orders"
          image={require('../../assets/bottomNav/orders-icon.png')}
          active={isOrdersRoute}
          onPress={() => {
            if (!isOrdersRoute) router.replace('/orders');
          }}
        />

        <NavItem
          label="Account"
          image={require('../../assets/bottomNav/account-icon.png')}
          active={pathname === '/account'}
          onPress={() => {
            if (pathname !== '/account') router.replace('/account');
          }}
        />
      </View>
    </View>
  );
}
