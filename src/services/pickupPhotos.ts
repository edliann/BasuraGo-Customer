import { firebaseAuth } from '@/services/firebase';
import { supabase } from '@/services/supabase';
import { File as ExpoFile, Paths } from 'expo-file-system';

const PICKUP_TRASH_PHOTOS_BUCKET = 'pickup-trash-photos';
const MAX_PICKUP_TRASH_PHOTOS = 5;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const PHOTO_FORMATS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface PreparedPhoto {
  file: ExpoFile;
  contentType: string;
  extension: string;
}

export interface PickupPhotoSelection {
  uri: string;
  mimeType?: string | null;
}

export class PickupPhotoPathConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PickupPhotoPathConflictError';
  }
}

export class PickupPhotoRecoveryBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PickupPhotoRecoveryBlockedError';
  }
}

function isSafePathSegment(value: string): boolean {
  return value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    !/[\\/]/.test(value) &&
    value !== '.' &&
    value !== '..';
}

function createUniqueFilename(extension: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 14);
  return `${timestamp}-${randomPart}.${extension}`;
}

async function preparePhoto(
  photo: PickupPhotoSelection,
  index: number,
): Promise<PreparedPhoto> {
  const {uri} = photo;
  const localFile = new ExpoFile(uri);
  let bytes: Uint8Array;
  try {
    bytes = await localFile.bytes();
  } catch {
    throw new Error(`Could not read trash photo ${index + 1}.`);
  }

  const contentType = detectImageMimeType(bytes);

  const extension = PHOTO_FORMATS[contentType];

  if (!extension) {
    throw new Error(
      `Trash photo ${index + 1} is not a supported image. Select a JPEG, PNG, or WebP photo.`,
    );
  }
  if (!Number.isFinite(bytes.byteLength) || bytes.byteLength <= 0) {
    throw new Error(`Could not determine the size of trash photo ${index + 1}.`);
  }
  if (bytes.byteLength > MAX_PHOTO_SIZE_BYTES) {
    throw new Error(`Trash photo ${index + 1} exceeds the 5 MB limit.`);
  }

  return {file: localFile, contentType, extension};
}

function detectImageMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return '';
}

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

async function getUploadFile(
  file: ExpoFile,
  contentType: string,
  extension: string,
): Promise<{file: ExpoFile; isTemporary: boolean}> {
  if (normalizeMimeType(file.type) === contentType) {
    return {file, isTemporary: false};
  }

  const uploadFile = new ExpoFile(
    Paths.cache,
    `pickup-${createUniqueFilename(extension)}`,
  );
  try {
    await file.copy(uploadFile);
  } catch {
    throw new Error('Could not prepare the trash photo for upload.');
  }

  if (normalizeMimeType(uploadFile.type) !== contentType) {
    uploadFile.delete();
    throw new Error('Could not verify the trash photo format for upload.');
  }

  return {file: uploadFile, isTemporary: true};
}

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(
      /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
      '[REDACTED]',
    )
    .slice(0, 160);
}

function getStorageDiagnosticDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) return {};

  const details: {
    httpStatus?: number;
    statusCode?: string;
    serviceErrorCode?: string;
    networkOriginalErrorMessage?: string;
  } = {};

  if ('status' in error && typeof error.status === 'number') {
    details.httpStatus = error.status;
  }
  if ('statusCode' in error && typeof error.statusCode === 'string') {
    details.statusCode = sanitizeDiagnosticText(error.statusCode);
  }
  if ('code' in error && typeof error.code === 'string') {
    details.serviceErrorCode = sanitizeDiagnosticText(error.code);
  }
  if (
    'originalError' in error &&
    typeof error.originalError === 'object' &&
    error.originalError !== null &&
    'message' in error.originalError &&
    typeof error.originalError.message === 'string'
  ) {
    details.networkOriginalErrorMessage = sanitizeDiagnosticText(
      error.originalError.message,
    );
  }

  return details;
}

function logStorageDiagnostic(
  phase: 'upload' | 'download',
  photoNumber: number,
  error: unknown,
): void {
  console.error('[Pickup photo storage diagnostic]', {
    phase,
    photoNumber,
    ...getStorageDiagnosticDetails(error),
  });
}

export async function uploadPickupTrashPhotos(
  customerUid: string,
  pickupId: string,
  photos: PickupPhotoSelection[],
  photoPaths: string[],
): Promise<string[]> {
  if (!isSafePathSegment(customerUid) || !isSafePathSegment(pickupId)) {
    throw new Error('A valid customer UID and pickup ID are required.');
  }

  const currentUser = firebaseAuth.currentUser;
  if (!currentUser || currentUser.uid !== customerUid) {
    throw new Error('Only the signed-in customer can upload these photos.');
  }

  if (!Array.isArray(photos) || photos.length > MAX_PICKUP_TRASH_PHOTOS) {
    throw new Error('A pickup can include at most five trash photos.');
  }
  if (photos.some((photo) => !photo.uri.trim())) {
    throw new Error('Each trash photo must have a valid local URI.');
  }
  if (photos.length === 0) return [];

  let tokenClaims: Awaited<ReturnType<typeof currentUser.getIdTokenResult>>['claims'];
  try {
    tokenClaims = (await currentUser.getIdTokenResult(true)).claims;
  } catch {
    throw new PickupPhotoRecoveryBlockedError(
      'Could not refresh the signed-in account for private photo upload. Contact support before continuing.',
    );
  }

  const projectId = firebaseAuth.app.options.projectId;
  if (
    tokenClaims.sub !== customerUid ||
    tokenClaims.aud !== projectId ||
    tokenClaims.iss !== `https://securetoken.google.com/${projectId}`
  ) {
    throw new PickupPhotoRecoveryBlockedError(
      'The signed-in account does not match this photo upload. Contact support before continuing.',
    );
  }
  if (tokenClaims.role !== 'authenticated') {
    throw new PickupPhotoRecoveryBlockedError(
      'This account is not enabled for private photo uploads. Contact support before continuing.',
    );
  }

  if (
    photoPaths.length !== photos.length ||
    new Set(photoPaths).size !== photoPaths.length
  ) {
    throw new Error('Reselect the original number of photos to resume this upload.');
  }

  const uploadedPaths: string[] = [];
  try {
    for (let index = 0; index < photos.length; index += 1) {
      const {file, contentType, extension} = await preparePhoto(
        photos[index],
        index,
      );
      const {file: uploadFile, isTemporary} = await getUploadFile(
        file,
        contentType,
        extension,
      );
      const filePath = photoPaths[index];
      if (!isExpectedPhotoPath(filePath, customerUid, pickupId, extension)) {
        if (isTemporary) uploadFile.delete();
        throw new Error(
          `Trash photo ${index + 1} does not match its saved upload path.`,
        );
      }
      try {
        const requestUser = firebaseAuth.currentUser;
        if (!requestUser) {
          throw new PickupPhotoRecoveryBlockedError(
            'The signed-in account changed before photo upload. Contact support before continuing.',
          );
        }
        let requestClaims: Awaited<
          ReturnType<typeof requestUser.getIdTokenResult>
        >['claims'];
        try {
          requestClaims = (await requestUser.getIdTokenResult()).claims;
        } catch {
          throw new PickupPhotoRecoveryBlockedError(
            'Could not verify the signed-in account immediately before photo upload.',
          );
        }
        const requestProjectId = firebaseAuth.app.options.projectId;
        const pathSubjectMatches =
          filePath.split('/')[0] === requestClaims.sub;
        const roleIsAuthenticated =
          requestClaims.role === 'authenticated';
        const issuerMatchesProject =
          requestClaims.aud === requestProjectId &&
          requestClaims.iss ===
            `https://securetoken.google.com/${requestProjectId}`;

        if (__DEV__) {
          console.info('[Pickup photo Storage RLS diagnostic]', {
            bucketMatchesPolicy: PICKUP_TRASH_PHOTOS_BUCKET ===
              'pickup-trash-photos',
            pathSubjectMatches,
            roleIsAuthenticated,
            issuerMatchesProject,
            currentUserMatchesCustomer:
              requestUser.uid === customerUid,
          });
        }

        if (
          !pathSubjectMatches ||
          !roleIsAuthenticated ||
          !issuerMatchesProject ||
          requestUser.uid !== customerUid
        ) {
          throw new PickupPhotoRecoveryBlockedError(
            'The signed-in account does not satisfy private photo upload requirements. Contact support before continuing.',
          );
        }

        const {error} = await supabase.storage
          .from(PICKUP_TRASH_PHOTOS_BUCKET)
          .upload(filePath, uploadFile, {
            contentType,
            upsert: false,
          });

        if (error) {
          logStorageDiagnostic('upload', index + 1, error);
          const {data: existingFile, error: downloadError} = await supabase.storage
            .from(PICKUP_TRASH_PHOTOS_BUCKET)
            .download(filePath);
          if (downloadError) {
            logStorageDiagnostic('download', index + 1, downloadError);
          }
          if (downloadError || !existingFile) {
            if (isStorageAuthorizationError(downloadError)) {
              throw new PickupPhotoRecoveryBlockedError(
                'The saved photo path cannot be verified with current storage access. Contact support before continuing.',
              );
            }
            throw new Error(
              `The status of trash photo ${index + 1} could not be verified. ` +
                'Retry this same pickup with the same photos.',
            );
          }
          if (!(await blobsMatch(file, existingFile))) {
            throw new PickupPhotoPathConflictError(
              `A different photo already exists at the saved path for photo ${index + 1}. ` +
                'Contact support before continuing.',
            );
          }
        }
        uploadedPaths.push(filePath);
      } finally {
        if (isTemporary) uploadFile.delete();
      }
    }

    return uploadedPaths;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Trash photo upload failed.');
  }
}

function isStorageAuthorizationError(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('statusCode' in error) ||
    typeof error.statusCode !== 'string'
  ) {
    return false;
  }
  return ['401', '403', 'Unauthorized', 'AccessDenied'].includes(
    error.statusCode,
  );
}

export async function preparePickupTrashPhotoPaths(
  customerUid: string,
  pickupId: string,
  photos: PickupPhotoSelection[],
): Promise<string[]> {
  if (!isSafePathSegment(customerUid) || !isSafePathSegment(pickupId)) {
    throw new Error('A valid customer UID and pickup ID are required.');
  }
  if (photos.length > MAX_PICKUP_TRASH_PHOTOS) {
    throw new Error('A pickup can include at most five trash photos.');
  }

  const prepared = await Promise.all(
    photos.map((photo, index) => preparePhoto(photo, index)),
  );
  return prepared.map(({extension}) =>
    `${customerUid}/${pickupId}/${createUniqueFilename(extension)}`
  );
}

function isExpectedPhotoPath(
  path: string,
  customerUid: string,
  pickupId: string,
  extension: string,
): boolean {
  const segments = path.split('/');
  return segments.length === 3 &&
    segments[0] === customerUid &&
    segments[1] === pickupId &&
    new RegExp(`^[a-z0-9][a-z0-9_-]*\\.${extension}$`).test(segments[2]);
}

async function blobsMatch(first: Blob, second: Blob): Promise<boolean> {
  if (first.size !== second.size) return false;
  const [firstBytes, secondBytes] = await Promise.all([
    first.arrayBuffer(),
    second.arrayBuffer(),
  ]);
  const firstView = new Uint8Array(firstBytes);
  const secondView = new Uint8Array(secondBytes);
  return firstView.every((value, index) => value === secondView[index]);
}
