import { router } from 'expo-router';

export function goBackOrReplace(fallbackRoute: `/${string}`): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
