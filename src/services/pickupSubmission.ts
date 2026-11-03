import type {
  PickupQuote,
  PickupQuoteInput,
  QuoteChangedResult,
  SubmitPickupInput,
  SubmittedPickup,
} from './pickups';

export type PersistedPickupQuote = Pick<
  PickupQuote,
  | 'schemaVersion'
  | 'quoteType'
  | 'quoteId'
  | 'amountCentavos'
  | 'currency'
  | 'breakdown'
  | 'pricingSource'
  | 'pricingVersion'
  | 'issuedAt'
  | 'expiresAt'
>;

export interface PendingPickupSubmission {
  id: string;
  payload: PickupQuoteInput;
  quote?: PersistedPickupQuote;
  trashPhotoPaths?: string[];
  trashPhotoUploadPending?: boolean;
  trashPhotoRecoveryBlocked?: boolean;
}

export interface PickupSubmissionDependencies {
  requestQuote: (payload: PickupQuoteInput) => Promise<PickupQuote>;
  confirmQuote: (
    input: SubmitPickupInput
  ) => Promise<SubmittedPickup | QuoteChangedResult>;
  uploadPhotos?: (
    attempt: PendingPickupSubmission,
  ) => Promise<void>;
  preparePhotoPaths?: (
    attempt: PendingPickupSubmission,
  ) => Promise<string[]>;
  persistAttempt: (attempt: PendingPickupSubmission) => Promise<void>;
}

export type PickupSubmissionOutcome =
  | {
      kind: 'submitted';
      result: SubmittedPickup;
      attempt: PendingPickupSubmission;
    }
  | {
      kind: 'quote_changed';
      attempt: PendingPickupSubmission;
    };

export class InvalidPickupQuoteError extends Error {
  constructor() {
    super(
      'Pricing could not be verified. Your pickup was not submitted. Please retry.',
    );
    this.name = 'InvalidPickupQuoteError';
  }
}

function isValidInitialQuote(
  quote: Pick<
    PickupQuote,
    'schemaVersion' | 'quoteType' | 'currency' | 'amountCentavos' | 'breakdown'
  >,
): boolean {
  return quote.schemaVersion === 2 &&
    quote.quoteType === 'initial_estimate' &&
    quote.currency === 'PHP' &&
    Number.isSafeInteger(quote.amountCentavos) &&
    quote.amountCentavos >= 0 &&
    quote.breakdown.distanceCentavos === null &&
    quote.breakdown.totalCentavos === quote.amountCentavos;
}

function snapshotQuote(
  quote: Pick<PickupQuote,
    'schemaVersion' | 'quoteType' | 'quoteId' | 'amountCentavos' |
    'currency' | 'breakdown' | 'pricingSource' | 'pricingVersion' |
    'issuedAt' | 'expiresAt'>,
): PersistedPickupQuote {
  return {
    schemaVersion: quote.schemaVersion,
    quoteType: quote.quoteType,
    quoteId: quote.quoteId,
    amountCentavos: quote.amountCentavos,
    currency: quote.currency,
    breakdown: quote.breakdown,
    pricingSource: quote.pricingSource,
    pricingVersion: quote.pricingVersion,
    issuedAt: quote.issuedAt,
    expiresAt: quote.expiresAt,
  };
}

export async function submitPickupRequest(
  initialAttempt: PendingPickupSubmission,
  dependencies: PickupSubmissionDependencies,
): Promise<PickupSubmissionOutcome> {
  let attempt = initialAttempt;

  for (let quoteRefresh = 0; quoteRefresh < 2; quoteRefresh += 1) {
    if (attempt.trashPhotoRecoveryBlocked) {
      throw new Error(
        'This pickup cannot be resumed safely. Contact support before continuing.',
      );
    }
    const quote = attempt.quote ?? await dependencies.requestQuote(
      attempt.payload,
    );
    if (!isValidInitialQuote(quote)) {
      throw new InvalidPickupQuoteError();
    }

    const persistedQuote = snapshotQuote(quote);
    attempt = {...attempt, quote: persistedQuote};
    await dependencies.persistAttempt(attempt);

    if (attempt.trashPhotoUploadPending) {
      if (!attempt.trashPhotoPaths?.length) {
        throw new Error(
          'This earlier photo upload has no saved paths and cannot be resumed safely. Contact support.',
        );
      }
      if (!dependencies.uploadPhotos) {
        throw new Error('Reselect the saved photos to resume this pickup.');
      }
      await dependencies.uploadPhotos(attempt);
      attempt = {...attempt, trashPhotoUploadPending: false};
      await dependencies.persistAttempt(attempt);
    } else if (dependencies.uploadPhotos && !attempt.trashPhotoPaths?.length) {
      if (!dependencies.preparePhotoPaths) {
        throw new Error('Photo upload paths could not be prepared safely.');
      }
      const trashPhotoPaths = await dependencies.preparePhotoPaths(attempt);
      if (trashPhotoPaths.length > 0) {
        attempt = {
          ...attempt,
          trashPhotoPaths,
          trashPhotoUploadPending: true,
        };
        await dependencies.persistAttempt(attempt);
        await dependencies.uploadPhotos(attempt);
        attempt = {...attempt, trashPhotoUploadPending: false};
        await dependencies.persistAttempt(attempt);
      }
    }

    const result = await dependencies.confirmQuote({
      ...attempt.payload,
      submissionId: attempt.id,
      quoteId: persistedQuote.quoteId,
      acceptedAmountCentavos: persistedQuote.amountCentavos,
      acceptedPricingVersion: persistedQuote.pricingVersion,
      ...(attempt.trashPhotoPaths?.length
        ? {trashPhotoPaths: attempt.trashPhotoPaths}
        : {}),
    });

    if ('quoteChanged' in result) {
      if (!isValidInitialQuote(result.revisedQuote)) {
        throw new InvalidPickupQuoteError();
      }
      attempt = {
        ...attempt,
        quote: snapshotQuote(result.revisedQuote),
      };
      if (quoteRefresh === 0) continue;
      await dependencies.persistAttempt(attempt);
      return {kind: 'quote_changed', attempt};
    }

    return {kind: 'submitted', result, attempt};
  }

  return {kind: 'quote_changed', attempt};
}
