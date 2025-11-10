class WalkieTalkieApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peerConnections = {};
        this.roomId = null;
        this.userId = this.generateUserId();
        this.username = 'User';
        this.isConnected = false;
        this.isTalking = false;
        
        // Use relative path for Socket.io in production
        this.backendUrl = window.location.origin;
        
        this.initializeApp();
    }

    generateUserId() {
        return 'user-' + Math.random().toString(36).substr(2, 9);
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.initializeSocket();
        this.showNotification('App initialized successfully', 'success');
    }

    async initializeSocket() {
        try {
            console.log('🔌 Connecting to server:', this.backendUrl);
            this.socket = io(this.backendUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to signaling server');
                this.updateStatus('Connected to server', 'connected');
                this.showNotification('Connected to server', 'success');
                this.isConnected = true;
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Disconnected from server:', reason);
                this.updateStatus('Disconnected', 'disconnected');
                this.showNotification('Lost connection to server', 'error');
                this.isConnected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.error('🚨 Connection error:', error);
                this.updateStatus('Connection failed', 'disconnected');
                this.showNotification('Failed to connect to server', 'error');
            });

            this.socket.on('room-joined', (data) => {
                console.log('✅ Joined room:', data.roomId);
                this.roomId = data.roomId;
                this.updateRoomUI(data.roomId, data.users);
                this.showNotification(`Joined room: ${data.roomId}`, 'success');
                
                // Initialize WebRTC connections with existing users
                data.users.forEach(user => {
                    if (user.id !== this.userId) {
                        this.createPeerConnection(user.id);
                    }
                });
            });

            this.socket.on('user-connected', (data) => {
                console.log('👤 User connected:', data.username);
                this.addUserToList(data.userId, data.username, false);
                this.updateUsersCount();
                this.showNotification(`${data.username} joined the room`, 'info');
                
                // Create WebRTC connection with new user
                this.createPeerConnection(data.userId);
            });

            this.socket.on('user-disconnected', (data) => {
                console.log('👋 User disconnected:', data.username);
                this.removeUserFromList(data.userId);
                this.removePeerConnection(data.userId);
                this.updateUsersCount();
                this.showNotification(`${data.username} left the room`, 'warning');
            });

            this.socket.on('room-left', (data) => {
                console.log('🚪 Left room:', data.roomId);
                this.leaveRoomCleanup();
                this.showNotification(`Left room: ${data.roomId}`, 'info');
            });

            // WebRTC Signaling
            this.socket.on('webrtc-offer', async (data) => {
                console.log('📨 Received WebRTC offer from:', data.fromUsername);
                await this.handleWebRTCOffer(data.offer, data.fromUserId);
            });

            this.socket.on('webrtc-answer', async (data) => {
                console.log('📨 Received WebRTC answer from:', data.fromUserId);
                await this.handleWebRTCAnswer(data.answer, data.fromUserId);
            });

            this.socket.on('webrtc-ice-candidate', async (data) => {
                console.log('📨 Received ICE candidate from:', data.fromUserId);
                await this.handleICECandidate(data.candidate, data.fromUserId);
            });

            this.socket.on('user-talking', (data) => {
                this.updateUserTalkingState(data.userId, data.isTalking);
                if (data.isTalking) {
                    console.log(`🎤 ${data.username} started talking`);
                }
            });

            this.socket.on('error', (data) => {
                console.error('🚨 Server error:', data);
                this.showNotification(data.message || 'An error occurred', 'error');
            });

        } catch (error) {
            console.error('🚨 Error initializing socket:', error);
            this.showNotification('Failed to initialize connection', 'error');
        }
    }

    setupEventListeners() {
        // Join room
        document.getElementById('joinButton').addEventListener('click', () => this.joinRoom());
        
        // Leave room
        document.getElementById('leaveButton').addEventListener('click', () => this.leaveRoom());
        
        // Enter key for form inputs
        document.getElementById('roomInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Push-to-talk events
        const talkButton = document.getElementById('talkButton');
        talkButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startTalking();
        });
        talkButton.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.stopTalking();
        });
        talkButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startTalking();
        });
        talkButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopTalking();
        });
        talkButton.addEventListener('contextmenu', (e) => e.preventDefault());

        // Prevent audio context suspension
        document.addEventListener('click', () => {
            this.resumeAudioContext();
        }, { once: true });
    }

    async joinRoom() {
        const roomInput = document.getElementById('roomInput');
        const usernameInput = document.getElementById('usernameInput');
        const joinButton = document.getElementById('joinButton');
        
        this.roomId = roomInput.value.trim();
        this.username = usernameInput.value.trim() || 'User';

        if (!this.roomId) {
            this.showNotification('Please enter a room name', 'error');
            return;
        }

        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        try {
            // Show loading state
            joinButton.disabled = true;
            joinButton.querySelector('.btn-text').classList.add('hidden');
            joinButton.querySelector('.btn-loader').classList.remove('hidden');

            await this.getMicrophoneAccess();
            
            this.socket.emit('join-room', this.roomId, {
                username: this.username,
                userId: this.userId
            });
            
        } catch (error) {
            console.error('Error joining room:', error);
            this.showNotification(error.message, 'error');
            
            // Reset button state
            joinButton.disabled = false;
            joinButton.querySelector('.btn-text').classList.remove('hidden');
            joinButton.querySelector('.btn-loader').classList.add('hidden');
        }
    }

    leaveRoom() {
        if (this.roomId && this.socket) {
            this.socket.emit('leave-room');
        }
        this.leaveRoomCleanup();
    }

    leaveRoomCleanup() {
        // Close all peer connections
        Object.keys(this.peerConnections).forEach(userId => {
            this.removePeerConnection(userId);
        });

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Reset UI
        this.showConnectionSection();
        this.updateStatus('Ready to join', 'disconnected');
        
        // Reset room data
        this.roomId = null;
    }

    async getMicrophoneAccess() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                },
                video: false
            });
            
            console.log('🎤 Microphone access granted');
            
            // Initially mute the audio
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            let message = 'Microphone access denied. ';
            if (error.name === 'NotAllowedError') {
                message += 'Please allow microphone permissions in your browser.';
            } else if (error.name === 'NotFoundError') {
                message += 'No microphone found. Please check your audio device.';
            } else {
                message += 'Please check your audio settings.';
            }
            throw new Error(message);
        }
    }

    createPeerConnection(userId) {
        if (this.peerConnections[userId]) {
            return this.peerConnections[userId];
        }

        console.log('🔗 Creating peer connection with:', userId);

        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
                { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
            ],
            sdpSemantics: 'unified-plan'
        });

        // Add local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            console.log('📻 Received remote stream from:', userId);
            const audioElement = document.createElement('audio');
            audioElement.srcObject = event.streams[0];
            audioElement.autoplay = true;
            audioElement.volume = 1.0;
            audioElement.setAttribute('data-user-id', userId);
            
            // Store audio element for later control
            peerConnection.audioElement = audioElement;
            document.body.appendChild(audioElement);
        };

        // ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.roomId) {
                this.socket.emit('webrtc-ice-candidate', {
                    targetUserId: userId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Peer connection state with ${userId}:`, peerConnection.connectionState);
            this.updateTechnicalStatus();
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`🔗 ICE connection state with ${userId}:`, peerConnection.iceConnectionState);
        };

        this.peerConnections[userId] = peerConnection;

        // Create offer for the new connection
        this.createWebRTCOffer(userId);

        return peerConnection;
    }

    async createWebRTCOffer(userId) {
        try {
            const peerConnection = this.peerConnections[userId];
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            await peerConnection.setLocalDescription(offer);

            this.socket.emit('webrtc-offer', {
                targetUserId: userId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating WebRTC offer:', error);
        }
    }

    async handleWebRTCOffer(offer, fromUserId) {
        try {
            const peerConnection = this.createPeerConnection(fromUserId);
            await peerConnection.setRemoteDescription(offer);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.socket.emit('webrtc-answer', {
                targetUserId: fromUserId,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }

    async handleWebRTCAnswer(answer, fromUserId) {
        try {
            const peerConnection = this.peerConnections[fromUserId];
            if (peerConnection) {
                await peerConnection.setRemoteDescription(answer);
            }
        } catch (error) {
            console.error('Error handling WebRTC answer:', error);
        }
    }

    async handleICECandidate(candidate, fromUserId) {
        try {
            const peerConnection = this.peerConnections[fromUserId];
            if (peerConnection) {
                await peerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    removePeerConnection(userId) {
        if (this.peerConnections[userId]) {
            // Remove audio element
            if (this.peerConnections[userId].audioElement) {
                this.peerConnections[userId].audioElement.remove();
            }
            
            this.peerConnections[userId].close();
            delete this.peerConnections[userId];
            console.log('🔌 Removed peer connection:', userId);
        }
    }

    startTalking() {
        if (this.localStream && !this.isTalking) {
            this.isTalking = true;
            
            // Unmute audio track
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });

            // Update UI
            const talkButton = document.getElementById('talkButton');
            talkButton.classList.add('talking');
            talkButton.querySelector('.talk-text').textContent = 'Talking...';

            // Notify other users
            if (this.roomId) {
                this.socket.emit('user-talking', {
                    isTalking: true
                });
            }

            console.log('🎤 Started talking');
        }
    }

    stopTalking() {
        if (this.localStream && this.isTalking) {
            this.isTalking = false;
            
            // Mute audio track
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            // Update UI
            const talkButton = document.getElementById('talkButton');
            talkButton.classList.remove('talking');
            talkButton.querySelector('.talk-text').textContent = 'Press to Talk';

            // Notify other users
            if (this.roomId) {
                this.socket.emit('user-talking', {
                    isTalking: false
                });
            }

            console.log('🔇 Stopped talking');
        }
    }

    updateUserTalkingState(userId, isTalking) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            if (isTalking) {
                userElement.classList.add('user-talking');
                userElement.querySelector('.user-status').textContent = 'Talking...';
            } else {
                userElement.classList.remove('user-talking');
                userElement.querySelector('.user-status').textContent = 'Listening';
            }
        }
    }

    updateRoomUI(roomId, users) {
        // Update room name
        document.getElementById('roomName').textContent = roomId;
        
        // Update users list
        this.updateUsersList(users);
        
        // Show room section
        this.showRoomSection();
        
        // Update technical info
        document.getElementById('userIdDisplay').textContent = this.userId;
        this.updateTechnicalStatus();
    }

    updateUsersList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            this.addUserToList(user.id, user.username, user.id === this.userId);
        });
        
        this.updateUsersCount();
    }

    addUserToList(userId, username, isYou = false) {
        const usersList = document.getElementById('usersList');
        const userElement = document.createElement('div');
        userElement.className = `user-item ${isYou ? 'you' : ''}`;
        userElement.setAttribute('data-user-id', userId);
        
        const avatarText = username.charAt(0).toUpperCase();
        
        userElement.innerHTML = `
            <div class="user-avatar">${avatarText}</div>
            <div class="user-info">
                <div class="user-name">${username} ${isYou ? '(You)' : ''}</div>
                <div class="user-status">${isYou ? 'Ready' : 'Listening'}</div>
            </div>
        `;
        
        usersList.appendChild(userElement);
    }

    removeUserFromList(userId) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.remove();
        }
    }

    updateUsersCount() {
        const usersCount = document.querySelectorAll('.user-item').length;
        document.getElementById('usersCount').textContent = usersCount;
    }

    showRoomSection() {
        document.getElementById('connectionSection').classList.remove('active');
        document.getElementById('roomSection').classList.add('active');
    }

    showConnectionSection() {
        document.getElementById('roomSection').classList.remove('active');
        document.getElementById('connectionSection').classList.add('active');
        
        // Reset join button
        const joinButton = document.getElementById('joinButton');
        joinButton.disabled = false;
        joinButton.querySelector('.btn-text').classList.remove('hidden');
        joinButton.querySelector('.btn-loader').classList.add('hidden');
    }

    updateStatus(message, type = 'disconnected') {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }

    updateTechnicalStatus() {
        const techStatus = document.getElementById('techStatus');
        if (this.isConnected) {
            const activeConnections = Object.keys(this.peerConnections).length;
            techStatus.textContent = `Connected (${activeConnections} peer(s))`;
        } else {
            techStatus.textContent = 'Disconnected';
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${icons[type]}</span>
            <span class="notification-message">${message}</span>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    resumeAudioContext() {
        // This helps with browser autoplay policies
        if (this.localStream) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Walkie Talkie App for Bolt.new');
    window.walkieTalkieApp = new WalkieTalkieApp();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WalkieTalkieApp;
}