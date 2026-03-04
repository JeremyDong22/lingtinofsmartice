// Storage Path Utilities - Generate Supabase Storage paths for direct upload
// v1.0 - Mirrors backend audio.service.ts path logic for parallel dual-write

const CHINA_TIMEZONE = 'Asia/Shanghai';

// Get current date string in China timezone (YYYY-MM-DD)
export function getChinaDateString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: CHINA_TIMEZONE });
}

// Get current hour in China timezone (0-23)
export function getChinaHour(): number {
  const chinaTime = new Date().toLocaleString('en-US', {
    timeZone: CHINA_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(chinaTime, 10);
}

// Chinese table ID → ASCII-safe format (mirrors backend toAsciiTableId)
const CHINESE_MAP: Record<string, string> = {
  包: 'bao', 外: 'wai', 内: 'nei', 大: 'da', 小: 'xiao',
  厅: 'ting', 雅: 'ya', 间: 'jian', 桌: 'zhuo', 台: 'tai',
  号: 'hao', 楼: 'lou', 层: 'ceng', 区: 'qu', 座: 'zuo',
};

export function toAsciiTableId(tableId: string): string {
  let result = tableId;
  for (const [chinese, pinyin] of Object.entries(CHINESE_MAP)) {
    result = result.replace(new RegExp(chinese, 'g'), pinyin);
  }
  // If still contains non-ASCII, fallback to hex encoding
  if (!/^[\x00-\x7F]*$/.test(result)) {
    // Browser-compatible hex encoding (no Buffer)
    result = Array.from(new TextEncoder().encode(tableId))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return result;
}

// Generate Storage path for visit recordings
// Format: recordings/{restaurantId}/{timestamp}_{safeTableId}.{ext}
// NOTE: Path differs from backend (backend uses same pattern but different timestamp),
// so Path A files are separate from Path B files — intentional for simplicity
export function buildRecordingPath(
  restaurantId: string,
  tableId: string,
  mimeType: string,
): string {
  const safeTableId = toAsciiTableId(tableId);
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return `recordings/${restaurantId}/${Date.now()}_${safeTableId}_direct.${ext}`;
}

// Generate Storage path for meeting recordings
export function buildMeetingPath(
  restaurantId: string,
  meetingType: string,
  mimeType: string,
): string {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return `meetings/${restaurantId}/${Date.now()}_${meetingType}_direct.${ext}`;
}
