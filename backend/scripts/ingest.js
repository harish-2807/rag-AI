import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { chunkText } from '../utils/chunker.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock embedding function for now (since Gemini doesn't have simple embedding API)
function createMockEmbedding(text) {
  // Create a simple hash-based embedding
  const embedding = [];
  for (let i = 0; i < 10; i++) {
    embedding.push((text.charCodeAt(i % text.length) / 1000) % 1);
  }
  return embedding;
}

// Paths
const docsPath = path.join(__dirname, '../data/docs.json');
const vectorStorePath = path.join(__dirname, '../data/vector_store.json');

async function ingest() {
  const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

  let vectors = [];

  for (const doc of rawDocs) {
    const chunks = chunkText(doc.content, 300, 50);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = createMockEmbedding(chunks[i]);

      vectors.push({
        docId: doc.id,
        title: doc.title,
        chunkId: `${doc.id}-${i}`,
        content: chunks[i],
        embedding: embedding
      });
    }
  }

  fs.writeFileSync(vectorStorePath, JSON.stringify(vectors, null, 2));
  console.log(`✅ Stored ${vectors.length} embeddings`);
}

ingest().catch(console.error);
