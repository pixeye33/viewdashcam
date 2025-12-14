# ViewDashCam

> **Note:** This project is entirely coded by AI. A secondary goal of this project is to see how bad of a dev I can be and still have a working project.

A powerful, privacy-focused web app for reviewing multi-angle dashcam footage. ViewDashCam provides synchronized playback, frame-by-frame analysis, and real-time telemetry overlays for Tesla vehicles - all running 100% in your browser with zero uploads.

## Live Demo

Try it now at: [https://viewdash.cam/](https://viewdash.cam/)

## Major Features

### 🎥 Perfect Multi-Angle Sync
View up to 6 camera angles simultaneously, all perfectly synchronized. Switch between angles instantly while maintaining playback position across all views.

### ⚡ Frame-by-Frame Precision
Step through footage one frame at a time using WebCodecs technology. Perfect for analyzing critical moments or reviewing incidents in detail.

### 🚗 Tesla Telemetry Overlay
ViewDashCam automatically extracts and displays real-time vehicle data from Tesla dashcam videos:
- **Speed** (mph/km/h with unit toggle)
- **Gear State** (P/D/R/N)
- **Steering Wheel Angle** with visual indicator
- **Accelerator & Brake Status**
- **Turn Signals & Blinkers**
- **Autopilot State** (None/Self Driving/Autosteer/TACC) - Always visible
- **GPS Coordinates & Heading**
- **3-Axis Acceleration** (X/Y/Z)

### 📊 Visual Timeline with Brake Indicators
See exactly when braking occurred with visual markers on the progress bar - instantly identify important moments without scrubbing through footage.

### 🎮 Complete Keyboard Control
Navigate your footage efficiently with comprehensive keyboard shortcuts for playback, speed control, and angle switching.

### 🔒 100% Private & Secure
All video processing happens in your browser. No uploads, no servers, no data collection. Your footage never leaves your device.

## All Features

### Multi-Angle Playback
- **Synchronized Playback** - All camera angles stay perfectly in sync
- **Multi-Event Management** - Load and switch between multiple incidents/trips
- **Drag & Drop** - Drop video files or entire folders to start instantly
- **Smart UI** - Events panel auto-hides for single events
- **Supports all formats** - MP4, WebM, OGG, MOV, etc.

### Precision Controls
- **Frame-by-Frame Navigation** - Step through videos one frame at a time using arrow keys
- **WebCodecs Integration** - Hardware-accelerated frame rendering for smooth navigation
- **Variable Speed** - 0.25x to 2x playback speed with one-key shortcuts (Q/W/E/R/T/Y)
- **Quick Seek** - Jump 10 seconds forward/backward
- **Interactive Progress Bar** - Click to seek, hover for preview thumbnails
- **Visual Brake Timeline** - Red markers show exactly when brakes were applied

### Tesla Integration
- **Automatic SEI Detection** - Extracts embedded telemetry from Tesla videos
- **Real-Time Overlay** - All vehicle data displayed in sync with video
- **Multi-Angle Support** - View telemetry from any camera angle
- **Speed Unit Toggle** - Switch between mph and km/h
- **SEI Debug Mode** - View raw telemetry data across all angles (press 'D' key)

### User Experience
- **Clean Modern UI** - Minimalist design that stays out of your way
- **Full Keyboard Control** - Navigate everything without touching the mouse
- **Help System** - Built-in shortcuts reference (click Help button)
- **Responsive Design** - Works on desktop and large tablets
- **No Installation** - Run directly from your browser

## Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/pixeye33/viewdashcam.git
cd viewdashcam

# Install dependencies
bun install

# Start development server
bun run dev
```

The app will be available at `http://localhost:5173`

### Prerequisites

- [Bun](https://bun.sh/) runtime (required)

### Build

```bash
# Build for production
bun run build

# Preview production build
bun run preview

# Build and serve with production server
bun run serve
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

## Keyboard Shortcuts

### Playback Controls
- **Space** - Play/Pause
- **←** - Previous frame (30fps)
- **→** - Next frame (30fps)
- **Shift + ←** - Jump back 10 seconds
- **Shift + →** - Jump forward 10 seconds

### Playback Speed
- **Q** - 0.25x speed
- **W** - 0.5x speed
- **E** - 1x speed (normal)
- **R** - 1.25x speed
- **T** - 1.5x speed
- **Y** - 2x speed

### Camera Angles
- **1-9** - Select camera angle directly
- **↑** - Previous angle
- **↓** - Next angle

### Interface
- **Click Date/Time Display** - Toggle controls and events panel visibility
- **D** - Toggle SEI Debug Modal (view raw telemetry data)

## Tesla Dashcam Support

ViewDashCam includes native support for **Tesla dashcam videos** with SEI (Supplemental Enhancement Information) metadata extraction:

- Automatically detects and displays vehicle telemetry overlay on the **front camera** view
- No additional setup required - just drag and drop your Tesla dashcam videos
- All Tesla dashcam metadata is extracted and displayed in real-time as you review footage
- The SEI overlay appears only when viewing the front camera angle

**Note:** SEI metadata is embedded in Tesla dashcam videos since approximately 2019. Older videos may not contain this data.

## Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch. The deployment is handled by GitHub Actions.

To enable GitHub Pages for your fork:
1. Go to your repository settings
2. Navigate to Pages
3. Set the source to "GitHub Actions"

## License

ISC
