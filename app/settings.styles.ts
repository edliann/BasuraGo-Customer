
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    padding: 22,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 20,
  },
  backText: {
    color: '#176744',
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: '#173D2C',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64736A',
    fontSize: 14,
    marginTop: 7,
    marginBottom: 25,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    marginBottom: 28,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EC',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#176744',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#173D2C',
  },
  email: {
    fontSize: 12,
    color: '#64736A',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#173D2C',
    marginBottom: 12,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DCE8DE',
  },
  optionRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 32,
    fontSize: 22,
    color: '#176744',
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#173D2C',
  },
  chevron: {
    fontSize: 25,
    color: '#8B9690',
  },
  separator: {
    height: 1,
    backgroundColor: '#E7EEE9',
  },
  logoutButton: {
    minHeight: 52,
    marginTop: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C94D4D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoutText: {
    color: '#B42323',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    color: '#8B9690',
    marginTop: 30,
    fontSize: 12,
  },
});

export default styles;
