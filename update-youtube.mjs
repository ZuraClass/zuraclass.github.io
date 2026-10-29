// Mengambil data channel YouTube lewat YouTube Data API v3 dan menyimpannya ke data/youtube.json.
// Dijalankan oleh GitHub Action (.github/workflows/youtube.yml). API key disimpan di GitHub Secrets, tidak tampil di website.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const KEY = process.env.YOUTUBE_API_KEY;
const HANDLE = process.env.YT_HANDLE || 'zuraclass';
const PLAYLIST = process.env.YT_PLAYLIST || 'PLNyPPzVOkZw6YwMI-eUnNZ_QVghISrTZC';
const OUT = 'data/youtube.json';
if (!KEY) { console.error('YOUTUBE_API_KEY belum diisi di GitHub Secrets.'); process.exit(1); }

async function api(path, params) {
  const u = new URL('https://www.googleapis.com/youtube/v3/' + path);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function playlistVideoIds(playlistId, max) {
  const ids = []; let pageToken = '';
  while (ids.length < max) {
    const d = await api('playlistItems', { part: 'contentDetails', playlistId, maxResults: 50, ...(pageToken && { pageToken }) });
    ids.push(...d.items.map(i => i.contentDetails.videoId));
    if (!d.nextPageToken) break; pageToken = d.nextPageToken;
  }
  return ids.slice(0, max);
}

async function videoDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await api('videos', { part: 'snippet,statistics,status', id: ids.slice(i, i + 50).join(',') });
    for (const v of d.items) {
      if (v.status && v.status.privacyStatus !== 'public') continue;
      out.push({ id: v.id, title: v.snippet.title, published: v.snippet.publishedAt, views: Number(v.statistics?.viewCount ?? 0) });
    }
  }
  return out;
}

const ch = (await api('channels', { part: 'snippet,statistics,contentDetails', forHandle: HANDLE })).items?.[0];
if (!ch) throw new Error('Channel tidak ditemukan untuk handle ' + HANDLE);

const uploadsId = ch.contentDetails.relatedPlaylists.uploads;
const all = await videoDetails(await playlistVideoIds(uploadsId, 500));
const latest = [...all].sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 8);
const popular = [...all].sort((a, b) => b.views - a.views).slice(0, 8);

let playlist = null;
try {
  const p = (await api('playlists', { part: 'snippet,contentDetails', id: PLAYLIST })).items?.[0];
  if (p) playlist = { id: PLAYLIST, title: p.snippet.title, count: p.contentDetails.itemCount, items: await videoDetails(await playlistVideoIds(PLAYLIST, 12)) };
} catch (e) { console.warn('Playlist dilewati:', e.message); }

const th = ch.snippet.thumbnails;
const data = {
  channel: {
    title: ch.snippet.title,
    handle: ch.snippet.customUrl || '@' + HANDLE,
    thumbnail: (th.high || th.medium || th.default).url,
    subscribers: ch.statistics.hiddenSubscriberCount ? null : Number(ch.statistics.subscriberCount),
    subscribersHidden: Boolean(ch.statistics.hiddenSubscriberCount),
    videos: Number(ch.statistics.videoCount),
    views: Number(ch.statistics.viewCount),
    url: 'https://youtube.com/@' + HANDLE
  },
  latest, popular, playlist
};

// Tulis hanya kalau isi berubah (supaya tidak ada commit kosong)
let prev = null;
try { prev = JSON.parse(await readFile(OUT, 'utf8')); delete prev.updatedAt; } catch {}
if (prev && JSON.stringify(prev) === JSON.stringify(data)) { console.log('Tidak ada perubahan.'); process.exit(0); }
await mkdir('data', { recursive: true });
await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), ...data }, null, 2));
console.log('data/youtube.json diperbarui:', all.length, 'video dibaca.');
