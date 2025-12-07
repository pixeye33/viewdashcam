import { useState, useEffect, useRef } from 'react';
import protobuf from 'protobufjs';
import { DashcamMP4 } from '../utils/dashcam-mp4';

export function useSeiData(videoFile, currentTime) {
  const [seiData, setSeiData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const seiMessagesRef = useRef([]);
  const SeiMetadataRef = useRef(null);
  const currentFileRef = useRef(null);

  // Initialize protobuf and extract SEI data when video file changes
  useEffect(() => {
    if (!videoFile) {
      setSeiData(null);
      seiMessagesRef.current = [];
      currentFileRef.current = null;
      return;
    }

    // Skip if same file
    if (currentFileRef.current === videoFile) {
      return;
    }

    currentFileRef.current = videoFile;
    setIsLoading(true);
    setError(null);

    async function extractSei() {
      try {
        // Initialize protobuf if not already done
        if (!SeiMetadataRef.current) {
          const response = await fetch('/dashcam.proto');
          const protoText = await response.text();
          const root = protobuf.parse(protoText).root;
          SeiMetadataRef.current = root.lookupType('SeiMetadata');
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await videoFile.arrayBuffer();
        
        // Parse MP4 and extract SEI messages
        const mp4 = new DashcamMP4(arrayBuffer);
        const messages = mp4.extractSeiMessages(SeiMetadataRef.current);
        
        seiMessagesRef.current = messages;
        console.log('SEI extraction complete:', messages.length, 'messages found');
        
        if (messages.length === 0) {
          setError('No SEI data found in this video');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('SEI extraction error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    }

    extractSei();
  }, [videoFile]);

  // Update current SEI data based on video time
  useEffect(() => {
    if (seiMessagesRef.current.length === 0) {
      setSeiData(null);
      return;
    }

    // Estimate frame rate (assume 30fps for now)
    const fps = 30;
    const currentFrame = Math.floor(currentTime * fps);
    
    // Find the SEI message for the current frame or nearest previous frame
    let matchedSei = null;
    for (let i = seiMessagesRef.current.length - 1; i >= 0; i--) {
      if (seiMessagesRef.current[i].frameIndex <= currentFrame) {
        matchedSei = seiMessagesRef.current[i].sei;
        break;
      }
    }
    
    if (matchedSei) {
      // Output raw data to console
      console.log('SEI Data (Frame', currentFrame + '):', matchedSei);
      setSeiData(matchedSei);
    }
  }, [currentTime]);

  return { seiData, isLoading, error };
}
