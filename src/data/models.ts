/* Data models, ported 1:1 from Android PHOENIXA (data/Models.kt). */

type J = Record<string, any>;

const str = (o: J | null | undefined, k: string): string | null => {
  const v = o?.[k];
  return v === undefined || v === null || v === '' ? null : String(v);
};
const num = (o: J | null | undefined, k: string): number | null => {
  const v = o?.[k];
  return typeof v === 'number' ? v : null;
};
const strList = (a: unknown): string[] => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x !== '') : []);

export interface Person {
  id: string;
  name: string;
  role: string;
  type: string;
  imageTag: string | null;
}

export interface MediaStreamInfo {
  type: string;
  codec: string;
  displayTitle: string;
  width: number;
  height: number;
  videoRange: string;
  channels: number;
  index: number;
  language: string | null;
  title: string | null;
  isDefault: boolean;
  isForced: boolean;
  isExternal: boolean;
  isTextSubtitle: boolean;
  videoRangeType: string;
}

/** Human label for HDR formats, or null for SDR */
export function hdrLabel(s: MediaStreamInfo): string | null {
  const t = s.videoRangeType.toUpperCase();
  if (t.startsWith('DOVI')) return 'Dolby Vision';
  if (t.includes('HDR10PLUS') || t.includes('HDR10+')) return 'HDR10+';
  if (t.includes('HDR10')) return 'HDR10';
  if (t.includes('HLG')) return 'HLG';
  if (s.videoRange.toUpperCase() === 'HDR') return 'HDR';
  return null;
}

export function parseStream(s: J): MediaStreamInfo {
  return {
    type: s.Type ?? '',
    codec: s.Codec ?? '',
    displayTitle: s.DisplayTitle ?? '',
    width: s.Width ?? 0,
    height: s.Height ?? 0,
    videoRange: s.VideoRange ?? '',
    channels: s.Channels ?? 0,
    index: s.Index ?? 0,
    language: str(s, 'Language'),
    title: str(s, 'Title'),
    isDefault: !!s.IsDefault,
    isForced: !!s.IsForced,
    isExternal: !!s.IsExternal,
    isTextSubtitle: !!s.IsTextSubtitleStream,
    videoRangeType: s.VideoRangeType ?? '',
  };
}

/** One playable version of a title (e.g. 4K HDR vs 1080p). */
export interface MediaSourceInfo {
  id: string;
  name: string;
  container: string;
  size: number;
  bitrate: number;
  streams: MediaStreamInfo[];
  defaultAudioIndex: number | null;
  defaultSubtitleIndex: number | null;
}

export function parseSource(o: J): MediaSourceInfo {
  return {
    id: o.Id ?? '',
    name: o.Name ?? '',
    container: o.Container ?? '',
    size: o.Size ?? 0,
    bitrate: o.Bitrate ?? 0,
    streams: Array.isArray(o.MediaStreams) ? o.MediaStreams.map(parseStream) : [],
    defaultAudioIndex: num(o, 'DefaultAudioStreamIndex'),
    defaultSubtitleIndex: num(o, 'DefaultSubtitleStreamIndex'),
  };
}

export const sourceVideo = (m: MediaSourceInfo) => m.streams.find(s => s.type === 'Video');
export const sourceAudio = (m: MediaSourceInfo) => m.streams.filter(s => s.type === 'Audio');
export const sourceSubs = (m: MediaSourceInfo) => m.streams.filter(s => s.type === 'Subtitle');

export function sourceLabel(m: MediaSourceInfo): string {
  const v = sourceVideo(m);
  let res: string | null = null;
  if (v) {
    if (v.width >= 3200 || v.height >= 1700) res = '4K';
    else if (v.width >= 1800 || v.height >= 1000) res = '1080p';
    else if (v.width >= 1200 || v.height >= 700) res = '720p';
    else if (v.height > 0) res = `${v.height}p`;
  }
  const parts = [res, v ? hdrLabel(v) : null, v?.codec ? v.codec.toUpperCase() : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : m.name;
}

export function sourceDetail(m: MediaSourceInfo): string {
  return [
    m.name.trim() ? m.name : null,
    m.container ? m.container.toUpperCase() : null,
    m.size > 0 ? `${(m.size / 1073741824).toFixed(1)} GB` : null,
    m.bitrate > 0 ? `${Math.floor(m.bitrate / 1000000)} Mbps` : null,
  ].filter(Boolean).join(' · ');
}

/** What the user picked on the details page before pressing Play. */
export interface PlaySelection {
  mediaSourceId?: string | null;
  audioIndex?: number | null;
  /** -1 = subtitles off, null = server default */
  subtitleIndex?: number | null;
}

export interface Library {
  id: string;
  name: string;
  collectionType: string | null;
  primaryTag: string | null;
}

export interface Item {
  id: string;
  name: string;
  type: string;
  overview: string;
  year: number | null;
  communityRating: number | null;
  criticRating: number | null;
  officialRating: string | null;
  runTimeTicks: number;
  genres: string[];
  primaryTag: string | null;
  backdropTag: string | null;
  backdropItemId: string | null;
  logoTag: string | null;
  logoItemId: string | null;
  thumbTag: string | null;
  thumbItemId: string | null;
  seriesId: string | null;
  seriesName: string | null;
  seriesPrimaryTag: string | null;
  seasonId: string | null;
  indexNumber: number | null;
  parentIndexNumber: number | null;
  childCount: number | null;
  playbackPositionTicks: number;
  playedPercentage: number | null;
  played: boolean;
  isFavorite: boolean;
  unplayedCount: number | null;
  collectionType: string | null;
  people: Person[];
  taglines: string[];
  studios: string[];
  streams: MediaStreamInfo[];
  premiereDate: string | null;
  endDate: string | null;
  locations: string[];
  mediaSources: MediaSourceInfo[];
}

export const isSeries = (i: Item) => i.type === 'Series';
export const isEpisode = (i: Item) => i.type === 'Episode';
export const isCollection = (i: Item) => i.type === 'BoxSet' || i.type === 'Folder' || i.type === 'CollectionFolder';

export const episodeLabel = (i: Item): string | null =>
  isEpisode(i) && i.parentIndexNumber !== null && i.indexNumber !== null ? `S${i.parentIndexNumber}:E${i.indexNumber}` : null;

export const runtimeMinutes = (i: Item) => Math.floor(i.runTimeTicks / 600000000);

export function progress(i: Item): number {
  if (i.playedPercentage !== null) return Math.max(0, Math.min(1, i.playedPercentage / 100));
  if (i.runTimeTicks > 0 && i.playbackPositionTicks > 0) return Math.max(0, Math.min(1, i.playbackPositionTicks / i.runTimeTicks));
  return 0;
}

export function qualityBadges(i: Item): string[] {
  const v = i.streams.find(s => s.type === 'Video');
  if (!v) return [];
  const out: string[] = [];
  if (v.width >= 3200 || v.height >= 1700) out.push('4K');
  else if (v.width >= 1800 || v.height >= 1000) out.push('HD');
  const h = hdrLabel(v);
  if (h) out.push(h);
  const a = i.streams.find(s => s.type === 'Audio');
  if (a) {
    const at = a.displayTitle.toUpperCase();
    const c = a.codec.toLowerCase();
    if (at.includes('ATMOS')) out.push('Atmos');
    else if (c === 'truehd') out.push('TrueHD');
    else if (c.startsWith('dts') || c === 'dca') out.push('DTS');
    if (a.channels >= 6) out.push(a.channels >= 8 ? '7.1' : '5.1');
  }
  if (i.mediaSources.length > 1) out.push(`${i.mediaSources.length} versions`);
  return out;
}

export function parseItem(o: J): Item {
  const imageTags: J | undefined = o.ImageTags;
  const backdrops: unknown[] | undefined = o.BackdropImageTags;
  const parentBackdrops: unknown[] | undefined = o.ParentBackdropImageTags;
  const userData: J | undefined = o.UserData;

  let backdropTag: string | null = Array.isArray(backdrops) && backdrops[0] ? String(backdrops[0]) : null;
  let backdropItemId: string | null = backdropTag ? o.Id : null;
  if (!backdropTag && Array.isArray(parentBackdrops) && parentBackdrops.length > 0 && parentBackdrops[0]) {
    backdropTag = String(parentBackdrops[0]);
    backdropItemId = str(o, 'ParentBackdropItemId');
  }

  let logoTag = str(imageTags, 'Logo');
  let logoItemId: string | null = logoTag ? o.Id : null;
  if (!logoTag && 'ParentLogoImageTag' in o) {
    logoTag = str(o, 'ParentLogoImageTag');
    logoItemId = str(o, 'ParentLogoItemId');
  }

  let thumbTag = str(imageTags, 'Thumb');
  let thumbItemId: string | null = thumbTag ? o.Id : null;
  if (!thumbTag && 'ParentThumbImageTag' in o) {
    thumbTag = str(o, 'ParentThumbImageTag');
    thumbItemId = str(o, 'ParentThumbItemId');
  }

  const people: Person[] = Array.isArray(o.People)
    ? o.People.filter(Boolean).map((p: J) => ({
        id: p.Id ?? '',
        name: p.Name ?? '',
        role: p.Role ?? '',
        type: p.Type ?? '',
        imageTag: str(p, 'PrimaryImageTag'),
      }))
    : [];

  const streams: MediaStreamInfo[] = Array.isArray(o.MediaStreams) ? o.MediaStreams.map(parseStream) : [];
  const sources: MediaSourceInfo[] = Array.isArray(o.MediaSources) ? o.MediaSources.map(parseSource) : [];

  return {
    id: o.Id ?? '',
    name: o.Name ?? '',
    type: o.Type ?? '',
    overview: o.Overview ?? '',
    year: num(o, 'ProductionYear'),
    communityRating: num(o, 'CommunityRating'),
    criticRating: num(o, 'CriticRating') !== null ? Math.trunc(o.CriticRating) : null,
    officialRating: str(o, 'OfficialRating'),
    runTimeTicks: o.RunTimeTicks ?? 0,
    genres: strList(o.Genres),
    primaryTag: str(imageTags, 'Primary'),
    backdropTag,
    backdropItemId,
    logoTag,
    logoItemId,
    thumbTag,
    thumbItemId,
    seriesId: str(o, 'SeriesId'),
    seriesName: str(o, 'SeriesName'),
    seriesPrimaryTag: str(o, 'SeriesPrimaryImageTag'),
    seasonId: str(o, 'SeasonId'),
    indexNumber: num(o, 'IndexNumber'),
    parentIndexNumber: num(o, 'ParentIndexNumber'),
    childCount: num(o, 'ChildCount'),
    playbackPositionTicks: userData?.PlaybackPositionTicks ?? 0,
    playedPercentage: num(userData, 'PlayedPercentage'),
    played: !!userData?.Played,
    isFavorite: !!userData?.IsFavorite,
    unplayedCount: num(userData, 'UnplayedItemCount'),
    collectionType: str(o, 'CollectionType'),
    people,
    taglines: strList(o.Taglines),
    studios: Array.isArray(o.Studios) ? o.Studios.map((s: J) => s?.Name).filter(Boolean) : [],
    streams: streams.length ? streams : sources[0]?.streams ?? [],
    premiereDate: str(o, 'PremiereDate'),
    endDate: str(o, 'EndDate'),
    locations: strList(o.ProductionLocations),
    mediaSources: sources,
  };
}
