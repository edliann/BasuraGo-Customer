import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { firebaseConfig } from '@/config/env';

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (
      storage: typeof AsyncStorage
    ) => Persistence;
  }
).getReactNativePersistence;

export const firebaseAuth = (() => {
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return FirebaseAuth.getAuth(app);
  }
})();

export const firestore = getFirestore(app);
export const firebaseStorage = getStorage(app);

export default app;