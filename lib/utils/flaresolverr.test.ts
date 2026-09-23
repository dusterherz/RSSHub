import { afterEach, describe, expect, it, vi } from 'vitest';

const ofetch = vi.hoisted(() => vi.fn());
const config = vi.hoisted(() => ({ flaresolverr: {} as { url?: string } }));

vi.mock('@/utils/ofetch', () => ({ default: ofetch }));
vi.mock('./ofetch', () => ({ default: ofetch }));
vi.mock('@/config', () => ({ config }));

const { flaresolverrGet, flaresolverrGetJson } = await import('./flaresolverr');

const solved = (response: string) => ({ status: 'ok', solution: { status: 200, response } });

afterEach(() => {
    ofetch.mockReset();
    config.flaresolverr = {};
});

describe('flaresolverr', () => {
    it('refuses to run when no endpoint is configured', async () => {
        await expect(flaresolverrGet('https://example.com')).rejects.toThrow('FLARESOLVERR_URL');
        expect(ofetch).not.toHaveBeenCalled();
    });

    it('posts the request to /v1 and trims a trailing slash off the endpoint', async () => {
        config.flaresolverr = { url: 'http://flaresolverr:8191/' };
        ofetch.mockResolvedValue(solved('<html><body>page</body></html>'));

        await expect(flaresolverrGet('https://example.com/page')).resolves.toBe('<html><body>page</body></html>');
        expect(ofetch.mock.calls[0][0]).toBe('http://flaresolverr:8191/v1');
        expect(ofetch.mock.calls[0][1].body).toMatchObject({ cmd: 'request.get', url: 'https://example.com/page' });
    });

    it('forwards cookies', async () => {
        config.flaresolverr = { url: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue(solved('{}'));

        await flaresolverrGetJson('https://example.com/api', [{ name: 'session_id', value: 'secret' }]);
        expect(ofetch.mock.calls[0][1].body.cookies).toEqual([{ name: 'session_id', value: 'secret' }]);
    });

    it('unwraps JSON returned inside a document', async () => {
        config.flaresolverr = { url: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue(solved('<html><head></head><body><pre>{"data":[{"id":"1"}]}</pre></body></html>'));

        await expect(flaresolverrGetJson('https://example.com/api')).resolves.toEqual({ data: [{ id: '1' }] });
    });

    it('reads bare JSON when the browser did not wrap it', async () => {
        config.flaresolverr = { url: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue(solved('{"data":[]}'));

        await expect(flaresolverrGetJson('https://example.com/api')).resolves.toEqual({ data: [] });
    });

    it('fails loudly when the challenge was not solved', async () => {
        config.flaresolverr = { url: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue({ status: 'error', message: 'Challenge not solved!' });

        await expect(flaresolverrGet('https://example.com')).rejects.toThrow('Challenge not solved!');
    });
});
