import axios from 'axios';

/**
 * Analyzes a transcript using Mistral AI
 * @param {string} transcript - The transcript to analyze
 * @returns {Promise<string>} - The analysis result
 */
export async function analyzeTranscript(transcript) {
  try {
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: "mistral-small", // or whichever model you're using
        messages: [
          {
            role: "user",
            content: `Analyze this response from a student during a group discussion. 
                     1. Evaluate grammar and coherence. 
                     2. Check factual accuracy. 
                     3. Suggest 3 additional strong points to improve the argument. 
                     Text: "${transcript}"`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing with Mistral AI:', error);
    throw new Error(`Failed to analyze transcript: ${error.message}`);
  }
}
