import { useState, useEffect, useRef } from 'react';
import protobuf from 'protobufjs';
import { extractSeiMessagesWithFrameIndex } from '../utils/sei-extractor';

export function useSeiData(videoFiles, currentTime, duration = 0, selectedAngle = null) {
  const [seiData, setSeiData] = useState(null);
  const [allAnglesSeiData, setAllAnglesSeiData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [frameCountsBySei, setFrameCountsBySei] = useState({});
  const seiMessagesRef = useRef([]);
  const allAnglesSeiMessagesRef = useRef({});
  const SeiMetadataRef = useRef(null);
  const currentFilesRef = useRef(null);
  const allFieldsRef = useRef(new Set()); // Track all fields ever seen across all frames and angles

  // Initialize protobuf and extract SEI data when video files change
  useEffect(() => {
    if (!videoFiles || videoFiles.length === 0) {
      setSeiData(null);
      setAllAnglesSeiData({});
      seiMessagesRef.current = [];
      allAnglesSeiMessagesRef.current = {};
      allFieldsRef.current = new Set();
      currentFilesRef.current = null;
      return;
    }

    // Skip if same files - use file name and size as unique identifier
    const filesKey = JSON.stringify(videoFiles.map(v => ({ 
      angle: v.angle, 
      name: v.file?.name, 
      size: v.file?.size 
    })).sort((a, b) => a.angle.localeCompare(b.angle)));
    if (currentFilesRef.current === filesKey) {
      return;
    }

    currentFilesRef.current = filesKey;
    setIsLoading(true);
    setError(null);

    async function extractSei() {
      try {
        // Initialize protobuf if not already done
        if (!SeiMetadataRef.current) {
          const response = await fetch('/dashcam.proto');
          const protoText = await response.text();
          const root = protobuf.parse(protoText, { keepCase: true }).root;
          SeiMetadataRef.current = root.lookupType('SeiMetadata');
        }

        const allMessages = {};
        const allFields = new Set();
        const frameCounts = {};
        
        // Extract SEI from all video files
        for (const videoFile of videoFiles) {
          if (!videoFile.file) continue;
          
          try {
            // Read file as ArrayBuffer
            const arrayBuffer = await videoFile.file.arrayBuffer();
            
            // Parse MP4 and extract SEI messages with frame indices
            const messages = extractSeiMessagesWithFrameIndex(arrayBuffer, SeiMetadataRef.current);
            
            allMessages[videoFile.angle] = messages;
            
            // Log frame count for this angle
            const frameCount = messages.length > 0 
              ? messages[messages.length - 1].frameIndex + 1 
              : 0;
            frameCounts[videoFile.angle] = frameCount;
            
            // Collect all fields from all SEI messages
            messages.forEach(msg => {
              if (msg.sei) {
                Object.keys(msg.sei).forEach(field => allFields.add(field));
              }
            });
            
            // Store front angle separately for backward compatibility
            if (videoFile.angle.toLowerCase() === 'front') {
              seiMessagesRef.current = messages;
            }
          } catch (err) {
            console.error(`SEI extraction error for ${videoFile.angle}:`, err);
          }
        }
        
        allAnglesSeiMessagesRef.current = allMessages;
        allFieldsRef.current = allFields;
        setFrameCountsBySei(frameCounts);
        
        if (Object.keys(allMessages).length === 0) {
          setError('No SEI data found in any video');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('SEI extraction error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    }

    extractSei();
  }, [videoFiles]);

  // Update current SEI data based on video time
  useEffect(() => {
    const currentAnglesSeiData = {};
    const frameIndexInfo = {};
    
    // Extract SEI data for all angles at the current time
    for (const [angle, messages] of Object.entries(allAnglesSeiMessagesRef.current)) {
      if (!messages || messages.length === 0) continue;
      
      // Calculate actual FPS for this angle using frame count and duration
      const totalFrames = frameCountsBySei[angle] || 0;
      if (duration <= 0 || totalFrames <= 0) continue;
      
      const actualFps = totalFrames / duration;
      
      // Calculate current frame index based on actual FPS
      const currentFrameIndex = Math.floor(currentTime * actualFps);
      
      let matchedSei = null;
      let matchedFrameIndex = null;
      
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].frameIndex <= currentFrameIndex) {
          matchedSei = messages[i].sei;
          matchedFrameIndex = messages[i].frameIndex;
          break;
        }
      }
      
      if (matchedSei) {
        // Create a complete object with all known fields
        const completeData = {};
        
        // Initialize all known fields with null
        allFieldsRef.current.forEach(field => {
          completeData[field] = null;
        });
        
        // Override with actual values from matched SEI
        Object.keys(matchedSei).forEach(field => {
          completeData[field] = matchedSei[field];
        });
        
        currentAnglesSeiData[angle] = completeData;
        frameIndexInfo[angle] = matchedFrameIndex;
      }
    }
    
    setAllAnglesSeiData(currentAnglesSeiData);
    
    // Set front camera data for overlay (backward compatibility)
    if (currentAnglesSeiData['front'] || currentAnglesSeiData['Front']) {
      setSeiData(currentAnglesSeiData['front'] || currentAnglesSeiData['Front']);
    } else {
      setSeiData(null);
    }
  }, [currentTime, duration, frameCountsBySei]);

  return { 
    seiData, 
    isLoading, 
    error, 
    allSeiMessages: seiMessagesRef.current,
    allAnglesSeiData,
    frameCountsBySei,
    allAnglesSeiMessagesRef
  };
}
