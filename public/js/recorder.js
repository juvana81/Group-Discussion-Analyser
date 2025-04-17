let mediaRecorder;
let audioChunks = [];

const recordButton = document.getElementById('recordButton');
let isRecording = false;

recordButton.addEventListener('click', async () => {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Preview
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = audioUrl;
      document.body.appendChild(audio);

      // Enable upload
      const uploadBtn = document.getElementById('uploadBtn');
      uploadBtn.disabled = false;

      // Store for upload
      uploadBtn.onclick = () => uploadAudio(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    recordButton.textContent = 'Stop Recording';
  } else {
    mediaRecorder.stop();
    isRecording = false;
    recordButton.textContent = 'Start Recording';
  }
});

async function uploadAudio(blob) {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('participantId', document.getElementById('participantId').value);

  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  alert('✅ Feedback: ' + result.feedback);
}
