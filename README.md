# ViewDashCam

> **Note:** This project is entirely coded by AI. A secondary goal of this project is to see how bad of a dev I can be and still have a working project.

A frontend-only React app for synchronized multi-angle video playback. Perfect for dashcam footage review and any scenario where you need to view multiple camera angles of the same event. Built with React and Vite.

## What Problem Does It Solve?

If you have **dashcam footage** or **multi-camera recordings** from different angles, ViewDashCam helps you:
- **Review incidents efficiently** by viewing all camera angles simultaneously
- **Manage multiple events** in a single session (e.g., multiple trips or incidents)
- **Stay synchronized** - all angles play together perfectly aligned
- **Maintain privacy** - everything processes locally in your browser, no uploads required

## Features

- **Multi-Event Support** - Load videos from multiple events/incidents and switch between them instantly
- **Multi-Angle Synchronized Playback** - View all camera angles of an event in perfect sync
- **Smart Panel Hiding** - Events panel auto-hides for single events, toggle by clicking the datetime
- **Drag and drop** video files to play them instantly
- **Browser-based playback** - supports all common video formats (MP4, WebM, OGG, etc.)
- **Clean, modern UI** with smooth animations and responsive design

## Privacy & Security

**All processing happens locally in your browser.** No data is uploaded to any server. Your video files never leave your device. The app is completely frontend-only and works entirely offline after the initial page load.

## Live Demo

The app is deployed at: [https://viewdash.cam/](https://viewdash.cam/)

## Local Development

### Prerequisites

- Node.js (v20 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/pixeye33/viewdashcam.git
cd viewdashcam

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

## How to Use

### Video File Naming

Name your videos using this pattern: `YYYY-MM-DD_HH-MM-SS-angle.mp4`

**Examples:**
- `2025-12-06_14-30-45-front.mp4`
- `2025-12-06_14-30-45-rear.mp4`
- `2025-12-06_14-30-45-left.mp4`
- `2025-12-06_16-15-20-front.mp4` (different event)

- The **datetime** groups videos into events (all videos with the same datetime are one event)
- The **angle** identifies the camera view (front, rear, left, right, cabin, etc.)

### Basic Usage

1. **Load videos**: Drag and drop multiple video files onto the page (or click "Browse Files")
2. **Auto-grouping**: Videos are automatically organized by datetime into separate events
3. **Playback**: The oldest event loads first, showing all its camera angles
4. **Switch angles**: Click any camera thumbnail to view that angle (all stay synchronized)

### Multi-Event Features

- **Events Panel**: When you have multiple events, a panel appears on the left showing all available events
- **Switch events**: Click any event in the panel to load that set of videos
- **Auto-hide**: If you only load one event, the panel automatically hides for a cleaner view
- **Toggle panel**: Click the **datetime display** at the top to show/hide the Events Panel

### Viewing Experience

- All camera angles stay **perfectly synchronized**
- The **datetime display** shows the current timestamp (event time + video position)
- Select any angle to make it the main view while keeping others in sync

## Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch. The deployment is handled by GitHub Actions.

To enable GitHub Pages for your fork:
1. Go to your repository settings
2. Navigate to Pages
3. Set the source to "GitHub Actions"

## License

ISC
