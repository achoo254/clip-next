import { defineBrand } from '@achoo254/brand';
import config from '../../../brand.config.json';

/** The product's brand (name, domain) from brand.config.json: never write the product name in code. */
export const brand = defineBrand(config);

/** The ecosystem's home page, linked from the footer. */
export const HOME_URL = `https://${brand.primaryTenant.domain}`;

/** Where an account is deleted: only at the account service, which then tells every app to delete its data. */
export const ACCOUNT_DELETE_URL = `https://auth.${brand.primaryTenant.domain}/account#account-delete`;
