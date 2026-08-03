import { assertSafeNonNegativeInteger } from "./money";

export type AvailableLot = {
  lotId: string;
  acquiredSequence: number;
  remainingQuantity: number;
};

export type LotAllocation = {
  lotId: string;
  quantity: number;
};

export type LotAllocationResult = {
  allocations: LotAllocation[];
  allocatedQuantity: number;
};

export function allocateLotsFifo(
  lots: AvailableLot[],
  quantity: number,
): LotAllocationResult {
  const requestedQuantity = validateRequestedQuantity(quantity);
  const sortedLots = lots
    .map((lot, index) => ({ ...validateLot(lot), index }))
    .sort(
      (left, right) =>
        left.acquiredSequence - right.acquiredSequence || left.index - right.index,
    );
  const allocations: LotAllocation[] = [];
  let remainingToAllocate = requestedQuantity;

  for (const lot of sortedLots) {
    if (lot.remainingQuantity === 0 || remainingToAllocate === 0) {
      continue;
    }

    const allocatedQuantity = Math.min(
      remainingToAllocate,
      lot.remainingQuantity,
    );
    allocations.push({
      lotId: lot.lotId,
      quantity: allocatedQuantity,
    });
    remainingToAllocate -= allocatedQuantity;
  }

  if (remainingToAllocate !== 0) {
    throw new Error("INSUFFICIENT_SELLABLE_LOTS");
  }

  return {
    allocations,
    allocatedQuantity: requestedQuantity,
  };
}

function validateRequestedQuantity(quantity: number): number {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "SELL_QUANTITY_INVALID",
  );

  if (validQuantity === 0) {
    throw new Error("SELL_QUANTITY_INVALID");
  }

  return validQuantity;
}

function validateLot(lot: AvailableLot): AvailableLot {
  if (typeof lot.lotId !== "string" || lot.lotId.trim().length === 0) {
    throw new Error("LOT_ID_INVALID");
  }

  return {
    lotId: lot.lotId,
    acquiredSequence: assertSafeNonNegativeInteger(
      lot.acquiredSequence,
      "LOT_SEQUENCE_INVALID",
    ),
    remainingQuantity: assertSafeNonNegativeInteger(
      lot.remainingQuantity,
      "LOT_REMAINING_QUANTITY_INVALID",
    ),
  };
}
