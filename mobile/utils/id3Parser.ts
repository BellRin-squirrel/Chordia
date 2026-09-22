import * as FileSystem from 'expo-file-system';

export interface ParsedId3Tags {
  title?: string;
  artist?: string;
  album?: string;
  track?: string;
  year?: string;
  coverImageUri?: string | null;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

const decodeBase64ToUint8 = (b64: string): Uint8Array => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor(len * 0.75));

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = B64_LOOKUP[clean.charCodeAt(i)];
    const e2 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[clean.charCodeAt(i + 3)];

    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (i + 2 < len && clean[i + 2] !== '=') {
      bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    }
    if (i + 3 < len && clean[i + 3] !== '=') {
      bytes[p++] = ((e3 & 3) << 6) | e4;
    }
  }
  return bytes.subarray(0, p);
};

const encodeUint8ToBase64 = (bytes: Uint8Array): string => {
  let res = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    res += B64_CHARS[b0 >> 2];
    res += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    res += (i + 1 < len) ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    res += (i + 2 < len) ? B64_CHARS[b2 & 63] : '=';
  }
  return res;
};

// エンコーディングバイトに応じた文字列デコード
const decodeString = (bytes: Uint8Array, encodingByte: number): string => {
  if (bytes.length === 0) return '';

  try {
    if (encodingByte === 0) {
      // ISO-8859-1 (Latin1)
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    }

    if (encodingByte === 1 || encodingByte === 2) {
      // UTF-16 (with BOM / BE)
      let isBE = (encodingByte === 2);
      let offset = 0;
      if (bytes.length >= 2) {
        if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          isBE = true;
          offset = 2;
        } else if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          isBE = false;
          offset = 2;
        }
      }

      let str = '';
      for (let i = offset; i < bytes.length - 1; i += 2) {
        const charCode = isBE 
          ? (bytes[i] << 8) | bytes[i + 1] 
          : bytes[i] | (bytes[i + 1] << 8);
        if (charCode === 0) break;
        str += String.fromCharCode(charCode);
      }
      return str.trim();
    }

    // UTF-8
    if (typeof TextDecoder !== 'undefined') {
      const dec = new TextDecoder('utf-8');
      return dec.decode(bytes).replace(/\0.*$/g, '').trim();
    } else {
      let str = '';
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i];
        if (b === 0) break;
        if (b < 128) {
          str += String.fromCharCode(b);
          i += 1;
        } else if (b < 224 && i + 1 < bytes.length) {
          str += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63));
          i += 2;
        } else if (i + 2 < bytes.length) {
          str += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63));
          i += 3;
        } else {
          i += 1;
        }
      }
      return str.trim();
    }
  } catch (e) {
    return '';
  }
};

export const parseMp3Tags = async (fileUri: string): Promise<ParsedId3Tags> => {
  const result: ParsedId3Tags = {};

  try {
    // 1. 先頭 10 バイトを読み込み ID3v2 ヘッダーを確認
    const headerB64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 10,
    });
    const headerBytes = decodeBase64ToUint8(headerB64);

    if (headerBytes.length < 10) return result;

    // "ID3" マジックナンバー判定
    if (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33) {
      const versionMajor = headerBytes[3]; // 3 = ID3v2.3, 4 = ID3v2.4
      // Synchsafe 整数からタグサイズを計算
      const tagSize = ((headerBytes[6] & 0x7F) << 21) |
                      ((headerBytes[7] & 0x7F) << 14) |
                      ((headerBytes[8] & 0x7F) << 7) |
                      (headerBytes[9] & 0x7F);

      // カバーアート等の画像を含む全体タグサイズ（最大 8MB で安全制限）
      const totalReadSize = Math.min(10 + tagSize, 8 * 1024 * 1024);

      const fullTagB64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: 10,
        length: totalReadSize,
      });
      const tagBytes = decodeBase64ToUint8(fullTagB64);

      let pos = 0;
      const tagLength = tagBytes.length;

      while (pos + 10 < tagLength) {
        // パディング (0x00) に達したら終了
        if (tagBytes[pos] === 0) break;

        const frameId = String.fromCharCode(
          tagBytes[pos],
          tagBytes[pos + 1],
          tagBytes[pos + 2],
          tagBytes[pos + 3]
        );

        let frameSize = 0;
        if (versionMajor === 4) {
          frameSize = ((tagBytes[pos + 4] & 0x7F) << 21) |
                      ((tagBytes[pos + 5] & 0x7F) << 14) |
                      ((tagBytes[pos + 6] & 0x7F) << 7) |
                      (tagBytes[pos + 7] & 0x7F);
        } else {
          frameSize = (tagBytes[pos + 4] << 24) |
                      (tagBytes[pos + 5] << 16) |
                      (tagBytes[pos + 6] << 8) |
                      tagBytes[pos + 7];
        }

        if (frameSize <= 0 || pos + 10 + frameSize > tagLength) break;

        const frameData = tagBytes.subarray(pos + 10, pos + 10 + frameSize);

        // 各タグフレームの解析
        if (frameId === 'TIT2' || frameId === 'TT2') {
          result.title = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'TPE1' || frameId === 'TP1') {
          result.artist = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'TALB' || frameId === 'TAL') {
          result.album = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'TRCK' || frameId === 'TRK') {
          result.track = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'TYER' || frameId === 'TDRC') {
          result.year = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'APIC' || frameId === 'PIC') {
          // カバーアート画像の解析と一時保存
          try {
            // 画像バイナリの開始位置（JPEG: FF D8 FF / PNG: 89 50 4E 47）を高速探索
            let imgStart = -1;
            let ext = 'jpg';

            for (let j = 1; j < frameData.length - 4; j++) {
              if (frameData[j] === 0xFF && frameData[j + 1] === 0xD8 && frameData[j + 2] === 0xFF) {
                imgStart = j;
                ext = 'jpg';
                break;
              }
              if (frameData[j] === 0x89 && frameData[j + 1] === 0x50 && frameData[j + 2] === 0x4E && frameData[j + 3] === 0x47) {
                imgStart = j;
                ext = 'png';
                break;
              }
            }

            if (imgStart !== -1) {
              const imageBytes = frameData.subarray(imgStart);
              const imageB64 = encodeUint8ToBase64(imageBytes);

              const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
              await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

              const tempCoverUri = `${baseDir}temp_id3_${Date.now()}_${Math.random()}.${ext}`;
              await FileSystem.writeAsStringAsync(tempCoverUri, imageB64, {
                encoding: FileSystem.EncodingType.Base64,
              });

              result.coverImageUri = tempCoverUri;
            }
          } catch (imgErr) {}
        }

        pos += 10 + frameSize;
      }
    } else {
      // 2. ID3v2 が無い場合は末尾 128 バイトの ID3v1 をフォールバック探索
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 128) {
        const v1B64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: fileInfo.size - 128,
          length: 128,
        });
        const v1Bytes = decodeBase64ToUint8(v1B64);

        if (v1Bytes.length >= 128 && v1Bytes[0] === 0x54 && v1Bytes[1] === 0x41 && v1Bytes[2] === 0x47) {
          result.title = decodeString(v1Bytes.subarray(3, 33), 0);
          result.artist = decodeString(v1Bytes.subarray(33, 63), 0);
          result.album = decodeString(v1Bytes.subarray(63, 93), 0);
          result.year = decodeString(v1Bytes.subarray(93, 97), 0);
        }
      }
    }
  } catch (e) {
    console.warn('[id3Parser] Error parsing MP3 tags:', e);
  }

  return result;
};