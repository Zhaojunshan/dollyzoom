/**
 * Position size from values the user types.
 * There is no symbol table and no pip-size default, including for gold.
 * Lots are floored to the volume step so the estimated stop loss does not
 * exceed the risk amount because of rounding up.
 */

import { decimalRatio, parseUserNumber } from "./round.mjs";

function fail(errors) {
  return { ok: false, errors };
}

/**
 * @param {{ tickSize: string, tickValue: string, volumeStep: string, minLot: string, maxLot: string, stopDistance: string, riskAmount: string, accountCurrency: string }} input
 * @returns {{ ok: false, errors: string[] } | { ok: true, errors: [], accountCurrency: string, ticks: number, lossPerLot: number, rawLots: number, lots: number, belowMin: boolean, capped: boolean, estimatedLoss: number, unusedRisk: number }}
 */
export function calculatePositionSize(input) {
  const tickSize = parseUserNumber(input.tickSize);
  const tickValue = parseUserNumber(input.tickValue);
  const volumeStep = parseUserNumber(input.volumeStep);
  const minLot = parseUserNumber(input.minLot);
  const maxRaw = typeof input.maxLot === "string" ? input.maxLot.trim() : "";
  const maxLot = maxRaw === "" ? null : parseUserNumber(input.maxLot);
  const stopDistance = parseUserNumber(input.stopDistance);
  const riskAmount = parseUserNumber(input.riskAmount);
  const accountCurrency = typeof input.accountCurrency === "string" ? input.accountCurrency.trim().toUpperCase() : "";

  const errors = [];
  if (!(tickSize > 0)) errors.push("tickSize");
  if (!(tickValue > 0)) errors.push("tickValue");
  if (!(volumeStep > 0)) errors.push("volumeStep");
  if (!(minLot > 0)) errors.push("minLot");
  if (maxLot != null && !(maxLot > 0)) errors.push("maxLot");
  if (!(stopDistance > 0)) errors.push("stopDistance");
  if (!(riskAmount > 0)) errors.push("riskAmount");
  if (!/^[A-Z]{3}$/.test(accountCurrency)) errors.push("accountCurrency");
  if (errors.length) return fail(errors);

  const minSteps = decimalRatio(minLot, volumeStep);
  if (!Number.isFinite(minSteps) || Math.abs(minSteps - Math.round(minSteps)) > 1e-6) {
    return fail(["minLot-step"]);
  }
  if (maxLot != null) {
    const maxSteps = decimalRatio(maxLot, volumeStep);
    if (!Number.isFinite(maxSteps) || Math.abs(maxSteps - Math.round(maxSteps)) > 1e-6) {
      return fail(["maxLot-step"]);
    }
    if (maxLot + 1e-9 < minLot) return fail(["maxLot"]);
  }

  const ticks = decimalRatio(stopDistance, tickSize);
  const lossPerLot = ticks * tickValue;
  if (!(lossPerLot > 0) || !Number.isFinite(lossPerLot)) return fail(["lossPerLot"]);

  const rawLots = riskAmount / lossPerLot;
  const rawSteps = rawLots / volumeStep;
  let steps = Math.floor(rawSteps + 1e-8);
  if (steps < 0 || !Number.isFinite(steps)) steps = 0;
  let lots = Number((steps * volumeStep).toFixed(8));
  let capped = false;
  if (maxLot != null && lots - maxLot > 1e-9) {
    lots = Number(maxLot.toFixed(8));
    capped = true;
  }
  const belowMin = lots + 1e-9 < minLot;
  const tradableLots = belowMin ? 0 : lots;
  const estimatedLoss = belowMin ? 0 : Number((tradableLots * lossPerLot).toFixed(8));

  return {
    ok: true,
    errors: [],
    accountCurrency,
    ticks,
    lossPerLot,
    rawLots,
    lots: tradableLots,
    belowMin,
    capped,
    estimatedLoss,
    unusedRisk: Number((riskAmount - estimatedLoss).toFixed(8)),
  };
}
