/**
 * Tesla Dashcam MP4 Parser
 * Parses MP4 files and extracts SEI metadata from Tesla dashcam footage.
 */
export class DashcamMP4 {
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this._config = null;
    }

    // -------------------------------------------------------------
    // MP4 Box Navigation
    // -------------------------------------------------------------

    /** Find a box by name within a range */
    findBox(start, end, name) {
        for (let pos = start; pos + 8 <= end;) {
            let size = this.view.getUint32(pos);
            const type = this.readAscii(pos + 4, 4);
            const headerSize = size === 1 ? 16 : 8;

            if (size === 1) {
                const high = this.view.getUint32(pos + 8);
                const low = this.view.getUint32(pos + 12);
                size = Number((BigInt(high) << 32n) | BigInt(low));
            } else if (size === 0) {
                size = end - pos;
            }

            if (type === name) {
                return { start: pos + headerSize, end: pos + size, size: size - headerSize };
            }
            pos += size;
        }
        throw new Error(`Box "${name}" not found`);
    }

    /** Find mdat box and return content location */
    findMdat() {
        const mdat = this.findBox(0, this.view.byteLength, 'mdat');
        return { offset: mdat.start, size: mdat.size };
    }

    // -------------------------------------------------------------
    // SEI Extraction
    // -------------------------------------------------------------

    /** Extract all SEI messages for timeline mapping */
    extractSeiMessages(SeiMetadata) {
        const mdat = this.findMdat();
        const messages = [];
        let cursor = mdat.offset;
        const end = mdat.offset + mdat.size;
        let frameIndex = 0;

        while (cursor + 4 <= end) {
            const nalSize = this.view.getUint32(cursor);
            cursor += 4;

            if (nalSize < 2 || cursor + nalSize > this.view.byteLength) {
                cursor += Math.max(nalSize, 0);
                continue;
            }

            const nalType = this.view.getUint8(cursor) & 0x1F;
            
            // NAL type 6 = SEI, payload type 5 = user data unregistered
            if (nalType === 6 && this.view.getUint8(cursor + 1) === 5) {
                const sei = this.decodeSei(new Uint8Array(this.buffer.slice(cursor, cursor + nalSize)), SeiMetadata);
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

    /** Decode SEI NAL unit to protobuf message */
    decodeSei(nal, SeiMetadata) {
        if (!SeiMetadata || nal.length < 4) return null;

        let i = 3;
        while (i < nal.length && nal[i] === 0x42) i++;
        if (i <= 3 || i + 1 >= nal.length || nal[i] !== 0x69) return null;

        try {
            return SeiMetadata.decode(this.stripEmulationBytes(nal.subarray(i + 1, nal.length - 1)));
        } catch {
            return null;
        }
    }

    /** Strip H.264 emulation prevention bytes */
    stripEmulationBytes(data) {
        const out = [];
        let zeros = 0;
        for (const byte of data) {
            if (zeros >= 2 && byte === 0x03) { zeros = 0; continue; }
            out.push(byte);
            zeros = byte === 0 ? zeros + 1 : 0;
        }
        return Uint8Array.from(out);
    }

    // -------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------

    readAscii(start, len) {
        let s = '';
        for (let i = 0; i < len; i++) s += String.fromCharCode(this.view.getUint8(start + i));
        return s;
    }
}
