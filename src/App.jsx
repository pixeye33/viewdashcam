import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [videoSrc, setVideoSrc] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const videoRef = useRef(null)

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

    const files = e.dataTransfer.files
    if (files && files[0]) {
      const file = files[0]
      
      // Check if the file is a video
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
        setVideoSrc(url)
      } else {
        alert('Please drop a valid video file')
      }
    }
  }

  const handleFileInput = (e) => {
    const files = e.target.files
    if (files && files[0]) {
      const file = files[0]
      
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
        setVideoSrc(url)
      } else {
        alert('Please select a valid video file')
      }
    }
  }

  return (
    <div 
      className={`app-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!videoSrc ? (
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
            <h1>Drop your video here</h1>
            <p>or</p>
            <label className="file-input-label">
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileInput}
                className="file-input"
              />
              Browse Files
            </label>
            <p className="file-info">Supports MP4, WebM, OGG, and more</p>
          </div>
        </div>
      ) : (
        <div className="video-container">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            className="video-player"
          >
            Your browser does not support the video tag.
          </video>
          <button 
            className="clear-button"
            onClick={() => {
              if (videoSrc) {
                URL.revokeObjectURL(videoSrc)
              }
              setVideoSrc(null)
            }}
          >
            Choose Another Video
          </button>
        </div>
      )}
    </div>
  )
}

export default App
