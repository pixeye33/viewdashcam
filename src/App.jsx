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
  const [showControls, setShowControls] = useState(true) // Media controls visibility
  const [showHelpModal, setShowHelpModal] = useState(false) // Help modal visibility
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [duration, setDuration] = useState(0)
  const [previewTime, setPreviewTime] = useState(null)
  
  const mainVideoRef = useRef(null)
  const thumbnailRefsRef = useRef({})
  const progressBarRef = useRef(null)
  const previewVideoRef = useRef(null)
  const previewCanvasRef = useRef(null)

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
    // Store the current playing state before switching
    const wasPlaying = isPlaying
    const currentTimeSnapshot = mainVideoRef.current ? mainVideoRef.current.currentTime : 0
    
    setSelectedAngle(angle)
    
    // Sync the new main video to current time and restore playing state
    setTimeout(() => {
      if (mainVideoRef.current) {
        mainVideoRef.current.currentTime = currentTimeSnapshot
        
        // If it was paused, keep it paused
        if (!wasPlaying && !mainVideoRef.current.paused) {
          mainVideoRef.current.pause()
        }
        // If it was playing, ensure it's playing
        else if (wasPlaying && mainVideoRef.current.paused) {
          mainVideoRef.current.play()
        }
      }
    }, 0)
  }

  // Synchronize all videos when main video plays/pauses
  const handleMainVideoPlay = () => {
    setIsPlaying(true)
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && ref.paused) {
        ref.play().catch(() => {})
      }
    })
  }

  const handleMainVideoPause = () => {
    setIsPlaying(false)
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && !ref.paused) {
        ref.pause()
      }
    })
  }

  const handleLoadedMetadata = () => {
    if (mainVideoRef.current) {
      setDuration(mainVideoRef.current.duration)
    }
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

  // Custom playback controls
  const togglePlayPause = () => {
    if (mainVideoRef.current) {
      if (isPlaying) {
        mainVideoRef.current.pause()
      } else {
        mainVideoRef.current.play()
      }
    }
  }

  const seekToFrame = (forward = true) => {
    if (mainVideoRef.current) {
      // Pause playback when using frame by frame navigation
      if (!mainVideoRef.current.paused) {
        mainVideoRef.current.pause()
      }
      
      const frameRate = 30 // Assume 30fps
      const frameTime = 1 / frameRate
      const newTime = mainVideoRef.current.currentTime + (forward ? frameTime : -frameTime)
      mainVideoRef.current.currentTime = Math.max(0, Math.min(newTime, duration))
    }
  }

  const jumpTime = (seconds) => {
    if (mainVideoRef.current) {
      const newTime = mainVideoRef.current.currentTime + seconds
      mainVideoRef.current.currentTime = Math.max(0, Math.min(newTime, duration))
    }
  }

  const changePlaybackSpeed = (rate) => {
    setPlaybackRate(rate)
    if (mainVideoRef.current) {
      mainVideoRef.current.playbackRate = rate
    }
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref) {
        ref.playbackRate = rate
      }
    })
  }

  const handleProgressClick = (e) => {
    if (!progressBarRef.current || !mainVideoRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const newTime = pos * duration
    mainVideoRef.current.currentTime = newTime
  }

  const handleProgressHover = (e) => {
    if (!progressBarRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const hoverTime = pos * duration
    
    if (hoverTime >= 0 && hoverTime <= duration) {
      setPreviewTime(hoverTime)
      
      // Capture frame at hover time for preview
      if (previewVideoRef.current && previewCanvasRef.current) {
        previewVideoRef.current.currentTime = hoverTime
      }
    } else {
      setPreviewTime(null)
    }
  }

  const handleProgressLeave = () => {
    setPreviewTime(null)
  }

  // Capture frame to canvas when preview video seeks
  const handlePreviewSeeked = () => {
    if (previewVideoRef.current && previewCanvasRef.current) {
      const canvas = previewCanvasRef.current
      const video = previewVideoRef.current
      const ctx = canvas.getContext('2d')
      
      // Set canvas size to match video aspect ratio
      canvas.width = 160
      canvas.height = (video.videoHeight / video.videoWidth) * 160
      
      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
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
    setIsPlaying(false)
    setPlaybackRate(1)
    setDuration(0)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      // Playback controls
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlayPause()
      } else if (e.code === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault()
        seekToFrame(false)
      } else if (e.code === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault()
        seekToFrame(true)
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault()
        jumpTime(-10)
      } else if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault()
        jumpTime(10)
      }
      
      // Speed controls with Q, W, E, R, T, Y
      if (e.code === 'KeyQ') {
        e.preventDefault()
        changePlaybackSpeed(0.25)
      } else if (e.code === 'KeyW') {
        e.preventDefault()
        changePlaybackSpeed(0.5)
      } else if (e.code === 'KeyE') {
        e.preventDefault()
        changePlaybackSpeed(1)
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        changePlaybackSpeed(1.25)
      } else if (e.code === 'KeyT') {
        e.preventDefault()
        changePlaybackSpeed(1.5)
      } else if (e.code === 'KeyY') {
        e.preventDefault()
        changePlaybackSpeed(2)
      }
      
      // Direct angle selection with number keys (only if videos are loaded)
      if (videos.length > 0) {
        // Arrow keys for cycling through angles
        const currentIndex = videos.findIndex(v => v.angle === selectedAngle)
        if (e.code === 'ArrowUp') {
          e.preventDefault()
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length
          handleThumbnailClick(videos[prevIndex].angle)
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          const nextIndex = (currentIndex + 1) % videos.length
          handleThumbnailClick(videos[nextIndex].angle)
        }
        
        // Number keys 1-9 for direct angle selection
        const numKey = e.code.match(/^(Digit|Numpad)([1-9])$/)
        if (numKey) {
          const angleIndex = parseInt(numKey[2]) - 1
          if (angleIndex < videos.length) {
            e.preventDefault()
            handleThumbnailClick(videos[angleIndex].angle)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, videos, selectedAngle, duration])

  // Format time for display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
          {/* Controls Overlay */}
          {showControls && (
            <div className="controls-overlay">
              {/* Event DateTime Display */}
              {eventDateTime && (
                <div 
                  className="datetime-display"
                  onClick={() => {
                    setShowEventsPanel(!showEventsPanel)
                    setShowControls(!showControls)
                  }}
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

              {/* Clear Button and Help Button */}
              <div className="top-buttons">
                <button 
                  className="clear-button"
                  onClick={handleClearVideos}
                >
                  Choose Other Videos
                </button>
                <button 
                  className="help-button"
                  onClick={() => setShowHelpModal(true)}
                >
                  Help
                </button>
              </div>
            </div>
          )}

          {/* Date display when controls are hidden - clickable to show controls */}
          {!showControls && eventDateTime && (
            <div 
              className="datetime-display"
              onClick={() => {
                setShowEventsPanel(!showEventsPanel)
                setShowControls(!showControls)
              }}
              style={{ cursor: 'pointer' }}
            >
              {formatDateTime(eventDateTime, Math.floor(currentTime))}
            </div>
          )}

          {/* Main Video Player */}
          <div className="main-player">
            {selectedVideo && (
              <>
                 <video
                  ref={mainVideoRef}
                  src={selectedVideo.url}
                  autoPlay
                  className="video-player main"
                  onPlay={handleMainVideoPlay}
                  onPause={handleMainVideoPause}
                  onTimeUpdate={handleMainVideoTimeUpdate}
                  onSeeking={handleMainVideoSeeking}
                  onLoadedMetadata={handleLoadedMetadata}
                >
                  Your browser does not support the video tag.
                </video>

                {/* Hidden preview video for frame capture */}
                <video
                  ref={previewVideoRef}
                  src={selectedVideo.url}
                  className="preview-video-hidden"
                  muted
                  onSeeked={handlePreviewSeeked}
                  style={{ display: 'none' }}
                />

                 {/* Custom Controls - Part of overlay */}
                {showControls && <div className="custom-controls">
                  {/* Control Buttons */}
                  <div className="controls-row">
                    <div className="controls-left">
                      {/* Play/Pause */}
                      <button 
                        className="control-btn"
                        onClick={togglePlayPause}
                        title="Play/Pause (Space)"
                      >
                        {isPlaying ? (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>

                      {/* Previous Frame */}
                      <button 
                        className="control-btn"
                        onClick={() => seekToFrame(false)}
                        title="Previous Frame (←)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(180deg)' }}>
                          <path d="M6 18H4V6h2v12zm13-6l-8.5 6V6l8.5 6z"/>
                        </svg>
                      </button>

                      {/* Next Frame */}
                      <button 
                        className="control-btn"
                        onClick={() => seekToFrame(true)}
                        title="Next Frame (→)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 18H4V6h2v12zm13-6l-8.5 6V6l8.5 6z"/>
                        </svg>
                      </button>

                      {/* Jump Back 10s */}
                      <button 
                        className="control-btn"
                        onClick={() => jumpTime(-10)}
                        title="Jump Back 10s (Shift+←)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                          <text x="9" y="15" fontSize="8" fill="currentColor" fontWeight="bold">10</text>
                        </svg>
                      </button>

                      {/* Jump Forward 10s */}
                      <button 
                        className="control-btn"
                        onClick={() => jumpTime(10)}
                        title="Jump Forward 10s (Shift+→)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                          <text x="9.5" y="15" fontSize="8" fill="currentColor" fontWeight="bold">10</text>
                        </svg>
                      </button>
                    </div>

                    <div className="controls-right">
                      {/* Playback Speed */}
                      <div className="speed-controls">
                        {[
                          { rate: 0.25, key: 'Q' },
                          { rate: 0.5, key: 'W' },
                          { rate: 1, key: 'E' },
                          { rate: 1.25, key: 'R' },
                          { rate: 1.5, key: 'T' },
                          { rate: 2, key: 'Y' }
                        ].map(({ rate, key }) => (
                          <button
                            key={rate}
                            className={`speed-btn ${playbackRate === rate ? 'active' : ''}`}
                            onClick={() => changePlaybackSpeed(rate)}
                            title={`Speed ${rate}x (${key})`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>}
              </>
            )}
          </div>

          {/* Progress Bar (moved above thumbnails) */}
          {selectedVideo && showControls && (
            <div 
              className="progress-bar-standalone"
              ref={progressBarRef}
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
            >
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                {previewTime !== null && (
                  <div 
                    className="progress-bar-preview"
                    style={{ left: `${(previewTime / duration) * 100}%` }}
                  >
                    <div className="preview-tooltip">
                      <canvas ref={previewCanvasRef} className="preview-frame" />
                      <div className="preview-time">{formatTime(previewTime)}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="progress-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

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

          {/* Help Modal */}
          {showHelpModal && (
            <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Keyboard Shortcuts</h2>
                  <button className="modal-close" onClick={() => setShowHelpModal(false)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="shortcut-section">
                    <h3>Playback Controls</h3>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Space</span>
                      <span className="shortcut-desc">Play/Pause</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">←</span>
                      <span className="shortcut-desc">Previous Frame</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">→</span>
                      <span className="shortcut-desc">Next Frame</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Shift + ←</span>
                      <span className="shortcut-desc">Jump Back 10 seconds</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Shift + →</span>
                      <span className="shortcut-desc">Jump Forward 10 seconds</span>
                    </div>
                  </div>
                  <div className="shortcut-section">
                    <h3>Playback Speed</h3>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Q</span>
                      <span className="shortcut-desc">0.25x Speed</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">W</span>
                      <span className="shortcut-desc">0.5x Speed</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">E</span>
                      <span className="shortcut-desc">1x Speed (Normal)</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">R</span>
                      <span className="shortcut-desc">1.25x Speed</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">T</span>
                      <span className="shortcut-desc">1.5x Speed</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Y</span>
                      <span className="shortcut-desc">2x Speed</span>
                    </div>
                  </div>
                  <div className="shortcut-section">
                    <h3>Camera Angles</h3>
                    <div className="shortcut-item">
                      <span className="shortcut-key">1-9</span>
                      <span className="shortcut-desc">Select Angle Directly</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">↑</span>
                      <span className="shortcut-desc">Previous Angle</span>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-key">↓</span>
                      <span className="shortcut-desc">Next Angle</span>
                    </div>
                  </div>
                  <div className="shortcut-section">
                    <h3>Interface</h3>
                    <div className="shortcut-item">
                      <span className="shortcut-key">Click Date/Time</span>
                      <span className="shortcut-desc">Toggle Controls & Events</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
