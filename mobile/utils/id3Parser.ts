import * as FileSystem from 'expo-file-system/legacy';

export interface ParsedId3Tags {
  title?: string;
  artist?: string;
  album?: string;
  track?: string;
  year?: string;
  isrc?: string;
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
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    }

    if (encodingByte === 1 || encodingByte === 2) {
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
    const headerB64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 10,
    });
    const headerBytes = decodeBase64ToUint8(headerB64);

    if (headerBytes.length < 10) return result;

    if (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33) {
      const versionMajor = headerBytes[3];
      const tagSize = ((headerBytes[6] & 0x7F) << 21) |
                      ((headerBytes[7] & 0x7F) << 14) |
                      ((headerBytes[8] & 0x7F) << 7) |
                      (headerBytes[9] & 0x7F);

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
        } else if (frameId === 'TSRC') {
          result.isrc = decodeString(frameData.subarray(1), frameData[0]);
        } else if (frameId === 'APIC' || frameId === 'PIC') {
          try {
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

const readU32BE = (b: Uint8Array, offset: number): number =>
  (((b[offset] << 24) | (b[offset + 1] << 16) | (b[offset + 2] << 8) | b[offset + 3]) >>> 0);

const readU32LE = (b: Uint8Array, offset: number): number =>
  (((b[offset + 3] << 24) | (b[offset + 2] << 16) | (b[offset + 1] << 8) | b[offset]) >>> 0);

const readBytesChunk = async (fileUri: string, position: number, length: number): Promise<Uint8Array> => {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return decodeBase64ToUint8(b64);
};

// オーディオセッションや再生中の曲に影響を与えずにファイルヘッダから再生時間（秒）を取得
export const getAudioDurationSeconds = async (fileUri: string): Promise<number> => {
  if (!fileUri) return 0;

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists || !info.size || info.size < 32) return 0;
    const fileSize = info.size;

    const head = await readBytesChunk(fileUri, 0, Math.min(fileSize, 64));
    if (head.length < 12) return 0;

    // 1. WAV (RIFF....WAVE)
    if (
      head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
      head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45
    ) {
      const wavHead = await readBytesChunk(fileUri, 0, Math.min(fileSize, 4096));
      let pos = 12;
      let byteRate = 0;
      let dataSize = 0;
      while (pos + 8 <= wavHead.length) {
        const id = String.fromCharCode(wavHead[pos], wavHead[pos + 1], wavHead[pos + 2], wavHead[pos + 3]);
        const size = readU32LE(wavHead, pos + 4);
        if (id === 'fmt ' && pos + 8 + 12 <= wavHead.length) {
          byteRate = readU32LE(wavHead, pos + 8 + 8);
        } else if (id === 'data') {
          dataSize = size;
          break;
        }
        pos += 8 + size + (size % 2);
      }
      if (byteRate > 0 && dataSize > 0) {
        return dataSize / byteRate;
      }
    }

    // 2. M4A / MP4 (....ftyp)
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      let boxOffset = 0;
      while (boxOffset + 8 <= fileSize) {
        const boxHead = await readBytesChunk(fileUri, boxOffset, 16);
        if (boxHead.length < 8) break;
        let boxSize = readU32BE(boxHead, 0);
        const boxType = String.fromCharCode(boxHead[4], boxHead[5], boxHead[6], boxHead[7]);
        if (boxSize === 1 && boxHead.length >= 16) {
          boxSize = readU32BE(boxHead, 8) * 4294967296 + readU32BE(boxHead, 12);
        } else if (boxSize === 0) {
          boxSize = fileSize - boxOffset;
        }
        if (boxSize < 8) break;

        if (boxType === 'moov') {
          const moovBytes = await readBytesChunk(fileUri, boxOffset, Math.min(boxSize, 262144));
          let inner = 8;
          while (inner + 8 <= moovBytes.length) {
            const subSize = readU32BE(moovBytes, inner);
            const subType = String.fromCharCode(moovBytes[inner + 4], moovBytes[inner + 5], moovBytes[inner + 6], moovBytes[inner + 7]);
            if (subSize < 8) break;
            if (subType === 'mvhd' && inner + 28 <= moovBytes.length) {
              const ver = moovBytes[inner + 8];
              if (ver === 0 && inner + 28 <= moovBytes.length) {
                const timescale = readU32BE(moovBytes, inner + 20);
                const duration = readU32BE(moovBytes, inner + 24);
                if (timescale > 0) return duration / timescale;
              } else if (ver === 1 && inner + 40 <= moovBytes.length) {
                const timescale = readU32BE(moovBytes, inner + 28);
                const durHi = readU32BE(moovBytes, inner + 32);
                const durLo = readU32BE(moovBytes, inner + 36);
                const duration = durHi * 4294967296 + durLo;
                if (timescale > 0) return duration / timescale;
              }
            }
            inner += subSize;
          }
          break;
        }
        boxOffset += boxSize;
      }
    }

    // 3. MP3 (ID3v2 あり/なし、CBR / VBR Xing / Info / VBRI)
    let audioStartOffset = 0;
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const tagSize = ((head[6] & 0x7F) << 21) |
                      ((head[7] & 0x7F) << 14) |
                      ((head[8] & 0x7F) << 7) |
                      (head[9] & 0x7F);
      audioStartOffset = 10 + tagSize;
    }

    if (audioStartOffset < fileSize) {
      const scanSize = Math.min(32768, fileSize - audioStartOffset);
      const bytes = await readBytesChunk(fileUri, audioStartOffset, scanSize);

      const srTable: Record<number, number[]> = {
        3: [44100, 48000, 32000],
        2: [22050, 24000, 16000],
        0: [11025, 12000, 8000],
      };
      const brV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
      const brV2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
      const brV1L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0];
      const brV1L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0];

      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] !== 0xFF || (bytes[i + 1] & 0xE0) !== 0xE0) continue;

        const b1 = bytes[i + 1];
        const b2 = bytes[i + 2];
        const b3 = bytes[i + 3];

        const versionBits = (b1 >> 3) & 0x03;
        const layerBits = (b1 >> 1) & 0x03;
        const bitrateIndex = (b2 >> 4) & 0x0F;
        const sampleRateIndex = (b2 >> 2) & 0x03;
        const paddingBit = (b2 >> 1) & 0x01;
        const channelMode = (b3 >> 6) & 0x03;

        if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
          continue;
        }

        const sampleRate = srTable[versionBits]?.[sampleRateIndex];
        if (!sampleRate) continue;

        const isMpeg1 = versionBits === 3;
        let bitrateKbps = 0;
        if (layerBits === 1) bitrateKbps = isMpeg1 ? brV1L3[bitrateIndex] : brV2L3[bitrateIndex];
        else if (layerBits === 2) bitrateKbps = isMpeg1 ? brV1L2[bitrateIndex] : brV2L3[bitrateIndex];
        else if (layerBits === 3) bitrateKbps = isMpeg1 ? brV1L1[bitrateIndex] : brV2L3[bitrateIndex];
        if (!bitrateKbps) continue;

        const samplesPerFrame = layerBits === 3 ? 384 : (isMpeg1 || layerBits === 2 ? 1152 : 576);
        const frameLength = layerBits === 3
          ? Math.floor((12 * bitrateKbps * 1000 / sampleRate + paddingBit) * 4)
          : Math.floor((samplesPerFrame / 8 * bitrateKbps * 1000 / sampleRate) + paddingBit);

        if (frameLength < 24) continue;

        // VBR (Xing / Info) チェック
        if (layerBits === 1) {
          const isMono = channelMode === 3;
          const sideInfoSize = isMpeg1 ? (isMono ? 17 : 32) : (isMono ? 9 : 17);
          const xingPos = i + 4 + sideInfoSize;
          if (xingPos + 12 <= bytes.length) {
            const tag = String.fromCharCode(bytes[xingPos], bytes[xingPos + 1], bytes[xingPos + 2], bytes[xingPos + 3]);
            if (tag === 'Xing' || tag === 'Info') {
              const flags = readU32BE(bytes, xingPos + 4);
              if ((flags & 0x01) !== 0) {
                const totalFrames = readU32BE(bytes, xingPos + 8);
                if (totalFrames > 0) {
                  return (totalFrames * samplesPerFrame) / sampleRate;
                }
              }
            }
          }

          // VBRI チェック
          const vbriPos = i + 4 + 32;
          if (vbriPos + 18 <= bytes.length) {
            const vbriTag = String.fromCharCode(bytes[vbriPos], bytes[vbriPos + 1], bytes[vbriPos + 2], bytes[vbriPos + 3]);
            if (vbriTag === 'VBRI') {
              const totalFrames = readU32BE(bytes, vbriPos + 14);
              if (totalFrames > 0) {
                return (totalFrames * samplesPerFrame) / sampleRate;
              }
            }
          }
        }

        // 次フレーム同期確認（誤検出防止）
        const nextFramePos = i + frameLength;
        if (nextFramePos + 2 <= bytes.length) {
          if (bytes[nextFramePos] !== 0xFF || (bytes[nextFramePos + 1] & 0xE0) !== 0xE0) {
            continue;
          }
        }

        // CBR 計算
        let id3v1Size = 0;
        if (fileSize > 128) {
          const tail = await readBytesChunk(fileUri, fileSize - 128, 3);
          if (tail.length >= 3 && tail[0] === 0x54 && tail[1] === 0x41 && tail[2] === 0x47) {
            id3v1Size = 128;
          }
        }
        const audioBytes = Math.max(0, fileSize - (audioStartOffset + i) - id3v1Size);
        return (audioBytes * 8) / (bitrateKbps * 1000);
      }
    }
  } catch (e) {}

  return 0;
};