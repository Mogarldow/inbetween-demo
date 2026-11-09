// Jednoduchá pojistka na straně serveru. Hlavní detekci dělá model (značka [KRIZE]),
// tohle zachytí jasné formulace, i kdyby model selhal nebo byl nedostupný.
export const RISK_PATTERN =
  /(sebevra|zabít se|zabiju se|nechci (už )?žít|ublížit si|ubližuju si|řezat se|řežu se|skončit se životem|nemá cenu žít|předávkov)/i;

export const CRISIS_TAG = "[KRIZE]";

export function isRisky(text: string) {
  return RISK_PATTERN.test(text);
}
