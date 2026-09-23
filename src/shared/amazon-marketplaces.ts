/**
 * DataForSEO location/language pairs for the Amazon marketplaces the ASIN
 * Lookup feature supports. Amazon's ASIN endpoint requires a location_code
 * that maps to one specific marketplace domain, so this stays a fixed short
 * list rather than the generic SERP location picker other tools use.
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
};

export const AMAZON_MARKETPLACES: readonly AmazonMarketplace[] = [
  { code: "ES", label: "España (amazon.es)", locationCode: 2724, languageCode: "es" },
  {
    code: "US",
    label: "Estados Unidos (amazon.com)",
    locationCode: 2840,
    languageCode: "en",
  },
  {
    code: "UK",
    label: "Reino Unido (amazon.co.uk)",
    locationCode: 2826,
    languageCode: "en",
  },
  { code: "DE", label: "Alemania (amazon.de)", locationCode: 2276, languageCode: "de" },
  { code: "FR", label: "Francia (amazon.fr)", locationCode: 2250, languageCode: "fr" },
  { code: "IT", label: "Italia (amazon.it)", locationCode: 2380, languageCode: "it" },
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
