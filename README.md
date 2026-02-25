# GenAI RAG Assistant

A production-grade Retrieval-Augmented Generation (RAG) assistant built with Node.js, Express, and OpenAI embeddings.

## How RAG Works

1. **Document Ingestion**: Support policies are chunked and converted to embeddings using OpenAI's `text-embedding-3-small` model
2. **Vector Storage**: Embeddings are stored in `vector_store.json` with metadata
3. **Query Processing**: User questions are embedded and compared to stored chunks using cosine similarity
4. **Context Retrieval**: Top 3 most relevant chunks (similarity ≥ 0.7) are retrieved
5. **Grounded Response**: OpenAI Chat Completion generates responses using only the retrieved context

## Features

- ✅ Embedding-based document retrieval
- ✅ Cosine similarity search with configurable thresholds
- ✅ Session memory (last 3 conversation pairs)
- ✅ Grounded LLM responses
- ✅ Fallback handling for no relevant context
- ✅ Production-ready error handling
- ✅ Static frontend (Netlify compatible)

## Backend Setup

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

```bash
# Clone and navigate to project
cd restthecase

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add your OpenAI API key to .env

# Generate embeddings
node backend/scripts/ingest.js

# Start server
npm start
```

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NODE_ENV=development
```

### API Endpoints

- `GET /health` - Health check
- `GET /api/docs` - List all documents
- `GET /api/chunks` - List document chunks
- `POST /api/retrieve` - Test retrieval
- `POST /api/chat` - Main chat endpoint

## API Contract: POST /api/chat

**Request:**
```json
{
  "sessionId": "abc123",
  "message": "How can I reset my password?"
}
```

**Response:**
```json
{
  "reply": "You can reset your password...",
  "retrievedChunks": 3,
  "tokensUsed": 123
}
```

## Frontend Deployment (Netlify)

### Prerequisites

- Backend deployed on Render/Railway/Heroku
- Frontend files in `frontend/` directory

### Deployment Steps

1. **Deploy Backend**
   ```bash
   # Deploy to Render/Railway with environment variables
   # Ensure OPENAI_API_KEY is set in production
   # Note the deployed backend URL
   ```

2. **Configure Frontend**
   - Open `frontend/index.html`
   - Update `API_BASE_URL` to your deployed backend URL
   - Example: `const API_BASE_URL = 'https://your-backend.onrender.com';`

3. **Deploy to Netlify**
   ```bash
   # Drag and drop frontend/ folder to Netlify
   # Or use Netlify CLI
   netlify deploy --prod --dir=frontend
   ```

### Frontend Features

- Clean, responsive UI without CSS frameworks
- Session persistence via localStorage
- Real-time chat interface
- Loading states and error handling
- Mobile-responsive design
- Token usage and chunk count display

## Project Structure

```
restthecase/
├── backend/
│   ├── data/
│   │   ├── docs.json              # Source documents
│   │   └── vector_store.json      # Generated embeddings
│   ├── scripts/
│   │   └── ingest.js              # Embedding generation
│   └── utils/
│       ├── chunker.js             # Text chunking
│       └── similarity.js          # Cosine similarity
├── frontend/
│   └── index.html                 # Static frontend
├── server.js                      # Express server
├── package.json
├── .env.example
└── README.md
```

## Development

### Adding New Documents

1. Add documents to `backend/data/docs.json`
2. Run `node backend/scripts/ingest.js` to regenerate embeddings
3. Restart the server

### Configuration

- **Chunk Size**: 300 words (in `chunker.js`)
- **Chunk Overlap**: 50 words
- **Similarity Threshold**: 0.7 (in `server.js`)
- **Top K Results**: 3 chunks
- **Max Tokens**: 500 per response
- **Temperature**: 0.2 (low for factual responses)

### Monitoring

- Server logs show document/vector loading status
- Token usage tracked per request
- Error handling with appropriate HTTP status codes

## Production Considerations

- **Security**: Never expose API keys in frontend
- **Scalability**: Vector store is file-based (consider DB for large scale)
- **Session Management**: In-memory sessions (consider Redis for production)
- **Rate Limiting**: Implement API rate limiting
- **Monitoring**: Add logging and metrics

## License

MIT
