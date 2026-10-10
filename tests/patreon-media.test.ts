import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { route } from '../lib/routes/patreon/feed';
import type { Data } from '../lib/types';

const mocks = vi.hoisted(() => ({ json: vi.fn(), page: vi.fn(), tryGet: vi.fn() }));
vi.mock('../lib/routes/patreon/fetch', () => ({ fetchPatreonJson: mocks.json, fetchPatreonPage: mocks.page }));
vi.mock('../lib/utils/cache', () => ({ default: { tryGet: mocks.tryGet } }));

const post = (id: string, attributes: Record<string, unknown>, relationships: Record<string, unknown> = {}) => ({
    id,
    type: 'post',
    attributes: {
        title: `Post ${id}`,
        url: `https://www.patreon.com/posts/${id}`,
        published_at: '2026-10-09T16:30:04.000+00:00',
        content_json_string: null,
        teaser_text_json_string: null,
        post_metadata: null,
        video_preview: null,
        thumbnail: null,
        image: { url: `https://c10.patreonusercontent.com/${id}.png` },
        ...attributes,
    },
    relationships,
});

const invoke = async () => (await route.handler({ req: { param: () => ({ creator: 'OrigamiMedia' }) } } as unknown as Context)) as Data;

beforeEach(() => {
    vi.resetAllMocks();
    mocks.tryGet.mockResolvedValue({ id: '123', attributes: { name: 'ORIGAMI Média', creation_name: 'du jeu vidéo' } });
    mocks.json.mockResolvedValue({
        data: [
            post('audio', { post_type: 'podcast' }, { audio: { data: { id: 'm1', type: 'media' } } }),
            post('video', { post_type: 'video_external_file', post_file: { url: 'https://stream.mux.com/abc.m3u8?token=x' } }),
            post('embed', { post_type: 'video_embed', embed: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', subject: "L'Hebdo #S04E04" } }),
            post('text', { post_type: 'text_only', image: null }),
        ],
        included: [{ id: 'm1', type: 'media', attributes: { download_url: 'https://c10.patreonusercontent.com/ep.mp3?token-time=1', metadata: { duration: 3518.4 } } }],
    });
});

describe('patreon media', () => {
    it('exposes audio and native video as enclosures, and links embedded videos', async () => {
        const items = Object.fromEntries((await invoke()).item!.map((item) => [item.link!.split('/').pop(), item]));

        expect(items.audio).toMatchObject({ enclosure_url: 'https://c10.patreonusercontent.com/ep.mp3?token-time=1', enclosure_type: 'audio/mpeg', itunes_duration: 3518 });
        expect(items.video).toMatchObject({ enclosure_url: 'https://stream.mux.com/abc.m3u8?token=x', enclosure_type: 'application/x-mpegURL' });
        expect(items.embed.enclosure_url).toBeUndefined();
        expect(items.embed.description).toContain('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">L&#39;Hebdo #S04E04</a>');
        expect(items.text.enclosure_url).toBeUndefined();
    });
});
