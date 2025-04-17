import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export async function transcribeAudio(audioFilePath) {
  return new Promise((resolve, reject) => {
    const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
    const convertedAudioPath = path.join(path.dirname(audioFilePath), `${baseName}.wav`);
    const outputPath = path.join(path.dirname(audioFilePath), `${baseName}.txt`);

    console.log('🎧 Converting audio using FFmpeg...');

    const ffmpeg = spawn('ffmpeg', ['-i', audioFilePath, '-ar', '16000', '-ac', '1', convertedAudioPath]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ FFmpeg conversion failed with code ${code}`);
        return reject(new Error('FFmpeg conversion failed'));
      }

      console.log('✅ FFmpeg conversion done. Running Whisper...');

      const whisper = spawn('whisper', [convertedAudioPath, '--model', 'medium', '--output_dir', path.dirname(audioFilePath), '--output_format', 'txt']);

      whisper.stdout.on('data', (data) => {
        console.log(`Whisper: ${data}`);
      });

      whisper.stderr.on('data', (data) => {
        console.error(`Whisper stderr: ${data}`);
      });

      whisper.on('close', (code) => {
        if (code !== 0) {
          console.error(`❌ Whisper transcription failed with code ${code}`);
          return reject(new Error('Whisper transcription failed'));
        }

        // Read the generated transcript file
        fs.readFile(outputPath, 'utf8', (err, transcript) => {
          if (err) {
            console.error('❌ Error reading transcript:', err);
            return reject(err);
          }

          console.log('📝 Final Transcript:', transcript);
          resolve(transcript.trim());
        });
      });
    });
  });
}
