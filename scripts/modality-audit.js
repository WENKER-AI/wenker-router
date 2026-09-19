// Liệt kê provider nào được proxyService.isNonChatProvider coi là non-chat.
// Mục đích: phát hiện FALSE POSITIVE (model chat thật bị chặn nhầm) trước khi tin cậy.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { PROVIDERS } = require(path.join(ROOT, 'server/config/providers-data.js'));

// Copy đúng regex + logic trong proxyService.js để audit độc lập (không khởi động server).
const NON_CHAT_URL =
  /(sdapi|comfyui|\/mj\b|bfl\.ml|flux|ideogram|\/image|\/video|sora|runwayml|dream-?machine|klingai|transcription|\/audio|\/music|\/speech|text-to-speech|\/tts|elevenlabs|cartesia|deepgram|assemblyai|speechmatics|neets|bark|musicgen|audiocraft|whisper|coqui)/i;
const isNonChat = (p) => NON_CHAT_URL.test(String(p.baseUrl || ''));

function modalityLabel(p) {
  const base = String(p?.baseUrl || '').toLowerCase();
  if (/(transcription|deepgram|assemblyai|speechmatics|whisper)/.test(base)) return 'STT';
  if (
    /(tts|elevenlabs|cartesia|neets|coqui|bark|musicgen|audiocraft|\/speech|text-to-speech|\/audio|\/music)/.test(
      base,
    )
  )
    return 'AUDIO';
  if (/(sora|runwayml|dream-?machine|klingai|\/video)/.test(base)) return 'VIDEO';
  if (/(sdapi|comfyui|flux|bfl|ideogram|\/mj\b|midjourney|\/image)/.test(base)) return 'IMAGE';
  return 'OTHER';
}

const all = Array.isArray(PROVIDERS) ? PROVIDERS : [];
const flagged = all.filter(isNonChat);
const notFlagged = all.filter((p) => !isNonChat(p));

console.log(`Tổng provider: ${all.length}`);
console.log(`Bị chặn (non-chat): ${flagged.length}`);
console.log(`Còn lại (chat): ${notFlagged.length}\n`);

console.log('=== BỊ CHẶN là non-chat ===');
for (const p of flagged) {
  console.log(`  [${modalityLabel(p).padEnd(5)}] ${String(p.id).padEnd(26)} ${p.baseUrl}`);
}

// Liệt kê provider chat có baseUrl trông "nghi ngờ" để rà soát sót (false negative).
const SUSPECT =
  /(image|video|audio|speech|tts|voice|music|suno|playground|dalle|imagen|firefly|stability|replicate|bfl|luma|pika)/i;
const suspectChat = notFlagged.filter((p) =>
  SUSPECT.test(String(p.baseUrl) + ' ' + String(p.name)),
);
console.log(
  '\n=== RÀ SOÁT: provider CHAT nhưng tên/URL gợi ý đa phương tiện (coi chừng bỏ sót) ===',
);
if (!suspectChat.length) console.log('  (không có)');
for (const p of suspectChat) {
  console.log(`  ${String(p.id).padEnd(26)} ${p.name}  ->  ${p.baseUrl}`);
}
