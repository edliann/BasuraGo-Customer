import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';

interface SmsConsentEvents {
  onOtpReceived(event: {code: string}): void;
  onConsentDismissed(event: Record<string, never>): void;
  onSmsConsentError(event: {message: string}): void;
}

interface SmsConsentModule {
  start(): Promise<void>;
  stop(): void;
  addListener<EventName extends keyof SmsConsentEvents>(
    eventName: EventName,
    listener: SmsConsentEvents[EventName],
  ): {remove(): void};
}

function getModule(): SmsConsentModule | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<SmsConsentModule>('SmsUserConsent');
}

export function addSmsOtpListener(
  listener: (code: string) => void,
): {remove(): void} | null {
  const module = getModule();
  return module?.addListener('onOtpReceived', ({code}) => {
    if (/^\d{6}$/.test(code)) listener(code);
  }) ?? null;
}

export function addSmsConsentErrorListener(
  listener: () => void,
): {remove(): void} | null {
  const module = getModule();
  return module?.addListener('onSmsConsentError', listener) ?? null;
}

export async function startSmsUserConsent(): Promise<boolean> {
  const module = getModule();
  if (!module) return false;
  await module.start();
  return true;
}

export function stopSmsUserConsent(): void {
  getModule()?.stop();
}
