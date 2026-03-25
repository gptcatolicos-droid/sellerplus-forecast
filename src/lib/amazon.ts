/**
 * AMAZON PA API — Product Advertising API 5.0
 * Búsqueda de productos con firma AWS Signature V4
 */
import crypto from 'crypto';
import { applyMargin } from './catalog-rules';

const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com';
const PATH = '/paapi5/searchitems';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG!;
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY!;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY!;

// AWS Signature V4
function sign(key: Buffer, msg: string) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function getSignatureKey(key: string, date: string, region: string, service: string) {
  const kDate    = sign(Buffer.from('AWS4' + key), date);
  const kRegion  = sign(kDate, region);
  const kService = sign(kRegion, service);
  const kSigning = sign(kService, 'aws4_request');
  return kSigning;
}

export interface AmazonProduct {
  asin: string;
  title: string;
  price_usd: number;
  price_display: string;
  image: string;
  url: string;
  affiliate_url: string;
  supplier: 'amazon';
  model: 'affiliate';
  delivery_days: string;
}

export async function searchAmazon(query: string, limit = 4): Promise<AmazonProduct[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    console.warn('Amazon PA API credentials not set');
    return [];
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payload = JSON.stringify({
    Keywords: query,
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Images.Primary.Large',
    ],
    SearchIndex: 'Books',
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    ItemCount: limit,
  });

  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${HOST}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${PATH}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${REGION}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(SECRET_KEY, dateStamp, REGION, 'ProductAdvertisingAPI');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${HOST}${PATH}`, {
      method: 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        'host': HOST,
        'x-amz-date': amzDate,
        'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        'Authorization': authHeader,
      },
      body: payload,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Amazon PA API error:', err);
      return [];
    }

    const data = await res.json();
    const items = data?.SearchResult?.Items || [];

    return items.map((item: any) => {
      const price = item?.Offers?.Listings?.[0]?.Price?.Amount || 0;
      const asin = item?.ASIN || '';
      const affiliateUrl = `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}`;
      return {
        asin,
        title: item?.ItemInfo?.Title?.DisplayValue || 'Sin título',
        price_usd: price,
        price_display: `$${price.toFixed(2)}`,
        image: item?.Images?.Primary?.Large?.URL || '',
        url: item?.DetailPageURL || affiliateUrl,
        affiliate_url: affiliateUrl,
        supplier: 'amazon' as const,
        model: 'affiliate' as const,
        delivery_days: '8–15',
      };
    });
  } catch (err) {
    console.error('Amazon search error:', err);
    return [];
  }
}
