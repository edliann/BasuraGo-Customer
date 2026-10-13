
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    padding: 22,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64736A',
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#38B84A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: '#173D2C',
    fontSize: 29,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64736A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 26,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    padding: 20,
  },
  label: {
    color: '#173D2C',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    backgroundColor: '#FAFCFA',
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#173D2C',
    fontSize: 15,
    marginBottom: 20,
  },
  helper: {
    color: '#64736A',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -10,
    marginBottom: 22,
  },
  saveButton: {
    backgroundColor: '#176744',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#64736A',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.55,
  },
});
