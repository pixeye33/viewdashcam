# DashView

> **Note:** This project is entirely coded by AI. A secondary goal of this project is to see how bad of a dev I can be and still have a working project.

A simple, elegant frontend-only React app for playing videos via drag-and-drop. Built with React and Vite.

## Features

- **Drag and drop** video files to play them instantly
- **Browser-based playback** - supports all common video formats (MP4, WebM, OGG, etc.)
- **Full-page video player** experience with native HTML5 controls
- **Responsive design** that works on all devices
- **Clean, modern UI** with smooth animations

## Privacy & Security

**All processing happens locally in your browser.** No data is uploaded to any server. Your video files never leave your device. The app is completely frontend-only and works entirely offline after the initial page load.

## Live Demo

The app is deployed on GitHub Pages: [https://pixeye33.github.io/dashview/](https://pixeye33.github.io/dashview/)

## Local Development

### Prerequisites

- Node.js (v20 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/pixeye33/dashview.git
cd dashview

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Usage

1. Open the app in your browser
2. Either drag and drop a video file onto the page, or click "Browse Files" to select one
3. The video will start playing automatically
4. Click "Choose Another Video" to load a different video

## Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch. The deployment is handled by GitHub Actions.

To enable GitHub Pages for your fork:
1. Go to your repository settings
2. Navigate to Pages
3. Set the source to "GitHub Actions"

## License

ISC
