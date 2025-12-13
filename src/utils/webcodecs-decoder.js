/**
 * WebCodecs Video Decoder for Tesla Dashcam MP4 files
 * Provides frame-accurate decoding and rendering to canvas
 * Based on implementation from martyearthy/teslareplay
 */

import { DashcamMP4 } from './dashcam-mp4.js'

/**
 * Extended MP4 parser with WebCodecs support
 * Adds codec config extraction and frame parsing
 */
export class WebCodecsMP4 {
    constructor(buffer) {
        this.buffer = buffer
        this.view = new DataView(buffer)
        this.dashcamMp4 = new DashcamMP4(buffer)
    }

    /** Find a box by name within a range */
    findBox(start, end, name) {
        for (let pos = start; pos + 8 <= end;) {
            let size = this.view.getUint32(pos)
            const type = this.readAscii(pos + 4, 4)
            const headerSize = size === 1 ? 16 : 8

            if (size === 1) {
                const high = this.view.getUint32(pos + 8)
                const low = this.view.getUint32(pos + 12)
                size = Number((BigInt(high) << 32n) | BigInt(low))
            } else if (size === 0) {
                size = end - pos
            }

            if (type === name) {
                return { start: pos + headerSize, end: pos + size, size: size - headerSize }
            }
            pos += size
        }
        return null // Return null instead of throwing
    }

    /** Find a box, throw if not found */
    findBoxRequired(start, end, name) {
        const box = this.findBox(start, end, name)
        if (!box) throw new Error(`Box "${name}" not found`)
        return box
    }

    readAscii(start, len) {
        let s = ''
        for (let i = 0; i < len; i++) s += String.fromCharCode(this.view.getUint8(start + i))
        return s
    }

    /**
     * Find video track - Tesla MP4s may have multiple tracks
     */
    findVideoTrack(moov) {
        let pos = moov.start
        while (pos + 8 <= moov.end) {
            let size = this.view.getUint32(pos)
            const type = this.readAscii(pos + 4, 4)
            const headerSize = size === 1 ? 16 : 8

            if (size === 1) {
                const high = this.view.getUint32(pos + 8)
                const low = this.view.getUint32(pos + 12)
                size = Number((BigInt(high) << 32n) | BigInt(low))
            } else if (size === 0) {
                size = moov.end - pos
            }

            if (type === 'trak') {
                const trakStart = pos + headerSize
                const trakEnd = pos + size
                
                // Check if this is a video track by looking for vmhd (video media header)
                const mdia = this.findBox(trakStart, trakEnd, 'mdia')
                if (mdia) {
                    const minf = this.findBox(mdia.start, mdia.end, 'minf')
                    if (minf) {
                        const vmhd = this.findBox(minf.start, minf.end, 'vmhd')
                        if (vmhd) {
                            return { start: trakStart, end: trakEnd, size: trakEnd - trakStart }
                        }
                    }
                }
            }
            pos += size
        }
        throw new Error('No video track found')
    }

    /**
     * Get codec configuration including SPS, PPS, dimensions, and frame durations
     */
    getConfig() {
        const moov = this.findBoxRequired(0, this.view.byteLength, 'moov')
        const trak = this.findVideoTrack(moov)
        const mdia = this.findBoxRequired(trak.start, trak.end, 'mdia')
        const minf = this.findBoxRequired(mdia.start, mdia.end, 'minf')
        const stbl = this.findBoxRequired(minf.start, minf.end, 'stbl')

        // Get timescale from mdhd
        const mdhd = this.findBoxRequired(mdia.start, mdia.end, 'mdhd')
        const version = this.view.getUint8(mdhd.start)
        const timescale = version === 1
            ? this.view.getUint32(mdhd.start + 20)
            : this.view.getUint32(mdhd.start + 12)

        // Parse stsd to get avcC (codec config)
        // stsd has 8 bytes header: 4 bytes version/flags + 4 bytes entry count
        const stsd = this.findBoxRequired(stbl.start, stbl.end, 'stsd')
        const stsdDataStart = stsd.start + 8 // Skip version/flags and entry count
        
        // Try to find avc1, avc3, or hev1/hvc1 sample entries
        let sampleEntry = this.findBox(stsdDataStart, stsd.end, 'avc1')
        if (!sampleEntry) sampleEntry = this.findBox(stsdDataStart, stsd.end, 'avc3')
        if (!sampleEntry) throw new Error('No H.264 sample entry found (avc1/avc3)')
        
        // avc1/avc3 sample entry structure (VisualSampleEntry):
        // - 6 bytes: reserved
        // - 2 bytes: data reference index  
        // - 2 bytes: pre-defined
        // - 2 bytes: reserved
        // - 12 bytes: pre-defined (3 x uint32)
        // - 2 bytes: width
        // - 2 bytes: height
        // - 4 bytes: horizontal resolution (fixed point)
        // - 4 bytes: vertical resolution (fixed point)  
        // - 4 bytes: reserved
        // - 2 bytes: frame count
        // - 32 bytes: compressor name
        // - 2 bytes: depth
        // - 2 bytes: pre-defined
        // Total: 78 bytes before extension boxes (avcC, etc)
        
        const width = this.view.getUint16(sampleEntry.start + 24)
        const height = this.view.getUint16(sampleEntry.start + 26)
        
        // avcC box starts after the 78 byte fixed header of VisualSampleEntry
        const extensionStart = sampleEntry.start + 78
        let avcCBox = this.findBox(extensionStart, sampleEntry.end, 'avcC')
        
        // Fallback: search entire sample entry (some encoders may differ)
        if (!avcCBox) {
            avcCBox = this.findBox(sampleEntry.start, sampleEntry.end, 'avcC')
        }
        
        // Last resort: scan for 'avcC' magic bytes anywhere in sample entry
        if (!avcCBox) {
            for (let i = sampleEntry.start; i < sampleEntry.end - 8; i++) {
                if (this.readAscii(i + 4, 4) === 'avcC') {
                    const size = this.view.getUint32(i)
                    if (size > 8 && size < 1000) { // Reasonable size for avcC
                        avcCBox = { start: i + 8, end: i + size, size: size - 8 }
                        break
                    }
                }
            }
        }
        
        if (!avcCBox) {
            console.error('Could not find avcC box in sample entry')
            throw new Error('No avcC box found in sample entry')
        }
        
        // Extract SPS and PPS from avcC box
        let pos = avcCBox.start + 5 // Skip config version and profile
        const numSPS = this.view.getUint8(pos) & 0x1F
        pos++
        
        const spsList = []
        for (let i = 0; i < numSPS; i++) {
            const spsLen = this.view.getUint16(pos)
            pos += 2
            spsList.push(new Uint8Array(this.buffer.slice(pos, pos + spsLen)))
            pos += spsLen
        }
        
        const numPPS = this.view.getUint8(pos)
        pos++
        
        const ppsList = []
        for (let i = 0; i < numPPS; i++) {
            const ppsLen = this.view.getUint16(pos)
            pos += 2
            ppsList.push(new Uint8Array(this.buffer.slice(pos, pos + ppsLen)))
            pos += ppsLen
        }

        // Parse stts (Sample To Time) to get frame durations
        const stts = this.findBoxRequired(stbl.start, stbl.end, 'stts')
        const entryCount = this.view.getUint32(stts.start + 4)
        const durations = []
        let sttsPos = stts.start + 8

        for (let i = 0; i < entryCount; i++) {
            const count = this.view.getUint32(sttsPos)
            const delta = this.view.getUint32(sttsPos + 4)
            const durationMs = (delta / timescale) * 1000
            for (let j = 0; j < count; j++) {
                durations.push(durationMs)
            }
            sttsPos += 8
        }

        // Build codec string
        const profile = this.view.getUint8(avcCBox.start + 1)
        const compatibility = this.view.getUint8(avcCBox.start + 2)
        const level = this.view.getUint8(avcCBox.start + 3)
        const codec = `avc1.${profile.toString(16).padStart(2, '0')}${compatibility.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}`

        return {
            codec,
            width,
            height,
            sps: spsList[0] || new Uint8Array(),
            pps: ppsList[0] || new Uint8Array(),
            timescale,
            durations
        }
    }

    /**
     * Parse all frames with SEI metadata
     * @param {Object} SeiMetadata - Protobuf type for SEI decoding
     * @returns {Array} Array of frame objects with timestamp, duration, keyframe flag, data, and SEI
     */
    parseFrames(SeiMetadata) {
        const config = this.getConfig()
        const mdat = this.dashcamMp4.findMdat()
        const frames = []
        
        let cursor = mdat.offset
        const end = mdat.offset + mdat.size
        let currentTime = 0
        let frameIndex = 0
        let currentSei = null

        while (cursor + 4 <= end) {
            const nalSize = this.view.getUint32(cursor)
            cursor += 4

            if (nalSize < 2 || cursor + nalSize > this.view.byteLength) {
                cursor += Math.max(nalSize, 0)
                continue
            }

            const nalType = this.view.getUint8(cursor) & 0x1F
            const nalData = new Uint8Array(this.buffer.slice(cursor, cursor + nalSize))

            // Extract SEI data (NAL type 6)
            if (nalType === 6 && SeiMetadata) {
                const sei = this.dashcamMp4.decodeSei(nalData, SeiMetadata)
                if (sei) {
                    currentSei = sei
                }
            }

            // Process video frames (type 5 = IDR keyframe, type 1 = non-IDR)
            if (nalType === 5 || nalType === 1) {
                // Use duration from config, or calculate from timescale if available
                const duration = config.durations[frameIndex] || (1000 / (config.timescale || 1000))
                frames.push({
                    frameIndex,
                    timestamp: currentTime,
                    duration,
                    keyframe: nalType === 5,
                    data: nalData,
                    sei: currentSei,
                    sps: nalType === 5 ? config.sps : null,
                    pps: nalType === 5 ? config.pps : null
                })
                currentTime += duration
                frameIndex++
            }

            cursor += nalSize
        }

        return frames
    }

    /** Concatenate Uint8Arrays */
    static concat(...arrays) {
        const result = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0))
        let offset = 0
        for (const arr of arrays) {
            result.set(arr, offset)
            offset += arr.length
        }
        return result
    }
}

/**
 * Create EncodedVideoChunk from frame data
 * Prepends start codes and SPS/PPS for keyframes
 */
export function createVideoChunk(frame, config) {
    const startCode = new Uint8Array([0, 0, 0, 1])
    
    // Keyframes need SPS + PPS prepended
    const data = frame.keyframe
        ? WebCodecsMP4.concat(
            startCode, frame.sps || config.sps,
            startCode, frame.pps || config.pps,
            startCode, frame.data
          )
        : WebCodecsMP4.concat(startCode, frame.data)
    
    return new EncodedVideoChunk({
        type: frame.keyframe ? 'key' : 'delta',
        timestamp: frame.timestamp * 1000, // Convert ms to µs
        data
    })
}

/**
 * WebCodecs-based video player for main feed
 */
export class WebCodecsPlayer {
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.decoder = null
        this.frames = []
        this.config = null
        this.currentFrameIndex = 0
        this.decoding = false
        this.pendingFrame = null
        this.abortController = null
        this.disposed = false
        
        // Frame cache: store decoded frames to avoid re-decoding
        this.frameCache = new Map() // Map<frameIndex, ImageBitmap>
        this.maxCacheSize = 60 // Cache up to 60 frames (about 2 seconds at 30fps)
        
        // Decoder state tracking for smart re-use
        this.decoderKeyframeIndex = -1 // Track which keyframe the current decoder started from
        this.decoderLastIndex = -1 // Track the last frame index decoded
    }

    /**
     * Load video file and parse frames
     */
    async load(file, SeiMetadata) {
        const buffer = await file.arrayBuffer()
        const mp4 = new WebCodecsMP4(buffer)
        
        this.config = mp4.getConfig()
        this.frames = mp4.parseFrames(SeiMetadata)
        this.disposed = false
        
        // Clear cache when loading new video
        this.clearCache()
        
        // Reset decoder state
        this.decoderKeyframeIndex = -1
        this.decoderLastIndex = -1
        
        // Set canvas dimensions
        this.canvas.width = this.config.width
        this.canvas.height = this.config.height
        
        return {
            duration: this.frames.length > 0 
                ? this.frames[this.frames.length - 1].timestamp + this.frames[this.frames.length - 1].duration
                : 0,
            frameCount: this.frames.length
        }
    }

    /**
     * Decode and render a specific frame
     */
    async showFrame(index) {
        if (this.disposed) return
        
        if (this.decoding) {
            this.pendingFrame = index
            return
        }

        if (!this.frames[index]) {
            console.warn(`Frame ${index} does not exist (total frames: ${this.frames.length})`)
            return
        }

        // Check cache first
        if (this.frameCache.has(index)) {
            const cachedBitmap = this.frameCache.get(index)
            try {
                this.ctx.drawImage(cachedBitmap, 0, 0)
                this.currentFrameIndex = index
                return
            } catch (e) {
                // Cache might be invalid, remove and decode
                this.frameCache.delete(index)
            }
        }

        await this.decodeFrame(index)
    }

    /**
     * Safely close the decoder
     */
    safeCloseDecoder() {
        if (this.decoder) {
            try {
                if (this.decoder.state !== 'closed') {
                    this.decoder.close()
                }
            } catch (e) {
                // Ignore close errors
            }
            this.decoder = null
            this.decoderKeyframeIndex = -1
            this.decoderLastIndex = -1
        }
    }

    /**
     * Decode frame with keyframe handling and smart caching
     */
    async decodeFrame(index) {
        if (this.disposed) return
        
        this.decoding = true
        this.currentFrameIndex = index

        try {
            // Find preceding keyframe
            let keyIdx = index
            while (keyIdx >= 0 && !this.frames[keyIdx].keyframe) {
                keyIdx--
            }

            if (keyIdx < 0) {
                console.error('No keyframe found before frame', index)
                this.decoding = false
                return
            }

            // Determine cache invalidation strategy
            // Must always decode from keyframe for H.264 (delta frames require sequential decode)
            let startIdx = keyIdx
            let needCacheInvalidation = false
            
            // Cache needs invalidation only for:
            // 1. Jumping to a different keyframe section (different GOP)
            // 2. Very large jumps (> 60 frames, beyond cache size)
            const frameDiff = Math.abs(index - this.decoderLastIndex)
            
            if (this.decoderKeyframeIndex !== keyIdx || frameDiff > this.maxCacheSize) {
                needCacheInvalidation = true
            }
            
            // Note: We CANNOT skip decoding cached frames with H.264
            // Each frame depends on the previous frame's decoded data
            // The decoder must process frames sequentially from keyframe
            // Our cache optimization works at the RENDER level, not decode level

            // Invalidate cache if necessary (prevents stale frames from wrong decode sessions)
            if (needCacheInvalidation) {
                this.clearCache()
            }

            // Always close and recreate decoder (callbacks need fresh closure variables)
            this.safeCloseDecoder()

            if (this.disposed) {
                this.decoding = false
                return
            }

            // Calculate lookahead for caching
            const lookaheadFrames = 5
            const endIdx = Math.min(index + lookaheadFrames, this.frames.length - 1)
            const totalFramesToDecode = endIdx - startIdx + 1
            
            let count = 0
            let resolved = false
            let targetRendered = false

            await new Promise((resolve, reject) => {
                if (this.disposed) {
                    resolve()
                    return
                }

                // Always create new decoder (fresh callbacks with correct closure variables)
                this.decoder = new VideoDecoder({
                    output: (frame) => {
                        const currentIdx = startIdx + count
                        count++
                        
                        // Cache all decoded frames within lookahead range
                        // But skip frames that are already cached (save memory/CPU)
                        const shouldCache = Math.abs(currentIdx - index) <= 5
                        const alreadyCached = this.frameCache.has(currentIdx)
                        
                        if (shouldCache && !alreadyCached) {
                            createImageBitmap(frame).then(bitmap => {
                                this.addToCache(currentIdx, bitmap)
                            }).catch(() => {})
                        } else if (alreadyCached) {
                            // Frame already cached - skip creating ImageBitmap
                            // This saves CPU and memory
                        }
                        
                        // Render the target frame when we reach it
                        if (currentIdx === index && !targetRendered) {
                            targetRendered = true
                            try {
                                this.ctx.drawImage(frame, 0, 0)
                            } catch (e) {
                                // Canvas might be unavailable
                            }
                        }
                        
                        frame.close()
                        
                        // Resolve when all frames (including lookahead) are decoded
                        if (count >= totalFramesToDecode && !resolved) {
                            resolved = true
                            resolve()
                        }
                    },
                    error: (e) => {
                        if (!resolved) {
                            resolved = true
                            // Don't reject on abort errors
                            if (e.name === 'AbortError' || e.message?.includes('aborted')) {
                                resolve()
                            } else {
                                reject(e)
                            }
                        }
                    }
                })

                this.decoder.configure({
                    codec: this.config.codec,
                    codedWidth: this.config.width,
                    codedHeight: this.config.height
                })
                
                this.decoderKeyframeIndex = keyIdx

                // Decode from keyframe to endIdx (H.264 requires sequential decode from keyframe)
                for (let i = startIdx; i <= endIdx; i++) {
                    if (this.disposed || this.decoder.state === 'closed') break
                    try {
                        this.decoder.decode(createVideoChunk(this.frames[i], this.config))
                    } catch (e) {
                        // Decoder might have been closed
                        break
                    }
                }
                
                // Update last decoded index (to the actual end of decode, not just target)
                this.decoderLastIndex = endIdx
                
                if (!this.disposed && this.decoder.state !== 'closed') {
                    this.decoder.flush().catch(() => {
                        // Flush might fail if decoder was closed
                        if (!resolved) {
                            resolved = true
                            resolve()
                        }
                    })
                } else if (!resolved) {
                    resolved = true
                    resolve()
                }
            })
        } catch (e) {
            // Silently ignore abort errors during rapid navigation
            if (e.name !== 'AbortError' && !e.message?.includes('aborted')) {
                console.error('Decode error:', e)
            }
        } finally {
            this.decoding = false

            // Process queued frame if pending
            if (this.pendingFrame !== null && !this.disposed) {
                const next = this.pendingFrame
                this.pendingFrame = null
                // Use setTimeout to prevent stack overflow on rapid seeks
                setTimeout(() => this.showFrame(next), 0)
            }
        }
    }
    
    /**
     * Add frame to cache with LRU eviction
     */
    addToCache(frameIndex, bitmap) {
        // Remove oldest entries if cache is full
        if (this.frameCache.size >= this.maxCacheSize) {
            const firstKey = this.frameCache.keys().next().value
            const oldBitmap = this.frameCache.get(firstKey)
            if (oldBitmap && oldBitmap.close) {
                oldBitmap.close()
            }
            this.frameCache.delete(firstKey)
        }
        
        this.frameCache.set(frameIndex, bitmap)
    }
    
    /**
     * Clear the entire frame cache
     * Called when seeking to different parts of the video
     */
    clearCache() {
        for (const bitmap of this.frameCache.values()) {
            if (bitmap && bitmap.close) {
                bitmap.close()
            }
        }
        this.frameCache.clear()
    }

    /**
     * Get frame index for a given time
     */
    getFrameIndexAtTime(timeMs) {
        if (!this.frames || this.frames.length === 0) return 0
        
        // Binary search for frame at time
        let lo = 0
        let hi = this.frames.length - 1
        
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2)
            if (this.frames[mid].timestamp <= timeMs) {
                lo = mid
            } else {
                hi = mid - 1
            }
        }
        
        return lo
    }

    /**
     * Get SEI data for current frame
     */
    getCurrentSei() {
        return this.frames[this.currentFrameIndex]?.sei || null
    }

    /**
     * Get frame by index
     */
    getFrame(index) {
        return this.frames[index] || null
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.disposed = true
        this.pendingFrame = null
        this.safeCloseDecoder()
        
        // Clean up frame cache
        for (const bitmap of this.frameCache.values()) {
            if (bitmap && bitmap.close) {
                bitmap.close()
            }
        }
        this.frameCache.clear()
        
        this.frames = []
        this.config = null
    }
}
