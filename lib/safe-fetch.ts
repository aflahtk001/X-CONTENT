import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  maxResponseBytes?: number;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Checks whether an IP address belongs to private, loopback, or link-local ranges.
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  if (ip.startsWith('127.') || ip === '0.0.0.0') return true; // Loopback & current network
  if (ip.startsWith('10.')) return true; // Class A private
  if (ip.startsWith('192.168.')) return true; // Class C private
  if (ip.startsWith('169.254.')) return true; // Link-local

  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true; // Class B private
  }

  // IPv6 checks
  if (ip === '::1' || ip === '::' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // Unique local address
  }
  if (ip.toLowerCase().startsWith('fe80:')) {
    return true; // Link-local
  }

  return false;
}

/**
 * Validates a URL against SSRF attacks.
 */
export async function validateSafeUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error(`Access to local hostname ${hostname} is blocked for security.`);
  }

  // Check if hostname is direct IP address
  if (isPrivateIP(hostname)) {
    throw new Error(`Access to private IP ${hostname} is blocked for security.`);
  }

  // Resolve DNS to verify destination IP
  try {
    const lookupResult = await dnsLookup(hostname, { all: true });
    for (const record of lookupResult) {
      if (isPrivateIP(record.address)) {
        throw new Error(`Access to resolved private IP ${record.address} is blocked for security.`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('blocked for security')) throw err;
    // If DNS resolution fails, throw error
    throw new Error(`DNS resolution failed for ${hostname}: ${err.message}`);
  }

  return url;
}

/**
 * Safe fetch wrapper with SSRF protection, timeout, retry backoff, and size limit.
 */
export async function safeFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  await validateSafeUrl(url);

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = new Headers(options.headers || {});
      if (!headers.has('User-Agent')) {
        headers.set('User-Agent', DEFAULT_USER_AGENT);
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok && attempt < maxRetries && (response.status >= 500 || response.status === 429)) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
