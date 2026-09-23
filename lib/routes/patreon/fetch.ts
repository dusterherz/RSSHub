import { load } from 'cheerio';

import { config } from '@/config';
import ofetch from '@/utils/ofetch';

// Patreon serves both its pages and its JSON API behind a Cloudflare managed challenge that
// no plain HTTP client passes, and that a headless browser does not pass either. FlareSolverr
// runs a displayed browser that does. When its URL is configured every Patreon request is
// relayed through it; otherwise the request is made directly, so deployments without
// FlareSolverr keep their previous behaviour.
const flaresolverrUrl = () => config.patreon?.flaresolverrUrl?.replace(/\/+$/, '');

const timeout = 60000;

const direct = (url: string) =>
    ofetch(url, {
        headers: config.patreon?.sessionId ? { Cookie: `session_id=${config.patreon.sessionId}` } : {},
    });

const throughFlaresolverr = async (url: string, endpoint: string): Promise<string> => {
    const { status, message, solution } = await ofetch(`${endpoint}/v1`, {
        method: 'POST',
        body: {
            cmd: 'request.get',
            url,
            maxTimeout: timeout,
            cookies: config.patreon?.sessionId ? [{ name: 'session_id', value: config.patreon.sessionId }] : undefined,
        },
        timeout: timeout + 5000,
    });

    if (status !== 'ok' || solution?.status !== 200) {
        throw new Error(`FlareSolverr could not fetch "${url}": ${message || `status ${solution?.status}`}`);
    }

    return solution.response;
};

export const fetchPatreonPage = async (url: string): Promise<string> => {
    const endpoint = flaresolverrUrl();
    return endpoint ? await throughFlaresolverr(url, endpoint) : await direct(url);
};

export const fetchPatreonJson = async <T>(url: string): Promise<T> => {
    const endpoint = flaresolverrUrl();
    if (!endpoint) {
        return (await direct(url)) as T;
    }

    // FlareSolverr hands back what the browser displayed, so the JSON arrives wrapped in a document.
    const response = await throughFlaresolverr(url, endpoint);
    return JSON.parse(response.trimStart().startsWith('<') ? load(response)('body').text() : response) as T;
};
