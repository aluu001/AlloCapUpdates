import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config, ai } from './config';
import { compareDocumentsStream } from './compareAgent';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure storage directory exists
if (!fs.existsSync(config.storageDir)) {
  fs.mkdirSync(config.storageDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storageDir);
  },
  filename: (req, file, cb) => {
    // Save files with original name but prevent duplicates/override issues
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF documents are supported for now.'));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Routes

// 1. Health & Config status
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    isApiConfigured: config.isApiConfigured,
    geminiApiKeyStatus: config.isApiConfigured ? 'Valid Format' : 'Missing/Placeholder'
  });
});

// 2. Upload file
app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Extract the original display name from filename
    const originalName = req.file.filename.split('-').slice(1).join('-');

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        displayName: originalName,
        path: req.file.path,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  });
});

// 3. List local files
app.get('/api/files', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(config.storageDir);
    const fileList = files
      .filter(file => file !== '.gitkeep')
      .map(filename => {
        const filePath = path.join(config.storageDir, filename);
        const stats = fs.statSync(filePath);
        // Exclude the timestamp prefix for display
        const displayName = filename.split('-').slice(1).join('-');
        
        return {
          filename,
          displayName,
          size: stats.size,
          uploadedAt: stats.mtime
        };
      })
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    res.json({ files: fileList });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to list files: ${error.message}` });
  }
});

// 4. Download file (raw untouched document)
app.get('/api/download/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(config.storageDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  res.download(filePath, filename.split('-').slice(1).join('-'));
});

// 4.5. Delete file from local storage
app.delete('/api/files/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(config.storageDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to delete file: ${error.message}` });
  }
});

// 5. Compare two documents (streaming responses)
app.post('/api/compare', async (req: Request, res: Response) => {
  const { filenameA, filenameB } = req.body;

  if (!filenameA || !filenameB) {
    return res.status(400).json({ error: 'Both filenameA and filenameB are required.' });
  }

  if (!config.isApiConfigured) {
    return res.status(400).json({
      error: 'Gemini API key is not configured. Please set the GEMINI_API_KEY env variable in backend/.env'
    });
  }

  const pathA = path.join(config.storageDir, filenameA);
  const pathB = path.join(config.storageDir, filenameB);

  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
    return res.status(404).json({ error: 'One or both files do not exist in local storage.' });
  }

  const displayNameA = filenameA.split('-').slice(1).join('-');
  const displayNameB = filenameB.split('-').slice(1).join('-');

  // Configure chunked streaming response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendChunk = (data: any) => {
    res.write(JSON.stringify(data) + '\n');
  };

  try {
    console.log(`Starting streaming comparison between ${displayNameA} and ${displayNameB}`);
    
    const report = await compareDocumentsStream(
      pathA,
      pathB,
      displayNameA,
      displayNameB,
      (thought) => {
        sendChunk({ type: 'thought', text: thought });
      },
      (progressMsg) => {
        sendChunk({ type: 'progress', message: progressMsg });
        console.log(`[Compare Agent]: ${progressMsg}`);
      }
    );

    sendChunk({ type: 'report', success: true, report });
    res.end();
  } catch (error: any) {
    console.error('Comparison error:', error);
    sendChunk({ type: 'error', error: error.message });
    res.end();
  }
});

// 6. Interactive chat about compared documents
app.post('/api/chat', async (req: Request, res: Response) => {
  const { filenameA, filenameB, messages, message } = req.body;

  if (!filenameA || !filenameB || !message) {
    return res.status(400).json({ error: 'filenameA, filenameB, and message are required.' });
  }

  const pathA = path.join(config.storageDir, filenameA);
  const pathB = path.join(config.storageDir, filenameB);

  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
    return res.status(404).json({ error: 'One or both files do not exist in local storage.' });
  }

  const displayNameA = filenameA.split('-').slice(1).join('-');
  const displayNameB = filenameB.split('-').slice(1).join('-');

  let fileARef: any = null;
  let fileBRef: any = null;

  try {
    // Upload files to Gemini on-demand for context
    fileARef = await ai.files.upload({
      file: pathA,
      config: { mimeType: 'application/pdf', displayName: `Chat_A_${displayNameA}` }
    });

    fileBRef = await ai.files.upload({
      file: pathB,
      config: { mimeType: 'application/pdf', displayName: `Chat_B_${displayNameB}` }
    });

    // Simple poll
    let active = false;
    for (let i = 0; i < 30; i++) {
      const stateA = (await ai.files.get({ name: fileARef.name })).state;
      const stateB = (await ai.files.get({ name: fileBRef.name })).state;
      if (stateA === 'ACTIVE' && stateB === 'ACTIVE') {
        active = true;
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!active) {
      throw new Error('Timeout waiting for files to become active for chat context.');
    }

    const chatMessages = messages || [];

    // Map history to Gemini format (user/model)
    const formattedHistory = chatMessages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are an AI document compare agent. You are answering user questions about the differences between two documents.
              Document A: "${displayNameA}"
              Document B: "${displayNameB}"
              
              Answer the question accurately based on the contents of both files.`
            },
            { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
            { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } },
            { text: message }
          ]
        }
      ]
    });

    res.json({
      reply: response.text || 'Sorry, I could not generate a response.'
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: `Chat generation failed: ${error.message}` });
  } finally {
    // Delete files
    if (fileARef?.name) ai.files.delete({ name: fileARef.name }).catch(console.error);
    if (fileBRef?.name) ai.files.delete({ name: fileBRef.name }).catch(console.error);
  }
});

// Start Server
app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`  AlloCapUpdates Backend running on port ${config.port}`);
  console.log(`  Storage directory: ${config.storageDir}`);
  console.log(`====================================================`);
});
