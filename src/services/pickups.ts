import {
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import {
  collection,
  getDocs,
} from 'firebase/firestore';

import app, { firestore } from '@/services/firebase';

const functions = getFunctions(app, 'us-central1');

export interface SubmitPickupInput {
  submissionId: string;
  addressId: string;
  wasteTypeId: string;
  estimatedWeight: number;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
}

export interface SubmittedPickup {
  success: true;
  pickupId: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
}

export interface SavedPickupAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface ActiveWasteType {
  id: string;
  name: string;
  description: string;
}

const submitPickupCallable = httpsCallable<
  SubmitPickupInput,
  SubmittedPickup
>(functions, 'submitPickupFunction');

const listActiveWasteTypesCallable = httpsCallable<
  Record<string, never>,
  { wasteTypes: ActiveWasteType[] }
>(functions, 'listActiveWasteTypesFunction');

export async function getSavedPickupAddresses(
  customerId: string,
): Promise<SavedPickupAddress[]> {
  const addressesRef = collection(
    firestore,
    'customers',
    customerId,
    'addresses',
  );
  const snapshot = await getDocs(addressesRef);
  return snapshot.docs.flatMap((addressDoc) => {
    const data = addressDoc.data();
    if (
      typeof data.address !== 'string' ||
      !data.address.trim()
    ) {
      return [];
    }
    return [{
      id: addressDoc.id,
      label: typeof data.label === 'string' ? data.label : '',
      address: data.address.trim(),
      isDefault: data.isDefault === true,
    }];
  });
}

export async function getActivePickupWasteTypes(): Promise<
  ActiveWasteType[]
> {
  const result = await listActiveWasteTypesCallable({});
  return result.data.wasteTypes;
}

export async function submitPickup(
  input: SubmitPickupInput,
): Promise<SubmittedPickup> {
  const result = await submitPickupCallable(input);
  return result.data;
}
