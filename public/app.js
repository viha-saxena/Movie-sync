/*
 * app.js
 * Merged logic for 3D Cinema and Movie Sync
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
const videoPlayer = document.getElementById('movie-player');
const fileInput = document.getElementById('file-input');
const canvas = document.getElementById('clonePlayerCanvas');
const ctx = canvas.getContext('2d');
const footer = document.querySelector('footer'); // <-- ADDED FOOTER

let enterCinema = true; // Flag to control camera movement
let allowParallax = true; // Flag to control parallax after file load

// --- Part 3: The New Cinema Experience Flow ---

// STEP 1: User clicks "Enter Cinema"
enterCinemaBtn.addEventListener('click', () => {
  enterCinema = true; // Prevent mouse movement during animation
  
  // Fade out the button overlay
  gsap.to(controlsOverlay, {
    autoAlpha: 0,
    duration: 0.5,
    ease: "power4.out"
  });

  // Animate flying into the cinema
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
        // STEP 2: Animation is complete, show the file loader
        // --- MODIFICATION: DO NOT darken the scene yet ---
        // scene.classList.add('darken'); // <-- REMOVED
        
        gsap.to(fileLoader, { 
          autoAlpha: 1, 
          duration: 0.8,
          pointerEvents: 'auto'
        });
        
        enterCinema = false; // Allow mouse movement for parallax effect
      }
    }
  );
});

// STEP 3: User selects a local movie file
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  
  if (!file) {
    console.log('No file selected.');
    return;
  }
  
  const fileURL = URL.createObjectURL(file);
  
  videoPlayer.src = fileURL;
  console.log(`Movie '${file.name}' loaded successfully!`);
  
  allowParallax = false; 
  
  // --- MODIFICATION: "Lights Off" ---
  // Now we darken the scene, since the movie is loaded
  scene.classList.add('darken');
  
  // Reset footer in case a new movie is loaded
  footer.classList.remove('run-credits'); 

  // STEP 4: Hide the file loader and show the video player
  gsap.to(fileLoader, { autoAlpha: 0, duration: 0.5, pointerEvents: 'none' }); 
  gsap.to(videoPlayer, { autoAlpha: 1, duration: 0.5, delay: 0.5, pointerEvents: 'auto' });
});


// --- Part 4: SEND Events (Your original sync logic) ---
let isSyncing = false;

function sendSyncEvent(action) {
  if (isSyncing) return;
  
  console.log(`Action (SEND): ${action}`);
  socket.emit('sync-event', {
    action: action,
    timestamp: videoPlayer.currentTime
  });
}

videoPlayer.addEventListener('play', () => sendSyncEvent('PLAY'));
videoPlayer.addEventListener('pause', () => sendSyncEvent('PAUSE'));
videoPlayer.addEventListener('seeked', () => sendSyncEvent('SEEK'));


// --- Part 5: RECEIVE Events (Your original sync logic) ---
socket.on('sync-event', (data) => {
  console.log(`Action (RECEIVE): ${data.action} to ${data.timestamp}s`);

  isSyncing = true;
  videoPlayer.currentTime = data.timestamp;

  switch (data.action) {
    case 'PLAY':
      videoPlayer.play();
      break;
    case 'PAUSE':
      videoPlayer.pause();
      break;
    case 'SEEK':
      // currentTime is already set, so nothing extra needed
      break;
  }
  
  // Set a short timeout to prevent event loops
  setTimeout(() => {
    isSyncing = false; // <-- FIXED TYPO (was isSyncV)
  }, 100);
});


// --- Part 6: Parallax and Visual Effects ---

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

// Canvas blur effect for the video player glow
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


// --- Part 7: End Credits (NEW) ---
videoPlayer.addEventListener("ended", () => {
  console.log("Movie ended, running credits.");
  
  // --- MODIFICATION: "Lights On" ---
  // Turn the lights back on
  scene.classList.remove('darken');
  allowParallax = true; // Allow camera movement again

  // 1. Smoothly remove the movie player
  gsap.to(videoPlayer, { 
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
});

