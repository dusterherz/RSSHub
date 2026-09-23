import { config } from '@/config';
import { flaresolverrEndpoint, flaresolverrGet, flaresolverrGetJson } from '@/utils/flaresolverr';
import ofetch from '@/utils/ofetch';

// Patreon serves both its pages and its JSON API behind a Cloudflare managed challenge that no
// plain HTTP client passes. Relay through FlareSolverr when one is configured, and keep the
// direct request otherwise so deployments without it behave as they did before.
const sessionId = () => config.patreon?.sessionId;

const direct = (url: string) => ofetch(url, { headers: sessionId() ? { Cookie: `session_id=${sessionId()}` } : {} });

const cookies = () => (sessionId() ? [{ name: 'session_id', value: sessionId()! }] : undefined);

export const fetchPatreonPage = async (url: string): Promise<string> => (flaresolverrEndpoint() ? await flaresolverrGet(url, cookies()) : await direct(url));

export const fetchPatreonJson = async <T>(url: string): Promise<T> => (flaresolverrEndpoint() ? await flaresolverrGetJson<T>(url, cookies()) : ((await direct(url)) as T));
