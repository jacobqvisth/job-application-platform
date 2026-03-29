import { MARKETS } from './config';
export type { MarketConfig } from './config';

export const DEFAULT_MARKET = 'SE';

export function getMarketConfig(code: string) {
  return MARKETS.find((m) => m.code === code.toUpperCase());
}

export function getAllMarkets() {
  return MARKETS;
}

export function getSupportedMarketCodes() {
  return MARKETS.map((m) => m.code);
}
