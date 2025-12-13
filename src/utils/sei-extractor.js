/**
 * SEI Extraction Utilities
 * Extends Tesla's DashcamMP4 parser with frame index tracking for timeline mapping
 */

import { DashcamMP4 } from './dashcam-mp4.js';

/**
 * Extract SEI messages with frame index tracking
 * This wraps the Tesla DashcamMP4 extractSeiMessages method to add frameIndex for timeline mapping
 * 
 * @param {ArrayBuffer} arrayBuffer - MP4 file buffer
 * @param {Object} SeiMetadata - Protobuf SeiMetadata type
 * @returns {Array} Array of {frameIndex, sei} objects
 */
export function extractSeiMessagesWithFrameIndex(arrayBuffer, SeiMetadata) {
    const mp4 = new DashcamMP4(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const mdat = mp4.findMdat();
    const messages = [];
    let cursor = mdat.offset;
    const end = mdat.offset + mdat.size;
    let frameIndex = 0;

    while (cursor + 4 <= end) {
        const nalSize = view.getUint32(cursor);
        cursor += 4;

        if (nalSize < 2 || cursor + nalSize > view.byteLength) {
            cursor += Math.max(nalSize, 0);
            continue;
        }

        const nalType = view.getUint8(cursor) & 0x1F;
        
        // NAL type 6 = SEI, payload type 5 = user data unregistered
        if (nalType === 6 && view.getUint8(cursor + 1) === 5) {
            const sei = mp4.decodeSei(
                new Uint8Array(arrayBuffer.slice(cursor, cursor + nalSize)), 
                SeiMetadata
            );
            if (sei) {
                messages.push({ frameIndex, sei });
            }
        }
        
        // Count frames (type 5 = IDR, type 1 = non-IDR)
        if (nalType === 5 || nalType === 1) {
            frameIndex++;
        }
        
        cursor += nalSize;
    }
    
    return messages;
}
