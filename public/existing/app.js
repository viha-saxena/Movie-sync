/*
 * app.js
 * This is all the frontend logic that runs in the browser.
 * It handles loading the file, sending events, and receiving events.
 */

// --- Part 1: Connect to the Server ---
// The 'io()' function comes from the '/socket.io/socket.io.js' script
// It automatically connects to the server that served the webpage.
const socket = io();

// Log connection status
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.warn('Disconnected from server.');
});

// --- Part 2: Get HTML Elements ---
const videoPlayer = document.getElementById('movie-player');
const fileInput = document.getElementById('file-input');

// --- Part 3: Load the Local Movie File ---
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  
  if (!file) {
    console.log('No file selected.');
    return;
  }
  
  // Create a "blob URL" for the local file.
  // The file is NOT uploaded; it stays on your computer.
  const fileURL = URL.createObjectURL(file);
  
  videoPlayer.src = fileURL;
  console.log(`Movie '${file.name}' loaded successfully!`);
});

// --- Part 4: SEND Events (When YOU take an action) ---
// We only want to send events if they were triggered by a *human*.
// The server-side fix (`socket.broadcast.emit`) prevents loops,
// but this flag is still good practice to avoid spamming the
// server if, for example, a 'play' event fires while a 'seek'
// is also being processed.
let isSyncing = false;

function sendSyncEvent(action) {
  // If we are currently processing an event from the server, don't send one.
  if (isSyncing) return;
  
  console.log(`Action (SEND): ${action}`);
  socket.emit('sync-event', {
    action: action,
    timestamp: videoPlayer.currentTime
  });
}

// Send "PLAY" event
videoPlayer.addEventListener('play', () => sendSyncEvent('PLAY'));

// Send "PAUSE" event
videoPlayer.addEventListener('pause', () => sendSyncEvent('PAUSE'));

// Send "SEEK" event (when you skip fwd/back)
videoPlayer.addEventListener('seeked', () => sendSyncEvent('SEEK'));


// --- Part 5: RECEIVE Events (When the OTHER person takes an action) ---

socket.on('sync-event', (data) => {
  console.log(`Action (RECEIVE): ${data.action} to ${data.timestamp}s`);

  // Set the "I'm busy" flag to prevent sending this event back
  isSyncing = true;

  // Set the time *first* to be as accurate as possible
  videoPlayer.currentTime = data.timestamp;

  switch (data.action) {
    case 'PLAY':
      videoPlayer.play();
      break;
    case 'PAUSE':
      videoPlayer.pause();
      break;
    case 'SEEK':
      // The 'currentTime' was already set above, so nothing more to do.
      break;
  }
  
  // After a short delay, release the flag.
  // This gives the browser time to process the 'play' or 'pause'
  // and fire its own events, which we want to ignore.
  setTimeout(() => {
    isSyncing = false;
  }, 100); // 100ms is a safe buffer
});
