import crypto from 'crypto';

export async function signAmazonRequest(
  payload: Record<string, any>,
  operation: 'SearchItems' | 'GetItems' = 'SearchItems'
): Promise<string> {
  const accessKey = process.env.AMAZON_ACCESS_KEY!;
  const secretKey = process.env.AMAZON_SECRET_KEY!;
  const region = process.env.AMAZON_REGION || 'us-east-1';
  const service = 'ProductAdvertisingAPI';
  const host = 'webservices.amazon.com';
  const path = operation === 'GetItems' ? '/paapi5/getitems' : '/paapi5/searchitems';
  const target = operation === 'GetItems'
    ? 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'
    : 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const body = JSON.stringify(payload);
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}`).join('\n') + '\n';
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
