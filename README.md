# 🎯 Walkie Talkie WebApp for Bolt.new

A production-ready, real-time walkie talkie web application optimized for deployment on Bolt.new.

## 🚀 Features

- **Real-time Voice Communication**: WebRTC-based peer-to-peer audio
- **Push-to-Talk**: Familiar walkie talkie interface
- **Multi-user Rooms**: Support for multiple users in the same room
- **Production Ready**: Environment variables, error handling, health checks
- **Mobile Optimized**: Responsive design for all devices
- **Bolt.new Optimized**: Specific configuration for seamless deployment

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time**: WebRTC for audio, Socket.io for signaling
- **Platform**: Bolt.new (Node.js environment)

## 📦 Deployment on Bolt.new

1. **Create a new project** on [Bolt.new](https://bolt.new)
2. **Upload this codebase** or connect your GitHub repository
3. **Set environment variables** in Bolt dashboard:
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-app-name.bolt.new`
4. **Deploy** - Bolt will automatically detect the Node.js app and deploy

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `production` |

## 🎮 Usage

1. **Join a Room**: Enter a room name and your username
2. **Share Room Name**: Give the room name to others to join
3. **Press to Talk**: Hold the button to speak, release to listen
4. **See Active Users**: View all connected users in the room

## 🔒 Security Features

- CORS configuration for production
- Input validation and sanitization
- Error handling and user feedback
- Secure WebRTC configuration

## 📱 Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 🐛 Troubleshooting

**Microphone Access Issues:**
- Ensure browser permissions are granted
- Check if microphone is not being used by another app
- Try refreshing the page

**Connection Issues:**
- Check internet connection
- Verify Bolt.new service status
- Check browser console for errors

## 📄 License

MIT License - feel free to use for your projects!

---

**Deployed on ⚡ Bolt.new** | **Powered by WebRTC & Socket.io**