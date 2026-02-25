// backend/utils/chunker.js

export function chunkText(text, chunkSize = 300, overlap = 50) {
  const words = text.split(' ');
  const chunks = [];

  let start = 0;

  while (start < words.length) {
    const end = start + chunkSize;
    const chunkWords = words.slice(start, end);
    chunks.push(chunkWords.join(' '));
    start += chunkSize - overlap;
  }

  return chunks;
}
