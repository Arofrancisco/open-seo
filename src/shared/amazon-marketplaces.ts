/**
 * DataForSEO location/language/domain triples for the Amazon marketplaces the
 * ASIN Lookup feature supports. The Merchant API wants locale-style language
 * codes ("es_ES", not "es") and se_domain pins the exact storefront.
 */
export const AMAZON_MARKETPLACE_CODES = [
  "ES",
  "US",
  "UK",
  "DE",
  "FR",
  "IT",
] as const;

export type AmazonMarketplaceCode = (typeof AMAZON_MARKETPLACE_CODES)[number];

export type AmazonMarketplace = {
  code: AmazonMarketplaceCode;
  label: string;
  locationCode: number;
  languageCode: string;
  seDomain: string;
};

export const AMAZON_MARKETPLACES: readonly AmazonMarketplace[] = [
  {
    code: "ES",
    label: "España (amazon.es)",
    locationCode: 2724,
    languageCode: "es_ES",
    seDomain: "amazon.es",
  },
  {
    code: "US",
    label: "Estados Unidos (amazon.com)",
    locationCode: 2840,
    languageCode: "en_US",
    seDomain: "amazon.com",
  },
  {
    code: "UK",
    label: "Reino Unido (amazon.co.uk)",
    locationCode: 2826,
    languageCode: "en_GB",
    seDomain: "amazon.co.uk",
  },
  {
    code: "DE",
    label: "Alemania (amazon.de)",
    locationCode: 2276,
    languageCode: "de_DE",
    seDomain: "amazon.de",
  },
  {
    code: "FR",
    label: "Francia (amazon.fr)",
    locationCode: 2250,
    languageCode: "fr_FR",
    seDomain: "amazon.fr",
  },
  {
    code: "IT",
    label: "Italia (amazon.it)",
    locationCode: 2380,
    languageCode: "it_IT",
    seDomain: "amazon.it",
  },
];

export const DEFAULT_AMAZON_MARKETPLACE_CODE: AmazonMarketplaceCode = "ES";

export function getAmazonMarketplace(
  code: AmazonMarketplaceCode,
): AmazonMarketplace {
  return (
    AMAZON_MARKETPLACES.find((marketplace) => marketplace.code === code) ??
    AMAZON_MARKETPLACES[0]
  );
}
