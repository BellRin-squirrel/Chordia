const DEFAULT_ICON = require('../assets/images/icon.png');

export interface SmartConditionFilter {
  type: 'filter';
  tag: string;
  op: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'startswith' | 'endswith' | 'greater' | 'less' | 'range';
  val: any;
}

export interface SmartConditionGroup {
  type: 'group';
  match: 'all' | 'any';
  items: (SmartConditionFilter | SmartConditionGroup)[];
}

export type SmartConditionNode = SmartConditionFilter | SmartConditionGroup;

const normalizeStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).normalize('NFC').toLowerCase().trim();
};

const getTagValue = (song: any, tag: string): any => {
  if (!song) return undefined;
  
  const key = tag.toLowerCase();
  if (key === 'album_artist' || key === 'albumartist') {
    return song.album_artist || song.albumArtist || song.artist;
  }
  return song[tag] !== undefined ? song[tag] : song[key];
};

/**
 * 単一のフィルター条件を評価する
 */
const evaluateFilter = (filter: SmartConditionFilter, song: any): boolean => {
  const { tag, op, val } = filter;
  const rawValue = getTagValue(song, tag);

  // 数値系タグの評価
  if (['track', 'year', 'disc', 'bpm'].includes(tag.toLowerCase())) {
    const songNum = Number(rawValue);
    if (isNaN(songNum)) return false;

    if (op === 'range' && Array.isArray(val) && val.length >= 2) {
      const min = Number(val[0]);
      const max = Number(val[1]);
      return songNum >= min && songNum <= max;
    }

    const targetNum = Number(val);
    if (isNaN(targetNum)) return false;

    switch (op) {
      case 'equals':
        return songNum === targetNum;
      case 'not_equals':
        return songNum !== targetNum;
      case 'greater':
        return songNum > targetNum;
      case 'less':
        return songNum < targetNum;
      default:
        return false;
    }
  }

  // 文字列系タグの評価
  const songStr = normalizeStr(rawValue);
  const targetStr = normalizeStr(val);

  switch (op) {
    case 'contains':
      return songStr.includes(targetStr);
    case 'not_contains':
      return !songStr.includes(targetStr);
    case 'equals':
      return songStr === targetStr;
    case 'not_equals':
      return songStr !== targetStr;
    case 'startswith':
      return songStr.startsWith(targetStr);
    case 'endswith':
      return songStr.endsWith(targetStr);
    default:
      return false;
  }
};

/**
 * グループ条件（または再帰的な木構造）を評価する
 */
const evaluateNode = (node: SmartConditionNode, song: any): boolean => {
  if (!node) return true;

  if (node.type === 'filter') {
    return evaluateFilter(node as SmartConditionFilter, song);
  }

  if (node.type === 'group') {
    const group = node as SmartConditionGroup;
    if (!group.items || group.items.length === 0) return true;

    if (group.match === 'any') {
      return group.items.some(child => evaluateNode(child, song));
    }
    // デフォルトは 'all' (AND)
    return group.items.every(child => evaluateNode(child, song));
  }

  return true;
};

/**
 * 楽曲リストを指定のソートキーと昇順/降順で並び替える
 */
export const sortSongs = (songs: any[], sortBy: string = 'title', sortDesc: boolean = false): any[] => {
  const result = [...songs];
  const isNumeric = ['track', 'disc', 'year', 'bpm'].includes(sortBy.toLowerCase());

  result.sort((a, b) => {
    let valA = a[sortBy] ?? a[sortBy.toLowerCase()] ?? '';
    let valB = b[sortBy] ?? b[sortBy.toLowerCase()] ?? '';

    if (isNumeric) {
      valA = parseInt(valA, 10) || 0;
      valB = parseInt(valB, 10) || 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  return result;
};

/**
 * プレイリスト（通常 / スマート / すべての楽曲）から対象となる楽曲配列を動的抽出・ソートして取得する
 */
export const getPlaylistSongs = (playlist: any, allSongs: any[] = []): any[] => {
  if (!playlist || !Array.isArray(allSongs)) return [];

  const sortBy = playlist.sortBy || 'title';
  const sortDesc = playlist.sortDesc || false;

  // 1. 全楽曲プレイリスト
  if (playlist.isAll || playlist.id === 'all_songs') {
    return sortSongs(allSongs, sortBy, sortDesc);
  }

  // 2. スマートプレイリスト (動的生成)
  if (playlist.type === 'smart' && playlist.conditions) {
    const filtered = allSongs.filter(song => evaluateNode(playlist.conditions, song));
    return sortSongs(filtered, sortBy, sortDesc);
  }

  // 3. 通常プレイリスト (登録ファイル名配列によるマッチング)
  const musicList = Array.isArray(playlist.music) ? playlist.music : [];
  const musicFileSet = new Set(
    musicList.map((m: any) => {
      const pathStr = typeof m === 'string' ? m : (m?.musicFilename || m?.path || '');
      return pathStr.split(/[\\/]/).pop()?.toLowerCase();
    }).filter(Boolean)
  );

  const matched = allSongs.filter((song: any) => {
    const fname = song?.musicFilename ? song.musicFilename.split(/[\\/]/).pop()?.toLowerCase() : '';
    return fname ? musicFileSet.has(fname) : false;
  });

  return sortSongs(matched, sortBy, sortDesc);
};

/**
 * プレイリストのカバー画像を取得する（専用画像 > 所属曲の先頭画像 > デフォルトアイコン）
 */
export const getPlaylistFirstArt = (playlist: any, allSongs: any[] = []): any => {
  if (!playlist) return DEFAULT_ICON;

  if (playlist.localCoverImageUri) {
    const cleanUri = playlist.localCoverImageUri.split('?')[0];
    return { uri: cleanUri };
  }

  const songs = getPlaylistSongs(playlist, allSongs);
  if (songs.length > 0 && songs[0].localImageUri) {
    return { uri: songs[0].localImageUri };
  }

  return DEFAULT_ICON;
};
