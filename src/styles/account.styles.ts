
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  refreshError: {
    color: '#A23B32',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: {
    color: '#38B84A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: '#173D2C',
    fontSize: 28,
    fontWeight: '800',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE8DE',
  },
  settingsIcon: {
    fontSize: 23,
    color: '#176744',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#176744',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    gap: 15,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#38B84A',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#E0F1E5',
    fontSize: 12,
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#173D2C',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    paddingHorizontal: 14,
    marginBottom: 26,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EDF7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconText: {
    fontSize: 19,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: '#173D2C',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuSubtitle: {
    color: '#64736A',
    fontSize: 11,
    lineHeight: 16,
  },
  chevron: {
    color: '#8A9B8F',
    fontSize: 26,
    marginLeft: 4,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#EDF1ED',
    marginLeft: 54,
  },
  logoutButton: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#F0D8D8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: '#C43D3D',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  footer: {
    color: '#849187',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },


menuIconImage: {
  width: 26,
  height: 26,
},
});
