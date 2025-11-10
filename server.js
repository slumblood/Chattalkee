import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Use PORT from environment with fallback
const PORT = process.env.PORT || 3001;

// CORS configuration for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
};

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (required for production)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: 'bolt.new'
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Walkie Talkie WebApp',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    webrtc: true,
    websockets: true
  });
});

// Store active rooms and users
const activeRooms = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  userSockets.set(socket.id, { room: null, userId: socket.id });

  // Join a room
  socket.on('join-room', (roomId, userData) => {
    try {
      console.log(`🎯 User ${userData.username || socket.id} joining room ${roomId}`);
      
      // Leave previous room if any
      if (userSockets.get(socket.id)?.room) {
        const previousRoom = userSockets.get(socket.id).room;
        socket.leave(previousRoom);
      }
      
      // Initialize room if it doesn't exist
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Map());
      }
      
      const room = activeRooms.get(roomId);
      room.set(socket.id, {
        id: socket.id,
        username: userData.username || `User-${socket.id.slice(-4)}`,
        joinedAt: new Date()
      });
      
      // Update user socket data
      userSockets.set(socket.id, { 
        room: roomId, 
        userId: socket.id,
        username: userData.username 
      });
      
      socket.join(roomId);
      
      // Notify others in the room
      socket.to(roomId).emit('user-connected', {
        userId: socket.id,
        username: userData.username,
        roomUsers: Array.from(room.values())
      });
      
      // Send current room state to the new user
      const roomUsers = Array.from(room.values());
      socket.emit('room-joined', {
        roomId,
        users: roomUsers,
        yourId: socket.id
      });
      
      console.log(`✅ Room ${roomId} now has ${room.size} users`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // WebRTC signaling: Offer
  socket.on('webrtc-offer', (data) => {
    socket.to(data.targetUserId).emit('webrtc-offer', {
      offer: data.offer,
      fromUserId: socket.id,
      fromUsername: userSockets.get(socket.id)?.username
    });
  });

  // WebRTC signaling: Answer
  socket.on('webrtc-answer', (data) => {
    socket.to(data.targetUserId).emit('webrtc-answer', {
      answer: data.answer,
      fromUserId: socket.id
    });
  });

  // WebRTC signaling: ICE Candidate
  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.targetUserId).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      fromUserId: socket.id
    });
  });

  // Push-to-talk state
  socket.on('user-talking', (data) => {
    const userData = userSockets.get(socket.id);
    if (userData?.room) {
      socket.to(userData.room).emit('user-talking', {
        userId: socket.id,
        username: userData.username,
        isTalking: data.isTalking
      });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    const userData = userSockets.get(socket.id);
    if (userData?.room) {
      const roomId = userData.room;
      
      // Remove user from room
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        room.delete(socket.id);
        
        // Notify others
        socket.to(roomId).emit('user-disconnected', {
          userId: socket.id,
          username: userData.username,
          roomUsers: Array.from(room.values())
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          activeRooms.delete(roomId);
          console.log(`🗑️  Room ${roomId} deleted (empty)`);
        }
      }
    }
    
    // Remove user from tracking
    userSockets.delete(socket.id);
  });

  // Leave room explicitly
  socket.on('leave-room', () => {
    const userData = userSockets.get(socket.id);
    if (userData?.room) {
      const roomId = userData.room;
      
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        room.delete(socket.id);
        
        socket.leave(roomId);
        socket.to(roomId).emit('user-disconnected', {
          userId: socket.id,
          username: userData.username,
          roomUsers: Array.from(room.values())
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          activeRooms.delete(roomId);
        }
      }
      
      // Update user data
      userSockets.set(socket.id, { ...userData, room: null });
      socket.emit('room-left', { roomId });
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Walkie Talkie Server Started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`⚡ Platform: Bolt.new`);
});