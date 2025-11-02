/*
 * server.js
 * This is the core backend for your movie-sync app.
 * It uses Node.js, Express, and Socket.io.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// --- 1. Basic Server Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define the port to run on (use environment variable or default to 3000)
const PORT = process.env.PORT || 3000;

// --- 2. Serve Static Frontend Files ---
// Tell Express to serve all files from the 'public' directory
const publicDirectoryPath = path.join(__dirname, 'public');
app.use(express.static(publicDirectoryPath));

// --- 3. Socket.io Connection Logic ---
io.on('connection', (socket) => {
  console.log('A user connected with ID:', socket.id);

  // Listen for a 'sync-event' from any client
  socket.on('sync-event', (data) => {
    
    // Log what's happening (good for debugging)
    console.log(`Received ${data.action} (at ${data.timestamp}s) from ${socket.id}`);
    
    // This is the key: Broadcast to everyone *except* the sender.
    // This prevents the event loop you were worried about.
    socket.broadcast.emit('sync-event', data);
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- 4. Start the Server ---
server.listen(PORT, () => {
  console.log(`Server running and listening on http://localhost:${PORT}`);
  console.log(`Access the app by opening that URL in your browser.`);
});
