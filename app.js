import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';  // Import to use fileURLToPath
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';
import { google } from 'googleapis';
import { transcribeAudio } from './utils/whisper.js';

import { analyzeTranscript } from './utils/mistral.js';

dotenv.config();

const app = express();
const PORT = 3002;

// Convert __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);  // Get current file URL
const __dirname = path.dirname(__filename);  // Get the directory name from the file URL

const tokenPath = path.join(__dirname, 'token.json');  // Use __dirname for token path

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Google OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Express setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Home Route
app.get('/', (req, res) => {
  res.render('home');
});

// Google OAuth
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Authorization code missing');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));
    res.send('✅ Authorized! Go to /discussion to start.');
  } catch (err) {
    console.error('OAuth Error:', err.message);
    res.status(500).send('OAuth Error: ' + err.message);
  }
});

// Discussion Page
app.get('/discussion', async (req, res) => {
  try {
    const topics = [
      {
        title: 'Digital Privacy',
        description: 'Examine the balance between convenience and privacy in the digital age. Discuss data protection, surveillance, and individual rights online.'
      },
      {
        title: 'Artificial Intelligence Ethics',
        description: 'Discuss the ethical implications of AI development and deployment in society. Topics include bias in algorithms, privacy concerns, and regulation.'
      },
      {
        title: 'Climate Change Solutions',
        description: 'Explore practical and policy solutions to address climate change. Focus on renewable energy, carbon capture, and sustainable development.'
      },
      {
        title: 'Future of Work',
        description: 'Analyze how technology and global trends are reshaping work. Discuss remote work, automation, four-day workweeks, and universal basic income.'
      }
    ];

    // Generate a Meet link for each discussion
    const discussions = [];
    for (const topic of topics) {
      const meetLink = await createMeetLink();
      discussions.push({ ...topic, meetLink });
    }

    res.render('discussion', { discussions });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating Google Meet links: ' + err.message);
  }
});



async function createMeetLink(summary = 'Group Discussion') {
  if (!fs.existsSync(tokenPath)) {
    throw new Error('Token not found. Authorize via /auth/google');
  }

  const tokens = JSON.parse(fs.readFileSync(tokenPath));
  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: summary,
    description: 'GD via Google Meet',
    start: {
      dateTime: new Date().toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    conferenceData: {
      createRequest: {
        requestId: 'gd-' + Date.now() + '-' + Math.random(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
  });

  return response.data.conferenceData.entryPoints[0].uri;
}

// Upload Audio Route
app.post('/upload', upload.single('audio'), async (req, res) => {
  const participantId = req.body.participantId || 'unknown';
  const audioPath = req.file?.path;

  console.log(`📥 Audio uploaded for participant: ${participantId}`);
  console.log(`📂 File saved to: ${audioPath}`);

  if (!audioPath) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    console.log('🔁 Starting transcription with Whisper...');
    const transcript = await transcribeAudio(audioPath);
    console.log('✅ Transcription completed!');
    console.log('📝 Transcript:\n', transcript);

    console.log('🤖 Sending transcript to AI for feedback...');
    const feedback = await analyzeTranscript(transcript);  // Make sure this function exists and works
    console.log('✅ Feedback received.');
    console.log('📊 Feedback:\n', feedback);

    res.status(200).json({
      participantId,
      transcript,
      feedback,
      message: 'Transcript analyzed successfully',
    });
  } catch (err) {
    console.error('❌ Error during transcription or analysis:', err.message);
    res.status(500).json({
      error: 'Transcription or analysis failed',
      details: err.message,
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
