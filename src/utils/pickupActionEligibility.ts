export interface PickupActionEligibility {
  canCancelRequest: boolean;
  canReviewFinalPrice: boolean;
}

export function getPickupActionEligibility(
  status: string,
  pricingStage: string | null,
  acceptedAmountCentavos: number | null,
  hasHistoryRecord: boolean,
): PickupActionEligibility {
  const canCancelRequest = status === 'pending' ||
    (
      status === 'accepted' &&
      (
        pricingStage === 'awaiting_final_price' ||
        pricingStage === 'awaiting_customer_confirmation'
      )
    );
  const canReviewFinalPrice =
    (status === 'pending' || status === 'accepted') &&
    hasHistoryRecord &&
    acceptedAmountCentavos === null &&
    (
      pricingStage === 'awaiting_final_price' ||
      pricingStage === 'awaiting_customer_confirmation' ||
      status === 'accepted'
    );

  return {canCancelRequest, canReviewFinalPrice};
}
