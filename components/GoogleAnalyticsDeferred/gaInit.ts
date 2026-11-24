/**
 * Where a visit is from, as far as analytics is told: no finer than the
 * city. The visitor's IP address, coordinates and postcode never leave the
 * server (app/api/geo)
 */
export interface VisitorGeo {
  country?: string;
  region?: string;
  city?: string;
  flag?: string;
}

/**
 * A value as a literal in an inline script: JSON, so a quote in it (a city
 * such as Bishop's Stortford) can't end the string early, with `<` escaped
 * so nothing in it can close the script element
 */
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** The inline script that starts gtag and tells it where the visit is from */
export const gaInit = (gaId: string, geo: VisitorGeo) => `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${literal(gaId)});
  gtag('set', 'user_properties', ${literal({
    country: geo.country || '',
    region: geo.region || '',
    city: geo.city || '',
    flag: geo.flag || '',
  })});
`;
