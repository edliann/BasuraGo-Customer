
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
  // Brand header
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  logoMark: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoIcon: {
    fontSize: 27,
    color: colors.primary,
  },

  brandText: {
    flex: 1,
  },

  brandName: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  brandTagline: {
    color: '#D9F1E0',
    fontSize: 11,
    marginTop: 2,
  },

  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerActionText: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '600',
  },

  greeting: {
    marginTop: 30,
    marginBottom: 23,
  },

  greetingEyebrow: {
    color: '#BCE8C8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  greetingTitle: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  greetingSubtitle: {
    color: '#E1F1E7',
    fontSize: 14,
    marginTop: 7,
    lineHeight: 21,
  },

  // Pickup location
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 14,
    gap: 12,
  },

  locationIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationEmoji: {
    color: colors.primary,
    fontSize: 27,
    fontWeight: '600',
  },

  locationContent: {
    flex: 1,
  },

  locationLabel: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },

  locationTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  locationHint: {
    color: colors.secondaryText,
    fontSize: 11,
    marginTop: 4,
  },

  chevron: {
    color: colors.primary,
    fontSize: 27,
    marginLeft: 2,
  },

  // Main content
  body: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 27,
  },

  // Primary pickup card
  heroCard: {
    backgroundColor: colors.paleGreen,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D4EAD9',
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },

  heroCopy: {
    flex: 1,
  },

  heroEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 9,
  },

  heroTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 29,
  },

  heroDescription: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  truckIllustration: {
    width: 67,
    height: 67,
    borderRadius: 22,
    backgroundColor: '#D2EEDF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  truckEmoji: {
    fontSize: 34,
  },

  primaryButton: {
    minHeight: 54,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  primaryButtonArrow: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '600',
  },

  pressed: {
    opacity: 0.78,
  },

  // Section headings
  section: {
    gap: 7,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -1,
    marginBottom: 9,
  },

  // Quick access cards
  quickGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  quickCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    paddingHorizontal: 6,
    alignItems: 'center',
  },

  quickIconGreen: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  quickIconMint: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#EAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  quickIconYellow: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: colors.paleYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  quickEmoji: {
    fontSize: 25,
    color: colors.primary,
    fontWeight: '700',
  },

  quickTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  quickDescription: {
    color: colors.secondaryText,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 5,
  },

  // Upcoming pickup
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },

  liveLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 19,
    paddingVertical: 23,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyEmoji: {
    fontSize: 30,
    color: colors.primary,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyDescription: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Environmental message
  ecoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.mint,
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },

  ecoIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#D8EFDF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ecoEmoji: {
    color: colors.primary,
    fontSize: 26,
  },

  ecoCopy: {
    flex: 1,
  },

  ecoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },

  ecoDescription: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  footer: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: -9,
  },

safeArea: {
  flex: 1,
  backgroundColor: '#176744',
},

container: {
  flex: 1,
  backgroundColor: '#F5F8F6',
},


scrollContent: {
  flexGrow: 1,
  paddingBottom: 120,
},

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

brandLogo: {
  width: 245,
  height: 76,
  flexShrink: 1,
},

});

export default styles;
