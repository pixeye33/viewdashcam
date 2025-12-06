import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [videos, setVideos] = useState([])
  const [selectedAngle, setSelectedAngle] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [eventDateTime, setEventDateTime] = useState(null)
  const [allEvents, setAllEvents] = useState({}) // Store all events grouped by datetime
  const [selectedEvent, setSelectedEvent] = useState(null) // Currently selected event datetime
  const [showEventsPanel, setShowEventsPanel] = useState(true) // Events panel visibility
  
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

  // Format datetime for display based on browser locale
  const formatDateTime = (dateTimeStr, offsetSeconds = 0) => {
    const [datePart, timePart] = dateTimeStr.split('_')
    const [year, month, day] = datePart.split('-')
    const [hours, minutes, seconds] = timePart.split('-').map(Number)
    
    // Create date object and add offset
    const date = new Date(year, month - 1, day, hours, minutes, seconds)
    date.setSeconds(date.getSeconds() + offsetSeconds)
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  // Format angle name for display (e.g., "left_repeater" -> "Left Repeater")
  const formatAngleName = (angle) => {
    return angle
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
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

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const items = e.dataTransfer.items
    const files = await getAllFilesFromItems(items)
    processFiles(files)
  }

  // Recursively get all files from dropped items (supports folders)
  const getAllFilesFromItems = async (items) => {
    const files = []
    
    // Convert items to entries
    const entries = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry) {
          entries.push(entry)
        }
      }
    }
    
    // Process each entry
    for (const entry of entries) {
      const entryFiles = await processEntry(entry)
      files.push(...entryFiles)
    }
    
    return files
  }

  // Process a single entry (file or directory)
  const processEntry = async (entry) => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => resolve([file]), () => resolve([]))
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      const files = []
      
      // Read all entries in the directory
      const readEntries = async () => {
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve()
            } else {
              for (const entry of entries) {
                const entryFiles = await processEntry(entry)
                files.push(...entryFiles)
              }
              // Continue reading (directories might have more than 100 entries)
              await readEntries()
              resolve()
            }
          })
        })
      }
      
      await readEntries()
      return files
    }
    
    return []
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

    // Group by datetime
    const dateTimeGroups = {}
    parsedVideos.forEach(video => {
      if (!dateTimeGroups[video.dateTime]) {
        dateTimeGroups[video.dateTime] = []
      }
      dateTimeGroups[video.dateTime].push(video)
    })

    // Sort events by datetime (oldest first)
    const sortedEventKeys = Object.keys(dateTimeGroups).sort()
    
    // Select the oldest event by default
    const oldestEvent = sortedEventKeys[0]
    const oldestEventVideos = dateTimeGroups[oldestEvent]

    setAllEvents(dateTimeGroups)
    setSelectedEvent(oldestEvent)
    setVideos(oldestEventVideos)
    setEventDateTime(oldestEvent)
    
    // Hide events panel by default if there's only one event
    setShowEventsPanel(sortedEventKeys.length > 1)
    
    // Select 'front' angle by default, or first angle if 'front' doesn't exist
    const frontVideo = oldestEventVideos.find(v => v.angle.toLowerCase() === 'front')
    setSelectedAngle(frontVideo ? frontVideo.angle : oldestEventVideos[0].angle)
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

  const handleEventSwitch = (eventKey) => {
    if (eventKey === selectedEvent) return
    
    const eventVideos = allEvents[eventKey]
    setSelectedEvent(eventKey)
    setVideos(eventVideos)
    setEventDateTime(eventKey)
    setCurrentTime(0)
    
    // Reset video playback
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
      mainVideoRef.current.pause()
    }
    
    // Select 'front' angle by default, or first angle if 'front' doesn't exist
    const frontVideo = eventVideos.find(v => v.angle.toLowerCase() === 'front')
    setSelectedAngle(frontVideo ? frontVideo.angle : eventVideos[0].angle)
  }

  const handleClearVideos = () => {
    // Clean up URLs for all events
    Object.values(allEvents).forEach(eventVideos => {
      eventVideos.forEach(video => {
        URL.revokeObjectURL(video.url)
      })
    })
    setVideos([])
    setSelectedAngle(null)
    setEventDateTime(null)
    setCurrentTime(0)
    setAllEvents({})
    setSelectedEvent(null)
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
            <h1>Drop your videos or folder here</h1>
            <p>or</p>
            <label className="file-input-label">
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileInput}
                className="file-input"
                multiple
                webkitdirectory=""
                directory=""
              />
              Browse Folder
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
            <div 
              className="datetime-display"
              onClick={() => setShowEventsPanel(!showEventsPanel)}
              style={{ cursor: 'pointer' }}
            >
              {formatDateTime(eventDateTime, Math.floor(currentTime))}
            </div>
          )}

          {/* Events Panel - Always show when events exist */}
          {Object.keys(allEvents).length > 0 && showEventsPanel && (
            <div className="events-panel">
              <div className="events-panel-header">Events</div>
              <div className="events-panel-list">
                {Object.keys(allEvents).sort().map((eventKey) => (
                  <div
                    key={eventKey}
                    className={`event-item ${eventKey === selectedEvent ? 'active' : ''}`}
                    onClick={() => handleEventSwitch(eventKey)}
                  >
                    <div className="event-item-datetime">{formatDateTime(eventKey, 0)}</div>
                    <div className="event-item-info">{allEvents[eventKey].length} videos</div>
                  </div>
                ))}
              </div>
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
                <div className="thumbnail-label">{formatAngleName(video.angle)}</div>
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
