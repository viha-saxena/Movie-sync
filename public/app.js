/*
 * app.js
 * Merged logic for 3D Cinema, Local File Sync, and YouTube Sync
 * FIX: Added 'hasExperienceStarted' flag to prevent black screen race condition.
 */

// --- Part 1: Connect to the Server (No changes needed) ---
const socket = io();

socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.warn('Disconnected from server.');
});

// --- Part 2: Get HTML Elements ---
const enterCinemaBtn = document.getElementById('enter-cinema-btn');
const controlsOverlay = document.querySelector('.controls-overlay');
const scene = document.querySelector('.scene');
const fileLoader = document.getElementById('file-loader');
const loaderSubtitle = document.getElementById('loader-subtitle');

// Local Player
const videoPlayer = document.getElementById('movie-player');
const fileInput = document.getElementById('file-input');

// YouTube Player
const youtubePlayerContainer = document.getElementById('youtube-player-container'); // This is the div
const youtubeUrlInput = document.getElementById('youtube-url');
const loadYoutubeBtn = document.getElementById('load-youtube-btn');
// REMOVED: Quality selector element

// Effects and Credits
const canvas = document.getElementById('clonePlayerCanvas');
const ctx = canvas.getContext('2d');
const footer = document.querySelector('footer');

// --- Part 3: Player State and Logic ---
let enterCinema = true; // Flag to control camera movement
let allowParallax = true; // Flag to control parallax after file load
let isSyncing = false; // Flag to prevent event loops from socket events

let currentPlayerType = null; // 'LOCAL' or 'YOUTUBE'
let ytPlayer = null; // Will hold the YouTube Player object
let isPlayerReady = false; // Flag for YouTube API ready state
let videoIdToLoad = null; // Buffer for video ID
let hasExperienceStarted = false; // FIX: Flag to prevent black screen race condition

// --- Part 4: YouTube IFrame API Setup ---

// This function is called by the YouTube API script when it's ready
function onYouTubeIframeAPIReady() {
  console.log("YouTube API script loaded");
  if (!ytPlayer) { // Ensure we only create one player
      ytPlayer = new YT.Player('youtube-player-container', {
          height: '100%',
          width: '100%',
          playerVars: {
              'playsinline': 1,
              'controls': 1, // Use YouTube's built-in controls
              'rel': 0, // Don't show related videos
          },
          events: {
              'onReady': onPlayerReady,
              'onStateChange': onPlayerStateChange
          }
      });
  }
}

// The API will call this function when the video player is ready.
function onPlayerReady(event) {
  console.log("YouTube Player is READY.");
  isPlayerReady = true; // Set the flag
  
  // If a video was waiting to be loaded, load it now
  if (videoIdToLoad) {
    console.log("Player is ready, loading buffered video ID:", videoIdToLoad);
    ytPlayer.loadVideoById(videoIdToLoad);
    videoIdToLoad = null; // Clear the buffer
  }
}

// The API calls this function when the player's state changes.
function onPlayerStateChange(event) {
  
  // FIX: Check if this is the first play/buffer event to start the experience
  if (!hasExperienceStarted && (event.data == YT.PlayerState.PLAYING || event.data == YT.PlayerState.BUFFERING)) {
    // This is the first time the video is actually playing or buffering
    // NOW it's safe to start the experience
    
    // --- THIS IS THE FIX ---
    hasExperienceStarted = true; // Set the flag so this doesn't run again
    // -----------------------

    startMovieExperience('YOUTUBE');
  }

  // Handle sync events
  if (event.data == YT.PlayerState.PLAYING) {
    // Don't send sync event if we are in the middle of a sync
    if (isSyncing) return;
    sendSyncEvent('PLAY');
  } 
  else if (event.data == YT.PlayerState.PAUSED) {
    if (isSyncing) return;
    sendSyncEvent('PAUSE');
  } else if (event.data == YT.PlayerState.ENDED) {
    runEndCredits();
  }
}

// --- Part 5: The New Cinema Experience Flow ---

// STEP 1: User clicks "Enter Cinema"
enterCinemaBtn.addEventListener('click', () => {
  enterCinema = true; // Prevent mouse movement during animation
  
  gsap.to(controlsOverlay, { autoAlpha: 0, duration: 0.5, ease: "power4.out" });

  gsap.fromTo(
    scene,
    { z: "-500px", rotateY: "0deg", rotateX: "80deg" },
    {
      z: "600px",
      rotateY: "0deg",
      rotateX: "100deg",
      ease: "power2.in",
      duration: 5,
      onComplete: () => {
        // STEP 2: Show the file loader, "Lights On"
        gsap.to(fileLoader, { autoAlpha: 1, duration: 0.8, pointerEvents: 'auto' });
        enterCinema = false; // Allow mouse movement for parallax effect
      }
    }
  );
});

// STEP 3A: User selects a LOCAL FILE
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const fileURL = URL.createObjectURL(file);
  videoPlayer.src = fileURL;
  
  console.log(`Local file '${file.name}' loaded.`);
  
  currentPlayerType = 'LOCAL';
  hasExperienceStarted = true; // Local files start immediately
  startMovieExperience('LOCAL');
});

// STEP 3B: User loads a YOUTUBE URL
loadYoutubeBtn.addEventListener('click', () => {
  const url = youtubeUrlInput.value;
  const videoId = parseYouTubeVideoId(url);

  if (videoId) {
    console.log(`YouTube video ID '${videoId}' found.`);
    loaderSubtitle.textContent = "Loading YouTube video...";
    
    currentPlayerType = 'YOUTUBE'; // Set this so sync events know what to do

    // Don't load immediately. Wait for the player to be ready.
    if (isPlayerReady && ytPlayer) {
        console.log("Player is ready, loading immediately.");
        ytPlayer.loadVideoById(videoId);
    } else {
        console.warn("Player not ready, buffering video ID.");
        videoIdToLoad = videoId; // Store the ID to be loaded by onPlayerReady
        if (!ytPlayer) {
          console.log("Player object not found, API might be slow.");
        }
    }
    
    // REMOVED: Don't start the experience here. Wait for onPlayerStateChange.

  } else {
    loaderSubtitle.textContent = "Invalid YouTube URL. Please try again.";
    youtubeUrlInput.value = "";
  }
});

// REMOVED: Handle quality change event listener

function parseYouTubeVideoId(url) {
    if (!url) return null;
    // Standard URLs
    let match = url.match(/[?&]v=([^&]+)/);
    if (match) return match[1];
    // Shortened youtu.be URLs
    match = url.match(/youtu\.be\/([^?&]+)/);
    if (match) return match[1];
    // Embedded URLs
    match = url.match(/\/embed\/([^?&]+)/);
    if (match) return match[1];
    
    return null; // No match found
}

// STEP 4: Hide loader, show player, turn off lights
function startMovieExperience(playerType) {
  // This function is now only called when the video is ready to be seen
  
  allowParallax = false;
  scene.classList.add('darken'); // "Lights Off"
  footer.classList.remove('run-credits');
  loaderSubtitle.textContent = "Load a file, or paste a YouTube URL."; // Reset subtitle

  gsap.to(fileLoader, { autoAlpha: 0, duration: 0.5, pointerEvents: 'none' }); 

  if (playerType === 'LOCAL') {
    gsap.to(videoPlayer, { autoAlpha: 1, duration: 0.5, delay: 0.5, pointerEvents: 'auto' });
    gsap.to('#youtube-player-container', { autoAlpha: 0, pointerEvents: 'none' }); // Hide other player
  } else if (playerType === 'YOUTUBE') {
    // We target the IFRAME by its ID now
    gsap.to('#youtube-player-container', { autoAlpha: 1, duration: 0.5, delay: 0.5, pointerEvents: 'auto' });
    gsap.to(videoPlayer, { autoAlpha: 0, pointerEvents: 'none' }); // Hide other player
  }
}

// --- Part 6: SEND Events (Intelligent) ---
function sendSyncEvent(action) {
  if (isSyncing) return;
  
  let timestamp = 0;
  
  if (currentPlayerType === 'LOCAL') {
    timestamp = videoPlayer.currentTime;
  } else if (currentPlayerType === 'YOUTUBE' && ytPlayer && ytPlayer.getCurrentTime) {
    timestamp = ytPlayer.getCurrentTime();
  }

  console.log(`Action (SEND): ${action} to ${timestamp}s`);
  socket.emit('sync-event', {
    action: action,
    timestamp: timestamp
  });
}

// Local player event listeners
videoPlayer.addEventListener('play', () => sendSyncEvent('PLAY'));
videoPlayer.addEventListener('pause', () => sendSyncEvent('PAUSE'));
videoPlayer.addEventListener('seeked', () => sendSyncEvent('SEEK'));
videoPlayer.addEventListener("ended", runEndCredits); // Local player end event

// --- Part 7: RECEIVE Events (Intelligent) ---
socket.on('sync-event', (data) => {
  console.log(`Action (RECEIVE): ${data.action} to ${data.timestamp}s`);

  isSyncing = true;
  
  if (currentPlayerType === 'LOCAL') {
    videoPlayer.currentTime = data.timestamp;
    if (data.action === 'PLAY') {
      videoPlayer.play();
    } else if (data.action === 'PAUSE') {
      videoPlayer.pause();
    }
  } 
  else if (currentPlayerType === 'YOUTUBE' && ytPlayer && ytPlayer.seekTo) {
    // Seek to the new time
    // Check if player state is different to avoid redundant calls
    const playerState = ytPlayer.getPlayerState();
    
    ytPlayer.seekTo(data.timestamp, true);
    
    if (data.action === 'PLAY' && playerState !== YT.PlayerState.PLAYING) {
      ytPlayer.playVideo();
    } else if (data.action === 'PAUSE' && playerState !== YT.PlayerState.PAUSED) {
      ytPlayer.pauseVideo();
    }
  }

  // Set a short timeout to prevent event loops
  setTimeout(() => {
    isSyncing = false; // Typo fixed: was isSinking
  }, 200); // Increased buffer for YouTube API
});


// --- Part 8: Parallax and Visual Effects ---

// Mouse move for parallax effect
$(document).mousemove(function (event) {
  if (enterCinema === false && allowParallax === true) { 
    const xPos = event.clientX / $(window).width() - 0.5;
    const yPos = event.clientY / $(window).height() - 0.5;
    gsap.to(scene, {
      duration: 0.6,
      rotationY: 0 + xPos * 25,
      rotationX: 100 + -yPos * 15,
      ease: "power4.out"
    });
  }
});

// Mouse wheel for zoom effect
$(window).on("mousewheel", function (event) {
  if (enterCinema === false && allowParallax === true) { 
    if (event.originalEvent.wheelDelta >= 0) {
      gsap.to(scene, { duration: 0.3, z: "+=10", ease: "power4.out" });
    } else {
      gsap.to(scene, { duration: 0.3, z: "-=10", ease: "power4.out" });
    }
  }
});

// Canvas blur effect for the video player glow (only for local player)
let timerID;
videoPlayer.addEventListener("play", function () {
  timerID = window.setInterval(function () {
    ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
  }, 30);
});

function stopTimer() {
  window.clearInterval(timerID);
}

videoPlayer.addEventListener("pause", stopTimer);
videoPlayer.addEventListener("ended", stopTimer);


// --- Part 9: End Credits (Refactored) ---
function runEndCredits() {
  console.log("Movie ended, running credits.");
  
  // "Lights On"
  scene.classList.remove('darken');
  allowParallax = true; // Allow camera movement again
  hasExperienceStarted = false; // Reset the experience flag

  // 1. Smoothly remove the movie player
  let playerToHide = (currentPlayerType === 'LOCAL') ? videoPlayer : '#youtube-player-container';
  gsap.to(playerToHide, { 
    autoAlpha: 0, 
    duration: 1.5, 
    pointerEvents: 'none' 
  });
  
  // 2. Show the file loader again
  gsap.to(fileLoader, { 
    autoAlpha: 1, 
    duration: 1.5, 
    delay: 1.0, // Wait for player to fade
    pointerEvents: 'auto'
  });
  
  // 3. Trigger the footer credits animation
  footer.classList.add('run-credits');
  
  // 4. Reset player state
  if (currentPlayerType === 'YOUTUBE' && ytPlayer) {
    ytPlayer.stopVideo(); // Stop it from doing anything
    gsap.to('#youtube-player-container', { autoAlpha: 0 }); // Ensure it's hidden
  } else {
    videoPlayer.src = ""; // Clear the local file
  }
  currentPlayerType = null;
}


