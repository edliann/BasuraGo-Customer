import { StyleSheet } from 'react-native';

const colors = {
  primary: '#176744',
  primaryDark: '#124D33',
  accent: '#38B84A',
  background: '#F5F8F6',
  white: '#FFFFFF',
  text: '#173D2C',
  secondaryText: '#64736A',
  muted: '#8B9690',
  border: '#DCE8DE',
  paleGreen: '#E8F5EC',
  mint: '#EFF8F1',
  paleYellow: '#FFF5DF',
  yellow: '#A56500',
};

const styles = StyleSheet.create({
bottomNavContainer: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  paddingHorizontal: 18,
  paddingTop: 32,
  paddingBottom: 8,
  backgroundColor: 'transparent',
},

bottomNav: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-around',
  backgroundColor: 'rgba(255, 255, 255, 0.94)',
  borderRadius: 26,
  borderWidth: 1,
  borderColor: 'rgba(220, 232, 222, 0.75)',
  paddingVertical: 9,
  paddingHorizontal: 8,
  shadowColor: '#173D2C',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.10,
  shadowRadius: 14,
  elevation: 8,
},

navItem: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  minHeight: 52,
  borderRadius: 16,
},

navIconWrap: {
  width: 35,
  height: 30,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
},

navIconWrapActive: {
  backgroundColor: '#E8F5EC',
},

navImage: {
  width: 24,
  height: 24,
},

navImageInactive: {
  opacity: 0.58,
},

navSymbol: {
  color: '#8B9690',
  fontSize: 25,
  fontWeight: '600',
},

navSymbolActive: {
  color: '#176744',
},

navLabel: {
  color: '#64736A',
  fontSize: 11,
  fontWeight: '500',
},

navLabelActive: {
  color: '#176744',
  fontWeight: '800',
},

navFeather: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  height: 110,
},

pressed: {
  opacity: 0.75,
},
});

export default styles;
