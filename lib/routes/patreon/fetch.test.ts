import { afterEach, describe, expect, it, vi } from 'vitest';

const ofetch = vi.hoisted(() => vi.fn());
const config = vi.hoisted(() => ({ patreon: {} as { flaresolverrUrl?: string; sessionId?: string } }));

vi.mock('@/utils/ofetch', () => ({ default: ofetch }));
vi.mock('@/config', () => ({ config }));

const { fetchPatreonJson, fetchPatreonPage } = await import('./fetch');

const solved = (response: string) => ({ status: 'ok', solution: { status: 200, response } });

afterEach(() => {
    ofetch.mockReset();
    config.patreon = {};
});

describe('patreon transport', () => {
    it('requests directly when no FlareSolverr is configured', async () => {
        ofetch.mockResolvedValue({ data: [] });

        await expect(fetchPatreonJson('https://www.patreon.com/api/posts')).resolves.toEqual({ data: [] });
        expect(ofetch).toHaveBeenCalledWith('https://www.patreon.com/api/posts', { headers: {} });
    });

    it('sends the session cookie on direct requests', async () => {
        config.patreon = { sessionId: 'secret' };
        ofetch.mockResolvedValue('<html></html>');

        await fetchPatreonPage('https://www.patreon.com/creator');
        expect(ofetch).toHaveBeenCalledWith('https://www.patreon.com/creator', { headers: { Cookie: 'session_id=secret' } });
    });

    it('relays through FlareSolverr and trims its trailing slash', async () => {
        config.patreon = { flaresolverrUrl: 'http://flaresolverr:8191/' };
        ofetch.mockResolvedValue(solved('<html><body>page</body></html>'));

        await expect(fetchPatreonPage('https://www.patreon.com/creator')).resolves.toBe('<html><body>page</body></html>');
        expect(ofetch.mock.calls[0][0]).toBe('http://flaresolverr:8191/v1');
        expect(ofetch.mock.calls[0][1].body).toMatchObject({ cmd: 'request.get', url: 'https://www.patreon.com/creator' });
    });

    it('unwraps JSON that FlareSolverr returns inside a document', async () => {
        config.patreon = { flaresolverrUrl: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue(solved('<html><head></head><body><pre>{"data":[{"id":"1"}]}</pre></body></html>'));

        await expect(fetchPatreonJson('https://www.patreon.com/api/posts')).resolves.toEqual({ data: [{ id: '1' }] });
    });

    it('forwards the session cookie to FlareSolverr', async () => {
        config.patreon = { flaresolverrUrl: 'http://flaresolverr:8191', sessionId: 'secret' };
        ofetch.mockResolvedValue(solved('{}'));

        await fetchPatreonJson('https://www.patreon.com/api/posts');
        expect(ofetch.mock.calls[0][1].body.cookies).toEqual([{ name: 'session_id', value: 'secret' }]);
    });

    it('fails loudly when FlareSolverr could not solve the challenge', async () => {
        config.patreon = { flaresolverrUrl: 'http://flaresolverr:8191' };
        ofetch.mockResolvedValue({ status: 'error', message: 'Challenge not solved!' });

        await expect(fetchPatreonJson('https://www.patreon.com/api/posts')).rejects.toThrow('Challenge not solved!');
    });
});
