import assert from 'node:assert/strict';
import test from 'node:test';

import {submitPickupRequest} from './pickupSubmission.ts';

const payload = {
  addressId: 'home',
  items: [
    {wasteTypeId: 'chemical', bagSizeId: 'small', quantity: 1},
    {wasteTypeId: 'biodegradable', bagSizeId: 'large', quantity: 2},
  ],
  scheduledDate: '2030-06-15',
  scheduledTime: '10:30',
  notes: '',
};

function createQuote(quoteId, amountCentavos = 8000) {
  return {
    schemaVersion: 2,
    quoteType: 'initial_estimate',
    quoteId,
    amountCentavos,
    currency: 'PHP',
    breakdown: {
      distanceCentavos: null,
      totalCentavos: amountCentavos,
    },
    pricingSource: 'centralized-pricing',
    pricingVersion: 'pricing-v1',
    issuedAt: '2030-01-01T00:00:00.000Z',
    expiresAt: '2030-01-01T00:10:00.000Z',
  };
}

test('one submission action quotes, persists, then submits without quote review', async () => {
  const calls = [];
  const outcome = await submitPickupRequest(
    {id: 'submission-1', payload},
    {
      requestQuote: async (input) => {
        calls.push(['quote', input]);
        return createQuote('quote-1');
      },
      persistAttempt: async (attempt) => {
        calls.push(['persist', attempt]);
      },
      confirmQuote: async (input) => {
        calls.push(['submit', input]);
        return {
          success: true,
          pickupId: input.submissionId,
          facilityId: 'facility-1',
          facilityName: 'Facility',
          facilityAddress: 'Facility Road',
          acceptedAmountCentavos: input.acceptedAmountCentavos,
          currency: 'PHP',
          acceptedQuoteId: input.quoteId,
          acceptedPricingVersion: input.acceptedPricingVersion,
        };
      },
    },
  );

  assert.equal(outcome.kind, 'submitted');
  assert.deepEqual(calls.map(([name]) => name), [
    'quote',
    'persist',
    'submit',
  ]);
  assert.deepEqual(calls[0][1].items, payload.items);
  assert.deepEqual(calls[2][1].items, payload.items);
  assert.equal(calls[2][1].quoteId, 'quote-1');
  assert.equal(calls[2][1].acceptedAmountCentavos, 8000);
});

test('a changed server quote is retried internally without asking the customer to accept it', async () => {
  let submissions = 0;
  const persistedQuotes = [];
  const outcome = await submitPickupRequest(
    {id: 'submission-1', payload},
    {
      requestQuote: async () => createQuote('quote-1'),
      persistAttempt: async (attempt) => {
        persistedQuotes.push(attempt.quote.quoteId);
      },
      confirmQuote: async (input) => {
        submissions += 1;
        if (submissions === 1) {
          return {
            success: false,
            quoteChanged: true,
            revisedQuote: createQuote('quote-2', 9000),
          };
        }
        return {
          success: true,
          pickupId: input.submissionId,
          facilityId: 'facility-1',
          facilityName: 'Facility',
          facilityAddress: 'Facility Road',
          acceptedAmountCentavos: input.acceptedAmountCentavos,
          currency: 'PHP',
          acceptedQuoteId: input.quoteId,
          acceptedPricingVersion: input.acceptedPricingVersion,
        };
      },
    },
  );

  assert.equal(outcome.kind, 'submitted');
  assert.equal(submissions, 2);
  assert.deepEqual(persistedQuotes, ['quote-1', 'quote-2']);
  assert.equal(outcome.result.acceptedQuoteId, 'quote-2');
});

test('does not submit when the issued quote contains distance pricing', async () => {
  let submitted = false;
  await assert.rejects(
    submitPickupRequest(
      {id: 'submission-1', payload},
      {
        requestQuote: async () => ({
          ...createQuote('quote-1'),
          breakdown: {
            distanceCentavos: 1000,
            totalCentavos: 8000,
          },
        }),
        persistAttempt: async () => {},
        confirmQuote: async () => {
          submitted = true;
          throw new Error('Must not submit an invalid quote.');
        },
      },
    ),
    {name: 'InvalidPickupQuoteError'},
  );
  assert.equal(submitted, false);
});
