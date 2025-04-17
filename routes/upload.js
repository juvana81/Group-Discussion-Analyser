const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const whisperUtil = require('../utils/whisper');
const mistralUtil = require('../utils/mistral');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const participantId = req.body.participantId || uuidv4();
    cb(null, `${participantId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit to 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Handle audio upload, transcription, and analysis
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const participantId = req.body.participantId || uuidv4();
    const audioPath = req.file.path;
    
    // Step 1: Transcribe the audio
    const transcript = await whisperUtil.transcribeAudio(audioPath);
    
    // Step 2: Analyze the transcript with Mistral AI
    const analysis = await mistralUtil.analyzeTranscript(transcript);

    // Step 3: Parse the analysis into sections for display
    const parsedAnalysis = parseAnalysis(analysis);
    
    // Save results (in a real app, you'd likely use a database)
    const reportData = {
      participantId,
      transcript,
      analysis: parsedAnalysis
    };
    
    // Save report data to a JSON file (this is a simple alternative to a database)
    fs.writeFileSync(
      path.join(__dirname, '..', 'uploads', `${participantId}-report.json`),
      JSON.stringify(reportData, null, 2)
    );
    
    // Redirect to the report page
    res.redirect(`/report/${participantId}`);
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing audio',
      error: error.message
    });
  }
});

// Helper function to parse the analysis from Mistral AI
function parseAnalysis(analysis) {
  // In a real application, you'd implement more robust parsing
  // This is a simple implementation that assumes a structured response
  
  const grammarSection = analysis.match(/1\.\s*Evaluate grammar and coherence\.(.*?)2\./s)?.[1]?.trim() || '';
  const factualSection = analysis.match(/2\.\s*Check factual accuracy\.(.*?)3\./s)?.[1]?.trim() || '';
  
  // Extract suggestions
  const suggestionsMatch = analysis.match(/3\.\s*Suggest 3 additional strong points(.*?)$/s)?.[1];
  let suggestions = [];
  
  if (suggestionsMatch) {
    // Extract numbered or bullet points
    suggestions = suggestionsMatch.match(/(-|\*|\d+\.)\s*(.*?)(?=(-|\*|\d+\.)|$)/sg)
      ?.map(s => s.replace(/(-|\*|\d+\.)\s*/, '').trim())
      .filter(s => s) || [];
  }
  
  // If we couldn't extract suggestions, provide a fallback
  if (suggestions.length === 0) {
    suggestions = ['No specific suggestions found'];
  }
  
  return {
    grammar: grammarSection || 'Grammar analysis not available',
    factual: factualSection || 'Factual verification not available',
    suggestions
  };
}

module.exports = router;