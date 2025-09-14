# Athena - AI Study Copilot 🧠

A beautiful, intelligent study assistant that combines the clean productivity aesthetics of Motion with the friendly, gamified interface patterns of Duolingo. Athena helps students learn more effectively through AI-powered insights, interactive mind mapping, and personalized study guidance.

![Athena UI Preview](https://img.shields.io/badge/UI-Redesigned-purple?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

## ✨ Features

### 🎨 **Modern UI Design**
- **Glassmorphism Interface**: Beautiful translucent cards with backdrop blur effects
- **Purple Gradient Theme**: Cohesive color scheme inspired by productivity and learning
- **Motion-Inspired**: Clean lines, purposeful animations, productivity-focused layouts
- **Duolingo-Inspired**: Friendly micro-interactions, progress indicators, encouraging feedback
- **Inter Typography**: Highly legible font optimized for user interfaces
- **WCAG AA Compliant**: Accessible design with proper color contrast ratios

### 🧠 **AI-Powered Learning**
- **Intelligent Study Assistant**: Claude-powered AI that understands your learning context
- **Memory System**: Persistent learning profile that adapts to your progress
- **Smart Interventions**: Proactive help when you're struggling with concepts
- **Contextual Hints**: AI provides guidance without giving away answers
- **Follow-up Support**: Conversational learning that builds on previous interactions

### 📊 **Learning Analytics**
- **Progress Dashboard**: Visual metrics showing learning milestones and streaks
- **Interactive Mind Maps**: D3.js-powered knowledge visualization
- **Note Management**: Organized study notes with AI integration
- **Activity Tracking**: Monitor your learning patterns and time spent

### 🔧 **Chrome Extension**
- **Sidebar Interface**: Always-accessible AI assistant while browsing
- **Page Context Awareness**: AI understands what you're reading/studying
- **Real-time Help**: Get instant explanations and clarifications
- **Memory Integration**: Your learning profile follows you across websites

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Chrome browser (for extension)
- Claude API key from Anthropic

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd hackMIT
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configure API keys**
   ```bash
   # Create environment file
   cp .env.example .env
   
   # Add your Claude API key to .env
   ANTHROPIC_API_KEY=your_api_key_here
   ```

4. **Configure Chrome extension**
   ```bash
   # Copy config template
   cd ../extension
   cp config.js.example config.js
   
   # Add your API key to config.js
   ```

5. **Start the backend server**
   ```bash
   cd ../backend
   npm start
   ```

6. **Open the web interface**
   - Navigate to `web/index.html` in your browser
   - Or serve the web directory with a local server

7. **Install Chrome extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` folder

## 📁 Project Structure

```
hackMIT/
├── web/                    # Web application
│   ├── index.html         # Learning dashboard
│   ├── chat.html          # AI chat interface
│   ├── mindmap.html       # Interactive mind map
│   └── js/api.js          # API utilities
├── extension/             # Chrome extension
│   ├── manifest.json      # Extension configuration
│   ├── sidebar.html       # Extension UI
│   ├── sidebar-enhanced.js # Enhanced functionality
│   ├── content.js         # Content script
│   ├── background.js      # Service worker
│   └── ai-analyzer.js     # AI integration
├── backend/               # Node.js backend
│   ├── memory-api.js      # Main API server
│   ├── package.json       # Dependencies
│   └── data/              # Data storage
└── README.md             # This file
```

## 🎨 Design System

### Color Palette
- **Primary Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Glass Cards**: `rgba(255, 255, 255, 0.15)` with backdrop blur
- **Text**: White with varying opacity levels for hierarchy
- **Accents**: Purple, orange, teal for different UI elements

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700
- **Optimized**: For screen reading and accessibility

### Components
- **Glassmorphism Cards**: Translucent backgrounds with blur effects
- **Micro-interactions**: Hover effects, ripple animations, scale transforms
- **Progress Indicators**: Circular progress rings, streak counters
- **Responsive Design**: Works on desktop, tablet, and mobile

## 🔧 Configuration

### Backend Setup
See `backend/README-local-setup.md` for detailed backend configuration instructions.

### API Keys
1. **Anthropic Claude API**: Required for AI functionality
2. **Optional**: Tandem DeepSeek API for additional AI features

### Environment Variables
```bash
# Backend (.env)
ANTHROPIC_API_KEY=your_key_here
PORT=3001

# Extension (config.js)
export const ANTHROPIC_API_KEY = "your_key_here";
```

## 📚 Usage

### Web Dashboard
1. **View Progress**: See your learning metrics and achievements
2. **Explore Mind Map**: Visualize knowledge connections
3. **Chat with AI**: Ask questions about your studies

### Chrome Extension
1. **Click the extension icon** to open the sidebar
2. **Ask AI tab**: Get help with current webpage content
3. **Notes tab**: Save important information
4. **Activity tab**: Monitor your learning activity

### AI Features
- **Smart Hints**: Get guidance without spoilers
- **Follow-up Questions**: Build on previous conversations
- **Memory System**: AI remembers your learning preferences
- **Context Awareness**: AI understands what you're studying

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Design Inspiration**: Motion (productivity) + Duolingo (gamification)
- **AI Power**: Anthropic Claude for intelligent tutoring
- **Visualization**: D3.js for interactive mind maps
- **Typography**: Inter font family for optimal readability
- **Icons**: Emoji for friendly, accessible iconography

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Review the setup documentation in `SETUP-CLAUDE.md`
3. Ensure your API keys are configured correctly
4. Verify the backend server is running

---

**Built with ❤️ for better learning experiences**

*Athena combines the best of productivity and gamification to make studying more effective and enjoyable.*
