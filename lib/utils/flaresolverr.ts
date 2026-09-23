import { load } from 'cheerio';

import { config } from '@/config';

import ofetch from './ofetch';

export type FlaresolverrCookie = { name: string; value: string };

const timeout = 60000;

export const flaresolverrEndpoint = () => config.flaresolverr?.url?.replace(/\/+$/, '');

/**
 * Fetch a URL through a FlareSolverr instance, which drives a displayed browser and so gets
 * past the Cloudflare managed challenges that neither a plain HTTP client nor a headless
 * browser can solve. Returns what the browser displayed.
 */
export const flaresolverrGet = async (url: string, cookies?: FlaresolverrCookie[]): Promise<string> => {
    const endpoint = flaresolverrEndpoint();
    if (!endpoint) {
        throw new Error('Configure FLARESOLVERR_URL to fetch through FlareSolverr.');
    }

    const { status, message, solution } = await ofetch(`${endpoint}/v1`, {
        method: 'POST',
        body: { cmd: 'request.get', url, maxTimeout: timeout, cookies },
        timeout: timeout + 5000,
    });

    if (status !== 'ok' || solution?.status !== 200) {
        throw new Error(`FlareSolverr could not fetch "${url}": ${message || `status ${solution?.status}`}`);
    }

    return solution.response;
};

/** Same, for endpoints that answer JSON: the browser wraps it in a document, so unwrap it. */
export const flaresolverrGetJson = async <T>(url: string, cookies?: FlaresolverrCookie[]): Promise<T> => {
    const response = await flaresolverrGet(url, cookies);
    return JSON.parse(response.trimStart().startsWith('<') ? load(response)('body').text() : response) as T;
};
