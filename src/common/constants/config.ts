import * as dotenv from 'dotenv';

dotenv.config();

export const DOMAIN_BACKEND =
  process.env.DOMAIN_BACKEND ?? 'https://api.tidebit-defi.com';
export const apiV1 = '/api/v1';
export const apiV2 = '/api/v2';
export const SERVICE_TERM_TITLE = 'ServiceTerm';
export const DOMAIN = 'https://tidebit-defi.com';
export const TERM_OF_SERVICE = `${DOMAIN}{hash}`;
export const PRIVATE_POLICY = `${DOMAIN}{hash}`;
export const DeWT_VALIDITY_PERIOD = 60 * 60 * 24; // seconds
export const LIQUIDATION_FIVE_LEVERAGE = 0.2;
