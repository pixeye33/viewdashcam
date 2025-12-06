import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [videos, setVideos] = useState([])
  const [selectedAngle, setSelectedAngle] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [eventDateTime, setEventDateTime] = useState(null)
  
  const mainVideoRef = useRef(null)
  const thumbnailRefsRef = useRef({})

  // Parse filename to extract datetime and angle
  // Pattern: YYYY-MM-DD_HH-MM-SS-angle.mp4
  const parseFilename = (filename) => {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-(.+)\.(mp4|webm|ogg|mov)$/i)
    if (match) {
      const [, dateTime, angle] = match
      return { dateTime, angle }
    }
    return null
  }

  // Format datetime for display
  const formatDateTime = (dateTimeStr, offsetSeconds = 0) => {
    const [datePart, timePart] = dateTimeStr.split('_')
    const [year, month, day] = datePart.split('-')
    const [hours, minutes, seconds] = timePart.split('-').map(Number)
    
    // Create date object and add offset
    const date = new Date(year, month - 1, day, hours, minutes, seconds)
    date.setSeconds(date.getSeconds() + offsetSeconds)
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files)
    processFiles(files)
  }

  const processFiles = (files) => {
    const videoFiles = files.filter(file => file.type.startsWith('video/'))
    
    if (videoFiles.length === 0) {
      alert('Please drop valid video files')
      return
    }

    // Parse filenames and group by datetime
    const parsedVideos = videoFiles.map(file => {
      const parsed = parseFilename(file.name)
      if (parsed) {
        return {
          file,
          url: URL.createObjectURL(file),
          dateTime: parsed.dateTime,
          angle: parsed.angle
        }
      }
      return null
    }).filter(Boolean)

    if (parsedVideos.length === 0) {
      alert('No videos match the required naming pattern: YYYY-MM-DD_HH-MM-SS-angle.mp4')
      return
    }

    // Group by datetime and get the most common one
    const dateTimeGroups = {}
    parsedVideos.forEach(video => {
      if (!dateTimeGroups[video.dateTime]) {
        dateTimeGroups[video.dateTime] = []
      }
      dateTimeGroups[video.dateTime].push(video)
    })

    // Find the datetime with most videos
    let maxGroup = []
    let selectedDateTime = null
    Object.entries(dateTimeGroups).forEach(([dateTime, group]) => {
      if (group.length > maxGroup.length) {
        maxGroup = group
        selectedDateTime = dateTime
      }
    })

    setVideos(maxGroup)
    setEventDateTime(selectedDateTime)
    
    // Select 'front' angle by default, or first angle if 'front' doesn't exist
    const frontVideo = maxGroup.find(v => v.angle.toLowerCase() === 'front')
    setSelectedAngle(frontVideo ? frontVideo.angle : maxGroup[0].angle)
  }

  const handleThumbnailClick = (angle) => {
    setSelectedAngle(angle)
    // Sync the new main video to current time
    if (mainVideoRef.current) {
      const currentTime = mainVideoRef.current.currentTime
      setTimeout(() => {
        if (mainVideoRef.current) {
          mainVideoRef.current.currentTime = currentTime
        }
      }, 0)
    }
  }

  // Synchronize all videos when main video plays/pauses
  const handleMainVideoPlay = () => {
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && ref.paused) {
        ref.play().catch(() => {})
      }
    })
  }

  const handleMainVideoPause = () => {
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && !ref.paused) {
        ref.pause()
      }
    })
  }

  // Synchronize time across all videos
  const handleMainVideoTimeUpdate = () => {
    if (!mainVideoRef.current) return
    
    const currentTime = mainVideoRef.current.currentTime
    setCurrentTime(currentTime)
    
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && Math.abs(ref.currentTime - currentTime) > 0.3) {
        ref.currentTime = currentTime
      }
    })
  }

  // Sync seeking
  const handleMainVideoSeeking = () => {
    if (!mainVideoRef.current) return
    
    const currentTime = mainVideoRef.current.currentTime
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref) {
        ref.currentTime = currentTime
      }
    })
  }

  const handleClearVideos = () => {
    // Clean up URLs
    videos.forEach(video => {
      URL.revokeObjectURL(video.url)
    })
    setVideos([])
    setSelectedAngle(null)
    setEventDateTime(null)
    setCurrentTime(0)
  }

  const selectedVideo = videos.find(v => v.angle === selectedAngle)

  return (
    <div 
      className={`app-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {videos.length === 0 ? (
        <div className="drop-zone">
          <div className="drop-content">
            <svg 
              className="upload-icon" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <h1>Drop your videos here</h1>
            <p>or</p>
            <label className="file-input-label">
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileInput}
                className="file-input"
                multiple
              />
              Browse Files
            </label>
            <p className="file-info">
              Videos must follow pattern: YYYY-MM-DD_HH-MM-SS-angle.mp4
            </p>
          </div>
        </div>
      ) : (
        <div className="video-container">
          {/* Event DateTime Display */}
          {eventDateTime && (
            <div className="datetime-display">
              {formatDateTime(eventDateTime, Math.floor(currentTime))}
            </div>
          )}

          {/* Main Video Player */}
          <div className="main-player">
            {selectedVideo && (
              <video
                ref={mainVideoRef}
                src={selectedVideo.url}
                controls
                autoPlay
                className="video-player main"
                onPlay={handleMainVideoPlay}
                onPause={handleMainVideoPause}
                onTimeUpdate={handleMainVideoTimeUpdate}
                onSeeking={handleMainVideoSeeking}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Thumbnail Videos */}
          <div className="thumbnail-container">
            {videos.map((video) => (
              <div 
                key={video.angle}
                className={`thumbnail-wrapper ${video.angle === selectedAngle ? 'active' : ''}`}
                onClick={() => handleThumbnailClick(video.angle)}
              >
                <video
                  ref={(el) => {
                    thumbnailRefsRef.current[video.angle] = el
                  }}
                  src={video.url}
                  className="video-player thumbnail"
                  muted
                >
                  Your browser does not support the video tag.
                </video>
                <div className="thumbnail-label">{video.angle}</div>
              </div>
            ))}
          </div>

          {/* Clear Button */}
          <button 
            className="clear-button"
            onClick={handleClearVideos}
          >
            Choose Other Videos
          </button>
        </div>
      )}
    </div>
  )
}

export default App
