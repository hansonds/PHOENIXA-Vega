/**
 * Jellyfin DeviceProfile for Fire TV with Vega OS: what its player can play directly.
 * PHOENIXA never asks the server to transcode, so this only describes the device honestly.
 */
const VIDEO = ['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1', 'mpeg2video', 'mpeg4'];
// TrueHD is listed so the server still hands the file over; the app then picks an audio track the TV can play.
const AUDIO = ['aac', 'mp3', 'mp2', 'opus', 'flac', 'vorbis', 'pcm_s16le', 'pcm_s24le', 'ac3', 'eac3', 'ac4', 'dts', 'dca', 'truehd', 'mlp'];

let cached: object | null = null;

export function deviceProfile(): object {
  if (cached) return cached;
  const subs: object[] = [];
  ['srt', 'subrip', 'ass', 'ssa', 'vtt', 'webvtt', 'pgs', 'pgssub', 'dvdsub', 'dvbsub'].forEach(f => subs.push({ Format: f, Method: 'Embed' }));
  ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa'].forEach(f => subs.push({ Format: f, Method: 'External' }));
  cached = {
    Name: 'PHOENIXA (Vega)',
    MaxStreamingBitrate: 200000000,
    MaxStaticBitrate: 200000000,
    MusicStreamingTranscodingBitrate: 320000,
    DirectPlayProfiles: [
      { Type: 'Video', Container: 'mp4,m4v,mkv,webm,mov,ts,mpegts,avi,3gp', VideoCodec: VIDEO.join(','), AudioCodec: AUDIO.join(',') },
      { Type: 'Audio', Container: 'mp3,aac,flac,m4a,ogg,opus,wav' },
    ],
    TranscodingProfiles: [],
    SubtitleProfiles: subs,
    ContainerProfiles: [],
    CodecProfiles: [],
  };
  return cached;
}

/** Audio the Vega player can't play at all (DTS only works as passthrough to a soundbar/receiver) */
export const isUnplayableAudio = (codec: string) => ['truehd', 'mlp'].includes(codec.toLowerCase());
export const isDts = (codec: string) => {
  const c = codec.toLowerCase();
  return c === 'dts' || c === 'dca' || c.startsWith('dts');
};

/**
 * The audio track that will really play: the wanted one if this TV can play it, else the same
 * language in a playable format, else the first playable track (null = none playable).
 */
export function effectiveAudio(
  streams: Array<{ type: string; codec: string; index: number; language: string | null; isExternal: boolean }>,
  wanted: number | null,
  same: (a: string | null, b: string | null) => boolean,
): number | null {
  const audio = streams.filter(s => s.type === 'Audio' && !s.isExternal);
  const playable = audio.filter(s => !isUnplayableAudio(s.codec));
  const w = audio.find(s => s.index === wanted);
  if (w && playable.includes(w)) return w.index;
  const sameLang = w ? playable.find(s => same(s.language, w.language)) : undefined;
  return (sameLang ?? playable.find(s => !isDts(s.codec)) ?? playable[0])?.index ?? null;
}
