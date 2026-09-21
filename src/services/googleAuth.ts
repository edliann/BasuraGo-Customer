import {
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';

import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

import { provisionCustomer } from '@/services/customerAuth';
import { firebaseAuth } from '@/services/firebase';

GoogleOneTapSignIn.configure({
  webClientId: 'autoDetect',
});

export async function signInWithGoogle() {
  console.time('Google Sign-In TOTAL');

  console.time('Google Play Services');
  await GoogleOneTapSignIn.checkPlayServices();
  console.timeEnd('Google Play Services');

  console.time('Google Account Picker');
  const response =
    await GoogleOneTapSignIn.createAccount();
  console.timeEnd('Google Account Picker');

  if (isCancelledResponse(response)) {
    console.timeEnd('Google Sign-In TOTAL');
    return null;
  }

  if (!isSuccessResponse(response)) {
    console.timeEnd('Google Sign-In TOTAL');
    return null;
  }

  const { idToken } = response.data;

  if (!idToken) {
    console.timeEnd('Google Sign-In TOTAL');

    throw new Error(
      'Google did not return an ID token.',
    );
  }

  console.time('Firebase Authentication');

  const credential =
    GoogleAuthProvider.credential(idToken);

  const userCredential =
    await signInWithCredential(
      firebaseAuth,
      credential,
    );

  console.timeEnd('Firebase Authentication');

  console.time('Customer Provisioning');

  await provisionCustomer(
    userCredential.user,
  );

  console.timeEnd('Customer Provisioning');

  console.timeEnd('Google Sign-In TOTAL');

  return userCredential.user;
}