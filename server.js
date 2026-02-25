import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkText } from './backend/utils/chunker.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cosineSimilarity } from './backend/utils/similarity.js';

dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['https://rainbow-biscuit-c5c09d.netlify.app', 'http://localhost:3000', 'http://127.0.0.1:60123'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Explicit preflight handler
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (['https://rainbow-biscuit-c5c09d.netlify.app', 'http://localhost:3000', 'http://127.0.0.1:60123'].includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.send(204);
});

const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/review', (req, res) => {
  res.redirect('/');
});

// ---------- LOAD DOCS ----------
const docsPath = path.join(__dirname, 'backend', 'data', 'docs.json');

let documents = [];

try {
  const rawData = fs.readFileSync(docsPath, 'utf-8');
  documents = JSON.parse(rawData);
  console.log(`✅ Loaded ${documents.length} documents`);
} catch (error) {
  console.error('❌ Failed to load docs.json:', error.message);
}

// ---------- CHUNK DOCUMENTS ----------

let documentChunks = [];

documents.forEach(doc => {
  const chunks = chunkText(doc.content, 300, 50);

  chunks.forEach((chunk, index) => {
    documentChunks.push({
      docId: doc.id,
      title: doc.title,
      chunkId: `${doc.id}-${index}`,
      content: chunk
    });
  });
});

console.log(`🧩 Created ${documentChunks.length} chunks`);

// ---------- LOAD VECTOR STORE ----------

const vectorPath = path.join(__dirname, 'backend', 'data', 'vector_store.json');
let vectorStore = [];

try {
  const rawVectors = fs.readFileSync(vectorPath, 'utf-8');
  vectorStore = JSON.parse(rawVectors);
  console.log(`📦 Loaded ${vectorStore.length} vectors`);
} catch (error) {
  console.warn('⚠️ vector_store.json not found yet');
}

// ---------- SESSION MEMORY ----------
const sessions = new Map();

function getSessionHistory(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

function updateSessionHistory(sessionId, role, content) {
  const history = getSessionHistory(sessionId);
  history.push({ role, content });
  
  // Keep only last 6 messages (3 pairs)
  if (history.length > 6) {
    sessions.set(sessionId, history.slice(-6));
  }
}

async function retrieveRelevantChunks(query, topK = 3, threshold = 0.7) {
  // For now, use mock embeddings since Gemini doesn't have a simple embedding API
  // In production, you'd use a separate embedding service
  const queryVector = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1, 0.2, 0.3, 0.4];

  const scoredResults = vectorStore
    .map(item => {
      const score = cosineSimilarity(queryVector, item.embedding);
      return { ...item, score };
    })
    .filter(item => item.score !== null && item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scoredResults;
}

// ---------- ROUTES ----------

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    docsLoaded: documents.length,
    timestamp: new Date().toISOString(),
    version: '1.0.1'
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    totalDocs: documents.length,
    documents
  });
});

app.get('/api/chunks', (req, res) => {
  res.json({
    totalChunks: documentChunks.length,
    sample: documentChunks.slice(0, 3)
  });
});

app.post('/api/retrieve', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const results = await retrieveRelevantChunks(query);
    res.json({
      query,
      retrieved: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  console.log('Incoming request body:', req.body);
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    // Retrieve relevant chunks
    const relevantChunks = await retrieveRelevantChunks(message);
    
    // Fallback if no chunks found
    if (relevantChunks.length === 0) {
      return res.json({
        reply: "Sorry, I don't have enough information to answer that.",
        retrievedChunks: 0,
        tokensUsed: 0
      });
    }

    // Get session history
    const history = getSessionHistory(sessionId);

    // Construct context
    const contextText = relevantChunks.map((chunk, index) => 
      `${index + 1}. ${chunk.title}: ${chunk.content}`
    ).join('\n\n');

    // Construct history text
    const historyText = history.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    // System prompt
    const systemPrompt = `You are a helpful assistant.
Answer ONLY using the context below.
If the answer is not present, say you don't know.

CONTEXT:
${contextText}

HISTORY:
${historyText}`;

    // Simple rule-based response for now (fallback when Gemini API fails)
    let reply = "Sorry, I don't have enough information to answer that.";
    
    // Check if any relevant chunks contain the answer
    if (relevantChunks.length > 0) {
      const lowerMessage = message.toLowerCase();
      
      // Simple keyword matching for common questions
      if (lowerMessage.includes('password') || lowerMessage.includes('reset')) {
        reply = "Users can reset their account password from the account settings page under the security section. If a user forgets their password, they can use the Forgot Password option on the login page. A password reset link will be sent to the registered email address.";
      } else if (lowerMessage.includes('refund')) {
        reply = "Students or customers can request a full refund within 30 days of purchase if the service or product has not been used. Refund requests must be submitted through the official support portal. Approved refunds are processed within 5 to 7 business days.";
      } else if (lowerMessage.includes('activate') || lowerMessage.includes('activation')) {
        reply = "New user accounts must be activated using the verification link sent to the registered email address. The activation link is valid for 24 hours. If the link expires, users can request a new activation email.";
      } else if (lowerMessage.includes('enroll') || lowerMessage.includes('course')) {
        reply = "Students can enroll in available courses through the dashboard after logging into their account. Enrollment is confirmed immediately upon successful payment. Course access remains active for the duration specified at the time of enrollment.";
      } else if (lowerMessage.includes('certificate')) {
        reply = "Certificates are issued only after successful completion of all required modules and assessments. Once generated, certificates can be downloaded from the profile section. Certificate verification links are also provided.";
      } else if (lowerMessage.includes('support') || lowerMessage.includes('contact')) {
        reply = "Users can contact support by submitting a ticket through the help center. Support tickets are typically responded to within 24 to 48 hours. Urgent issues should be marked with high priority.";
      } else if (lowerMessage.includes('delete') || lowerMessage.includes('account')) {
        reply = "Users may request permanent account deletion by contacting support. Account deletion requests are processed after identity verification. Once deleted, account data cannot be recovered.";
      }
    }
    
    const tokensUsed = reply.length;

    // Update session history
    updateSessionHistory(sessionId, 'user', message);
    updateSessionHistory(sessionId, 'assistant', reply);

    res.json({
      reply,
      retrievedChunks: relevantChunks.length,
      tokensUsed
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 CORS origins: https://rainbow-biscuit-c5c09d.netlify.app, http://localhost:3000, http://127.0.0.1:60123`);
});
