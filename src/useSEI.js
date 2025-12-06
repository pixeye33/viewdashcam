import { useState, useEffect } from 'react'

// Custom hook for extracting and managing SEI metadata from Tesla dashcam videos
export function useSEI() {
  const [seiType, setSeiType] = useState(null)
  const [seiFields, setSeiFields] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize protobuf on mount
  useEffect(() => {
    const initProtobuf = async () => {
      try {
        if (!window.DashcamHelpers) {
          console.warn('DashcamHelpers not available')
          return
        }

        const { SeiMetadata, enumFields } = await window.DashcamHelpers.initProtobuf()
        setSeiType(SeiMetadata)
        
        const fields = window.DashcamHelpers.deriveFieldInfo(SeiMetadata, enumFields, { useLabels: true })
        setSeiFields(fields)
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize protobuf:', error)
      }
    }

    initProtobuf()
  }, [])

  // Extract SEI messages from a video file
  const extractSEI = async (file) => {
    if (!isInitialized || !seiType) {
      return null
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const mp4 = new window.DashcamMP4(arrayBuffer)
      const messages = mp4.extractSeiMessages(seiType)
      return messages
    } catch (error) {
      console.error('Failed to extract SEI data:', error)
      return null
    }
  }

  // Format SEI value for display
  const formatSEIValue = (value, enumMap) => {
    if (!window.DashcamHelpers) return String(value)
    return window.DashcamHelpers.formatValue(value, enumMap)
  }

  return {
    isInitialized,
    seiFields,
    extractSEI,
    formatSEIValue
  }
}
