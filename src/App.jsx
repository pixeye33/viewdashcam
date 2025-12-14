import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import { SeiOverlay } from './components/SeiOverlay'
import { EventInfoModal } from './components/EventInfoModal'
import { LayoutSelector } from './components/LayoutSelector'
import { SeiLayoutSelector } from './components/SeiLayoutSelector'
import { useSeiData } from './hooks/useSeiData'
import { DISABLE_WEBCODECS } from './config'
import { getLayout } from './layouts/layouts'
import protobuf from 'protobufjs'

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
  const [showSeiModal, setShowSeiModal] = useState(false) // SEI data modal visibility
  const [showEventInfoModal, setShowEventInfoModal] = useState(false) // Event info modal visibility
  const [eventJsonData, setEventJsonData] = useState(null) // Store event.json data (single file for all events)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [duration, setDuration] = useState(0)
  const [previewTime, setPreviewTime] = useState(null)
  const [pendingAngleSwitch, setPendingAngleSwitch] = useState(null)
  const [speedUnit, setSpeedUnit] = useState('kmh') // 'mph' or 'kmh'
  const [isFrameByFrameMode, setIsFrameByFrameMode] = useState(false) // Track if user is in frame-by-frame mode
  const [actualFps, setActualFps] = useState({}) // Store actual FPS for each angle
  const [currentLayoutId, setCurrentLayoutId] = useState('default') // Current video layout
  const [currentSeiLayoutId, setCurrentSeiLayoutId] = useState('default') // Current SEI overlay layout
  const [openLayoutSelector, setOpenLayoutSelector] = useState(null) // Track which layout selector is open: 'video' | 'sei' | null
  
  const mainVideoRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const webCodecsPlayerRef = useRef(null)
  const thumbnailRefsRef = useRef({})
  const thumbnailCanvasRefsRef = useRef({})
  const thumbnailWebCodecsPlayersRef = useRef({})
  const frameCountsRef = useRef({}) // Store frame count for each angle
  const progressBarRef = useRef(null)
  const previewVideoRef = useRef(null)
  const previewCanvasRef = useRef(null)
  const hoverThrottleRef = useRef(null)
  const SeiMetadataRef = useRef(null)
  const isFrameByFrameModeRef = useRef(false) // Ref to track frame-by-frame mode synchronously

  // Get all video files for SEI extraction from all angles
  const allVideoFiles = useMemo(() => {
    return videos.map(v => ({ angle: v.angle, file: v.file }))
  }, [videos])

  // SEI data hook - extracts and provides SEI data based on current time
  const { seiData, isLoading: seiLoading, error: seiError, allSeiMessages, allAnglesSeiData, frameCountsBySei, allAnglesSeiMessagesRef } = useSeiData(allVideoFiles, currentTime, duration, selectedAngle)

  // Get current SEI data from WebCodecs player if available (only in frame-by-frame mode)
  const currentSeiData = useMemo(() => {
    if (isFrameByFrameMode && webCodecsPlayerRef.current) {
      const sei = webCodecsPlayerRef.current.getCurrentSei()
      return sei || allAnglesSeiData[selectedAngle] || null
    }
    return allAnglesSeiData[selectedAngle] || seiData
  }, [isFrameByFrameMode, currentTime, allAnglesSeiData, selectedAngle, seiData])

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
  const formatDateTime = useCallback((dateTimeStr, offsetSeconds = 0) => {
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
  }, [])

  // Format angle name for display (e.g., "left_repeater" -> "Left Repeater")
  const formatAngleName = useCallback((angle) => {
    return angle
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }, [])

  // Sort camera angles in the desired order
  // Order: left_repeater -> left_pillar -> front -> right_pillar -> right_repeater -> back
  const sortVideosByAngle = useCallback((videos) => {
    const angleOrder = {
      'left_repeater': 1,
      'left_pillar': 2,
      'front': 3,
      'right_pillar': 4,
      'right_repeater': 5,
      'back': 6
    }
    
    return [...videos].sort((a, b) => {
      const orderA = angleOrder[a.angle.toLowerCase()] || 999
      const orderB = angleOrder[b.angle.toLowerCase()] || 999
      return orderA - orderB
    })
  }, [])

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

  // Process a single entry (file or directory) with path tracking
  const processEntry = async (entry, path = '') => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          // Add path info to the file object
          const fileWithPath = new File([file], file.name, { type: file.type })
          fileWithPath.folderPath = path
          resolve([fileWithPath])
        }, () => resolve([]))
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      const files = []
      const currentPath = path ? `${path}/${entry.name}` : entry.name
      
      // Read all entries in the directory
      const readEntries = async () => {
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve()
            } else {
              for (const entry of entries) {
                const entryFiles = await processEntry(entry, currentPath)
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

  const processFiles = async (files) => {
    const videoFiles = files.filter(file => file.type.startsWith('video/'))
    const jsonFiles = files.filter(file => file.name.toLowerCase() === 'event.json')
    
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

    // Sort videos by angle for each event
    Object.keys(dateTimeGroups).forEach(eventKey => {
      dateTimeGroups[eventKey] = sortVideosByAngle(dateTimeGroups[eventKey])
    })

    // Process event.json files - just take the first one found
    let eventJson = null
    if (jsonFiles.length > 0) {
      try {
        const text = await jsonFiles[0].text()
        eventJson = JSON.parse(text)
      } catch (error) {
        console.error('Error parsing event.json:', error)
      }
    }

    setEventJsonData(eventJson)

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
    
    // Don't auto-play - let user start playback manually
    setIsPlaying(false)
  }

  const handleThumbnailClick = useCallback((angle) => {
    // Don't allow clicking on the currently selected angle
    if (angle === selectedAngle) return
    
    if (!mainVideoRef.current) return
    
    const currentTime = mainVideoRef.current.currentTime
    const wasPlaying = !mainVideoRef.current.paused
    const currentRate = mainVideoRef.current.playbackRate
    
    // Store the pending switch data and update the angle
    setPendingAngleSwitch({ currentTime, wasPlaying, currentRate })
    setSelectedAngle(angle)
  }, [selectedAngle])

  // Synchronize all videos when main video plays/pauses
  const handleMainVideoPlay = () => {
    setIsPlaying(true)
    // Sync thumbnails when NOT in frame-by-frame mode
    if (!isFrameByFrameMode) {
      Object.values(thumbnailRefsRef.current).forEach(ref => {
        if (ref && ref.paused) {
          ref.play().catch(() => {})
        }
      })
    }
  }

  const handleMainVideoPause = () => {
    setIsPlaying(false)
    // Pause thumbnails when NOT in frame-by-frame mode
    if (!isFrameByFrameMode) {
      Object.values(thumbnailRefsRef.current).forEach(ref => {
        if (ref && !ref.paused) {
          ref.pause()
        }
      })
    }
  }

  const handleLoadedMetadata = () => {
    if (mainVideoRef.current) {
      const videoDuration = mainVideoRef.current.duration
      setDuration(videoDuration)
      
      // Calculate actual FPS for current angle if we have frame count
      if (selectedAngle && frameCountsBySei[selectedAngle] && videoDuration > 0) {
        const calculatedFps = frameCountsBySei[selectedAngle] / videoDuration
        setActualFps(prev => ({
          ...prev,
          [selectedAngle]: calculatedFps
        }))
      }
    }
  }

  // Synchronize time across all videos
  const handleMainVideoTimeUpdate = () => {
    if (!mainVideoRef.current) return
    
    const currentTime = mainVideoRef.current.currentTime
    setCurrentTime(currentTime)
    
    // Sync thumbnails when NOT in frame-by-frame mode
    if (!isFrameByFrameMode) {
      Object.values(thumbnailRefsRef.current).forEach(ref => {
        if (ref && Math.abs(ref.currentTime - currentTime) > 0.3) {
          ref.currentTime = currentTime
        }
      })
    }
  }

  // Sync seeking
  const handleMainVideoSeeking = () => {
    if (!mainVideoRef.current) return
    
    const currentTime = mainVideoRef.current.currentTime
    
    // Sync thumbnails when NOT in frame-by-frame mode
    if (!isFrameByFrameMode) {
      Object.values(thumbnailRefsRef.current).forEach(ref => {
        if (ref) {
          ref.currentTime = currentTime
        }
      })
    }
  }

  // Custom playback controls
  const togglePlayPause = () => {
    if (!mainVideoRef.current) return
    
    // Exit frame-by-frame mode when playing
    if (!isPlaying) {
      isFrameByFrameModeRef.current = false
      setIsFrameByFrameMode(false)
      
      Object.values(thumbnailWebCodecsPlayersRef.current).forEach(player => {
        if (player && player.clearCache) {
          player.clearCache()
        }
      })
    }
    
    if (isPlaying) {
      mainVideoRef.current.pause()
    } else {
      mainVideoRef.current.play()
    }
  }

  const seekToFrame = async (forward = true) => {
    // Skip if WebCodecs is disabled
    if (DISABLE_WEBCODECS) {
      console.warn('Frame-by-frame navigation disabled: WebCodecs is turned off')
      return
    }
    
    // Pause playback
    if (mainVideoRef.current && !mainVideoRef.current.paused) {
      mainVideoRef.current.pause()
    }
    
    if (webCodecsPlayerRef.current) {
      const player = webCodecsPlayerRef.current
      
      // If entering frame-by-frame mode for the first time, sync to current video position
      if (!isFrameByFrameModeRef.current && mainVideoRef.current) {
        const currentVideoTime = mainVideoRef.current.currentTime * 1000 // Convert to ms
        const currentIndex = player.getFrameIndexAtTime(currentVideoTime)
        
        // Enter frame-by-frame mode
        isFrameByFrameModeRef.current = true
        setIsFrameByFrameMode(true)
        
        // Show current frame first to sync position
        await player.showFrame(currentIndex)
        
        // Sync all thumbnail players to the same time
        const syncPromises = Object.entries(thumbnailWebCodecsPlayersRef.current).map(async ([angle, thumbPlayer]) => {
          if (thumbPlayer && thumbPlayer.frames.length > 0 && angle !== selectedAngle) {
            const thumbIndex = thumbPlayer.getFrameIndexAtTime(currentVideoTime)
            await thumbPlayer.showFrame(thumbIndex)
          }
        })
        await Promise.all(syncPromises)
      } else {
        // Already in frame-by-frame mode, just ensure state is set
        isFrameByFrameModeRef.current = true
        setIsFrameByFrameMode(true)
      }
      
      const newIndex = forward 
        ? Math.min(player.currentFrameIndex + 1, player.frames.length - 1)
        : Math.max(player.currentFrameIndex - 1, 0)
      
      await player.showFrame(newIndex)
      
      const frame = player.getFrame(newIndex)
      if (frame) {
        const timeSeconds = frame.timestamp / 1000
        setCurrentTime(timeSeconds)
        
        // Sync all thumbnail WebCodecs players to the same time
        // Skip the current angle since we already showed its frame above
        const syncPromises = Object.entries(thumbnailWebCodecsPlayersRef.current).map(async ([angle, thumbPlayer]) => {
          if (thumbPlayer && thumbPlayer.frames.length > 0 && angle !== selectedAngle) {
            const thumbIndex = thumbPlayer.getFrameIndexAtTime(frame.timestamp)
            await thumbPlayer.showFrame(thumbIndex)
          }
        })
        
        await Promise.all(syncPromises)
      }
    }
  }

  const jumpTime = async (seconds) => {
    if (!mainVideoRef.current) return
    
    const newTime = mainVideoRef.current.currentTime + seconds
    const clampedTime = Math.max(0, Math.min(newTime, duration))
    mainVideoRef.current.currentTime = clampedTime
    
    // If in frame-by-frame mode and WebCodecs is available, sync all players
    if (isFrameByFrameMode && webCodecsPlayerRef.current) {
      const player = webCodecsPlayerRef.current
      const newTimeMs = clampedTime * 1000
      const newIndex = player.getFrameIndexAtTime(newTimeMs)
      await player.showFrame(newIndex)
      
      const frame = player.getFrame(newIndex)
      if (frame) {
        setCurrentTime(frame.timestamp / 1000)
        
        // Sync all thumbnail WebCodecs players
        // Skip the current angle since we already showed its frame above
        const syncPromises = Object.entries(thumbnailWebCodecsPlayersRef.current).map(async ([angle, thumbPlayer]) => {
          if (thumbPlayer && thumbPlayer.frames.length > 0 && angle !== selectedAngle) {
            const thumbIndex = thumbPlayer.getFrameIndexAtTime(frame.timestamp)
            await thumbPlayer.showFrame(thumbIndex)
          }
        })
        
        await Promise.all(syncPromises)
      }
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

  const handleProgressClick = async (e) => {
    if (!progressBarRef.current || !mainVideoRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const newTime = pos * duration

    mainVideoRef.current.currentTime = newTime
    
    // If in frame-by-frame mode and WebCodecs is available, sync all players
    if (isFrameByFrameMode && webCodecsPlayerRef.current) {
      const player = webCodecsPlayerRef.current
      const newTimeMs = newTime * 1000
      const newIndex = player.getFrameIndexAtTime(newTimeMs)
      
      await player.showFrame(newIndex)
      
      const frame = player.getFrame(newIndex)
      if (frame) {
        setCurrentTime(frame.timestamp / 1000)
        
        // Sync all thumbnail WebCodecs players
        // Skip the current angle since we already showed its frame above
        const syncPromises = Object.entries(thumbnailWebCodecsPlayersRef.current).map(async ([angle, thumbPlayer]) => {
          if (thumbPlayer && thumbPlayer.frames.length > 0 && angle !== selectedAngle) {
            const thumbIndex = thumbPlayer.getFrameIndexAtTime(frame.timestamp)
            await thumbPlayer.showFrame(thumbIndex)
          }
        })
        
        await Promise.all(syncPromises)
      }
    }
  }

  const handleProgressHover = useCallback((e) => {
    if (!progressBarRef.current) return
    
    // Throttle hover events to improve performance
    if (hoverThrottleRef.current) return
    
    hoverThrottleRef.current = setTimeout(() => {
      hoverThrottleRef.current = null
    }, 50) // Update every 50ms max
    
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
  }, [duration])

  const handleProgressLeave = useCallback(() => {
    // Clear any pending throttle
    if (hoverThrottleRef.current) {
      clearTimeout(hoverThrottleRef.current)
      hoverThrottleRef.current = null
    }
    setPreviewTime(null)
  }, [])

  // Capture frame to canvas when preview video seeks
  const handlePreviewSeeked = useCallback(() => {
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
  }, [])

  const handleEventSwitch = (eventKey) => {
    if (eventKey === selectedEvent) return
    
    const eventVideos = sortVideosByAngle(allEvents[eventKey])
    
    if (mainVideoRef.current) {
      mainVideoRef.current.pause()
    }
    
    // Pause all thumbnail videos as well
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref && !ref.paused) {
        ref.pause()
      }
    })
    
    // Update state to reflect paused state
    setIsPlaying(false)
    setSelectedEvent(eventKey)
    setVideos(eventVideos)
    setEventDateTime(eventKey)
    setCurrentTime(0)
    
    // Reset video playback position
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
    }
    
    // Select 'front' angle by default, or first angle if 'front' doesn't exist
    const frontVideo = eventVideos.find(v => v.angle.toLowerCase() === 'front')
    setSelectedAngle(frontVideo ? frontVideo.angle : eventVideos[0].angle)
  }

  const handleClearVideos = () => {
    Object.values(thumbnailWebCodecsPlayersRef.current).forEach(player => {
      if (player && player.clearCache) {
        player.clearCache()
      }
    })
    
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
    setEventJsonData(null)
    setIsPlaying(false)
    setPlaybackRate(1)
    setDuration(0)
  }

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (hoverThrottleRef.current) {
        clearTimeout(hoverThrottleRef.current)
      }
    }
  }, [])

  // Handle angle switching after re-render
  useEffect(() => {
    if (!pendingAngleSwitch || !mainVideoRef.current) return
    
    const { currentTime, wasPlaying, currentRate } = pendingAngleSwitch
    
    mainVideoRef.current.currentTime = currentTime
    mainVideoRef.current.playbackRate = currentRate
    
    // Restore playing state after seeking completes
    const handleSeeked = () => {
      if (wasPlaying && mainVideoRef.current) {
        mainVideoRef.current.play().catch(() => {})
      }
    }
    
    mainVideoRef.current.addEventListener('seeked', handleSeeked, { once: true })
    
    // Sync thumbnails
    Object.values(thumbnailRefsRef.current).forEach(ref => {
      if (ref) {
        ref.currentTime = currentTime
        ref.playbackRate = currentRate
        if (wasPlaying) {
          ref.play().catch(() => {})
        }
      }
    })
    
    // Clear the pending switch
    setPendingAngleSwitch(null)
  }, [pendingAngleSwitch])

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
      
      // SEI Debug modal toggle
      if (e.code === 'KeyD') {
        e.preventDefault()
        setShowSeiModal(prev => !prev)
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
  
  // Get current layout configuration
  const currentLayout = useMemo(() => {
    const layout = getLayout(currentLayoutId)
    // Apply dynamic grid columns based on video count for grid layout
    if (layout.id === 'grid' && layout.getContainerStyle && videos.length > 0) {
      const dynamicContainerStyle = layout.getContainerStyle(videos.length)
      return {
        ...layout,
        containerStyle: dynamicContainerStyle,
        thumbnails: {
          ...layout.thumbnails,
          style: {
            ...layout.thumbnails.style,
            gridTemplateColumns: dynamicContainerStyle.gridTemplateColumns,
          }
        }
      }
    }
    return layout
  }, [currentLayoutId, videos.length])
  
  // Handle layout change
  const handleLayoutChange = useCallback((layoutId) => {
    setCurrentLayoutId(layoutId)
  }, [])
  
  // Handle SEI layout change
  const handleSeiLayoutChange = useCallback((layoutId) => {
    setCurrentSeiLayoutId(layoutId)
  }, [])
  
  // Handle layout selector toggle
  const handleVideoLayoutToggle = useCallback(() => {
    setOpenLayoutSelector(prev => prev === 'video' ? null : 'video')
  }, [])
  
  const handleSeiLayoutToggle = useCallback(() => {
    setOpenLayoutSelector(prev => prev === 'sei' ? null : 'sei')
  }, [])
  
  const handleCloseLayoutSelector = useCallback(() => {
    setOpenLayoutSelector(null)
  }, [])

  // Initialize WebCodecs players for all videos ONCE (for frame-by-frame mode)
  useEffect(() => {
    if (!videos || videos.length === 0) return
    
    // Skip WebCodecs initialization if disabled
    if (DISABLE_WEBCODECS) {
      return
    }

    async function initWebCodecsPlayers() {
      try {
        // Dynamically import WebCodecs module only when needed
        const { WebCodecsPlayer } = await import('./utils/webcodecs-decoder')
        
        // Check WebCodecs support
        if (typeof VideoDecoder === 'undefined') {
          console.warn('WebCodecs not supported - frame-by-frame navigation will be less accurate')
          return
        }

        // Initialize protobuf if not already done
        if (!SeiMetadataRef.current) {
          const response = await fetch('/dashcam.proto')
          const protoText = await response.text()
          const root = protobuf.parse(protoText, { keepCase: true }).root
          SeiMetadataRef.current = root.lookupType('SeiMetadata')
        }

        const allPlayers = {}
        const frameCounts = {}
        
        // Create WebCodecs players for all angles (using thumbnail canvases)
        for (const video of videos) {
          const canvas = thumbnailCanvasRefsRef.current[video.angle]
          
          if (!canvas) {
            console.warn(`Canvas not ready for ${video.angle}, waiting...`)
            continue
          }
          
          const player = new WebCodecsPlayer(canvas)
          const { duration, frameCount } = await player.load(video.file, SeiMetadataRef.current)
          
          allPlayers[video.angle] = player
          frameCounts[video.angle] = frameCount
        }
        
        // Store all players and frame counts
        thumbnailWebCodecsPlayersRef.current = allPlayers
        frameCountsRef.current = frameCounts
        webCodecsPlayerRef.current = allPlayers[selectedAngle] || null
      } catch (err) {
        console.error('WebCodecs initialization failed:', err)
      }
    }

    // Small delay to ensure canvas refs are set
    const timer = setTimeout(initWebCodecsPlayers, 100)

    return () => {
      clearTimeout(timer)
      // Cleanup all players when videos change
      webCodecsPlayerRef.current = null
      
      Object.values(thumbnailWebCodecsPlayersRef.current).forEach(player => {
        if (player && player.dispose) {
          player.dispose()
        }
      })
      thumbnailWebCodecsPlayersRef.current = {}
    }
  }, [videos]) // Only depend on videos, not selectedAngle
  
  // Update webCodecsPlayerRef when angle changes (just switch reference, no reload)
  useEffect(() => {
    if (selectedAngle && thumbnailWebCodecsPlayersRef.current[selectedAngle]) {
      webCodecsPlayerRef.current = thumbnailWebCodecsPlayersRef.current[selectedAngle]
    }
  }, [selectedAngle])
  
  // Copy selected angle's canvas to main canvas in frame-by-frame mode
  useEffect(() => {
    if (!isFrameByFrameMode || !mainCanvasRef.current || !selectedAngle) return
    
    const copyToMain = () => {
      const sourceCanvas = thumbnailCanvasRefsRef.current[selectedAngle]
      const destCanvas = mainCanvasRef.current
      
      if (!sourceCanvas || !destCanvas) return
      
      // Match dimensions
      if (destCanvas.width !== sourceCanvas.width || destCanvas.height !== sourceCanvas.height) {
        destCanvas.width = sourceCanvas.width
        destCanvas.height = sourceCanvas.height
      }
      
      // Copy content
      const ctx = destCanvas.getContext('2d')
      ctx.drawImage(sourceCanvas, 0, 0)
    }
    
    // Copy immediately
    copyToMain()
    
    // Set up observer to copy when source canvas changes
    const interval = setInterval(copyToMain, 16) // ~60fps
    
    return () => clearInterval(interval)
  }, [isFrameByFrameMode, selectedAngle])

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
            <h1>ViewDashCam</h1>
            <p className="tagline">Professional dashcam footage analysis - right in your browser</p>
            
            <div className="features-brief">
              <div className="feature-item">
                <span className="feature-icon">🎥</span>
                <span><strong>Perfect Multi-Angle Sync</strong> - View up to 6 camera angles simultaneously, all perfectly synchronized</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⚡</span>
                <span><strong>Frame-by-Frame Precision</strong> - Step through footage one frame at a time with WebCodecs technology</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🚗</span>
                <span><strong>Tesla Telemetry Overlay</strong> - Real-time speed, gear, steering, brakes, GPS, acceleration, autopilot state & more</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span><strong>Visual Timeline</strong> - Brake indicators show exactly when braking occurred on the progress bar</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎮</span>
                <span><strong>Complete Keyboard Control</strong> - Navigate, seek, and switch angles without touching your mouse</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span><strong>100% Private & Secure</strong> - All processing happens locally. No uploads, no tracking, completely free</span>
              </div>
            </div>

            <div className="cta-section">
              <h2>Get Started</h2>
              <p>Drop your videos or folder here</p>
              <p style={{ margin: '8px 0', fontSize: '14px' }}>or</p>
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
              <p className="extra-info" style={{ marginTop: '16px' }}>
                Videos must follow pattern: YYYY-MM-DD_HH-MM-SS-angle.mp4
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="video-container"
          style={currentLayout.containerStyle}
          data-layout={currentLayoutId}
        >
          {/* SEI Overlay - First child for proper layering */}
          {selectedVideo && (
            <SeiOverlay 
              seiData={currentSeiData} 
              isLoading={seiLoading} 
              error={seiError}
              currentAngle={selectedAngle}
              speedUnit={speedUnit}
              onSpeedUnitToggle={() => setSpeedUnit(prev => prev === 'mph' ? 'kmh' : 'mph')}
              onDebugClick={() => setShowSeiModal(true)}
              isHighPrecision={isFrameByFrameMode && webCodecsPlayerRef.current?.getCurrentSei() !== null}
              layoutId={currentSeiLayoutId}
            />
          )}

          {/* Controls Overlay */}
          {showControls && (
            <div className="controls-overlay">
              {/* Left-side info panel group */}
              <div className="left-info-panel-group">
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

                {/* Action Buttons - Between clock and event list */}
                <div className="action-buttons-middle">
                  <button 
                    className="clear-button-middle"
                    onClick={handleClearVideos}
                  >
                    Choose Other Videos
                  </button>
                  {eventJsonData && (
                    <button 
                      className="event-info-button-middle"
                      onClick={() => setShowEventInfoModal(true)}
                      title="View event information from event.json"
                    >
                      Event Info
                    </button>
                  )}
                </div>

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
              </div>

              {/* Layout Selectors and Help Button */}
              <div className="top-buttons">
                <LayoutSelector 
                  currentLayout={currentLayoutId}
                  onLayoutChange={handleLayoutChange}
                  isOpen={openLayoutSelector === 'video'}
                  onToggle={handleVideoLayoutToggle}
                  onClose={handleCloseLayoutSelector}
                />
                <SeiLayoutSelector 
                  currentLayout={currentSeiLayoutId}
                  onLayoutChange={handleSeiLayoutChange}
                  isOpen={openLayoutSelector === 'sei'}
                  onToggle={handleSeiLayoutToggle}
                  onClose={handleCloseLayoutSelector}
                />
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
          <div 
            className="main-player"
            style={currentLayout.mainPlayer.style}
          >
            {selectedVideo && (
              <>
                {/* Always render video element for smooth playback */}
                <video
                  ref={mainVideoRef}
                  src={selectedVideo.url}
                  className="video-player main"
                  onPlay={handleMainVideoPlay}
                  onPause={handleMainVideoPause}
                  onTimeUpdate={handleMainVideoTimeUpdate}
                  onSeeking={handleMainVideoSeeking}
                  onLoadedMetadata={handleLoadedMetadata}
                  disablePictureInPicture
                  style={{ display: isFrameByFrameMode ? 'none' : 'block' }}
                >
                  Your browser does not support the video tag.
                </video>
                
                {/* Canvas for frame-by-frame mode - copies from selected angle's canvas */}
                <canvas
                  ref={mainCanvasRef}
                  className="video-player main"
                  style={{ display: isFrameByFrameMode ? 'block' : 'none' }}
                />

                {/* Hidden preview video for frame capture */}
                <video
                  ref={previewVideoRef}
                  src={selectedVideo.url}
                  muted
                  disablePictureInPicture
                  onSeeked={handlePreviewSeeked}
                  style={{ display: 'none' }}
                />

              </>
            )}
          </div>

          {/* Progress Bar (moved above thumbnails) */}
          {selectedVideo && showControls && (
            <div 
              className="progress-bar-standalone"
              style={currentLayout.progressBar.style}
              ref={progressBarRef}
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
            >
              <div className="progress-bar-bg">
                {/* Brake indicators - each frame as a block */}
                {allSeiMessages && allSeiMessages.length > 0 && duration > 0 && selectedAngle && (() => {
                  // Use computed FPS for the selected angle
                  const totalFrames = frameCountsBySei[selectedAngle];
                  if (!totalFrames) return null;
                  
                  const fps = totalFrames / duration;
                  const frameWidth = (100 / totalFrames); // Width per frame in percentage
                  
                  return allSeiMessages.map((msg, idx) => {
                    const timePosition = msg.frameIndex / fps;
                    const percentPosition = (timePosition / duration) * 100;
                    
                    const hasBrake = msg.sei?.brake_applied;
                    
                    if (!hasBrake) return null;
                    
                    return (
                      <div
                        key={idx}
                        className="brake-indicator"
                        style={{ 
                          left: `${percentPosition}%`, 
                          width: `${frameWidth}%`,
                          backgroundColor: '#ff4444'
                        }}
                        title={`Brake at ${formatTime(timePosition)}`}
                      />
                    );
                  });
                })()}
                {/* Current position indicator - thin bar on top */}
                <div 
                  className="progress-position-indicator"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
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

              {/* Custom Controls - Part of progress bar */}
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
            </div>
          )}

          {/* Thumbnail Videos */}
          <div className="thumbnail-container-wrapper">
            <div
              className="thumbnail-container"
              style={currentLayout.thumbnails.style}
            >
              {videos.map((video) => (
                <div
                  key={video.angle}
                  className={`thumbnail-wrapper ${video.angle === selectedAngle ? 'active' : ''}`}
                  style={currentLayout.thumbnails.thumbnailStyle}
                  onClick={() => handleThumbnailClick(video.angle)}
                >
                  {/* Video element for normal playback */}
                  <video
                    ref={(el) => {
                      thumbnailRefsRef.current[video.angle] = el
                    }}
                    src={video.url}
                    className="video-player thumbnail"
                    muted
                    disablePictureInPicture
                    style={{ display: isFrameByFrameMode ? 'none' : 'block' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                  
                  {/* Canvas for frame-by-frame mode */}
                  <canvas
                    ref={(el) => {
                      thumbnailCanvasRefsRef.current[video.angle] = el
                    }}
                    className="video-player thumbnail"
                    style={{ display: isFrameByFrameMode ? 'block' : 'none' }}
                  />
                  
                  <div className="thumbnail-label">{formatAngleName(video.angle)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SEI Debug Modal */}
          {showSeiModal && (
            <div className="modal-overlay" onClick={() => setShowSeiModal(false)}>
              <div className="modal-content sei-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Raw SEI Data - Frame {(() => {
                    const totalFrames = frameCountsBySei[selectedAngle];
                    if (!totalFrames || !duration) return Math.floor(currentTime);
                    const fps = totalFrames / duration;
                    return Math.floor(currentTime * fps);
                  })()}{Object.keys(frameCountsRef.current).length > 0 && ` / ${frameCountsRef.current[selectedAngle] || 'N/A'} total`}</h2>
                  <button className="modal-close" onClick={() => setShowSeiModal(false)}>×</button>
                </div>
                <div className="modal-body sei-modal-body">
                  {Object.keys(allAnglesSeiData).length === 0 ? (
                    <div className="sei-no-data">No SEI data available at this time</div>
                  ) : (
                    <>
                      <div className="sei-table-wrapper">
                        <table 
                          className="sei-data-table"
                          style={{ '--angle-count': Object.keys(allAnglesSeiData).length }}
                        >
                          <thead>
                            <tr>
                              <th>Metric</th>
                              {Object.keys(allAnglesSeiData).map(angle => (
                                <th key={angle}>{formatAngleName(angle)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Collect all unique fields across all angles
                              const allFields = new Set();
                              Object.values(allAnglesSeiData).forEach(data => {
                                Object.keys(data).forEach(field => allFields.add(field));
                              });
                              
                              // Sort fields alphabetically for consistent display
                              const sortedFields = Array.from(allFields).sort();
                              
                              return sortedFields.map(field => (
                                <tr key={field}>
                                  <td className="sei-metric-name">{field}</td>
                                  {Object.keys(allAnglesSeiData).map(angle => {
                                    const value = allAnglesSeiData[angle][field];
                                    return (
                                      <td key={angle} className="sei-metric-value">
                                        {value === null || value === undefined 
                                          ? <span className="sei-null-value">null</span>
                                          : typeof value === 'boolean'
                                          ? value.toString()
                                          : typeof value === 'number'
                                          ? value.toFixed(6).replace(/\.?0+$/, '')
                                          : value.toString()}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {showHelpModal && (
            <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Help</h2>
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
                    <div className="shortcut-item">
                      <span className="shortcut-key">D</span>
                      <span className="shortcut-desc">Toggle SEI Debug Modal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Event Info Modal */}
          {showEventInfoModal && eventJsonData && (
            <EventInfoModal 
              eventData={eventJsonData}
              onClose={() => setShowEventInfoModal(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
