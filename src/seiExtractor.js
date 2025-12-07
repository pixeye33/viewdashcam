/**
 * Tesla Dashcam SEI Extractor
 * Extracts SEI metadata from Tesla dashcam MP4 files
 */
import protobuf from 'protobufjs'

export class DashcamMP4 {
  constructor(buffer) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this._config = null
  }

  // -------------------------------------------------------------
  // MP4 Box Navigation
  // -------------------------------------------------------------

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
    throw new Error(`Box "${name}" not found`)
  }

  /** Find mdat box and return content location */
  findMdat() {
    const mdat = this.findBox(0, this.view.byteLength, 'mdat')
    return { offset: mdat.start, size: mdat.size }
  }

  // -------------------------------------------------------------
  // SEI Extraction
  // -------------------------------------------------------------

  /** Extract all SEI messages */
  extractSeiMessages(SeiMetadata) {
    const mdat = this.findMdat()
    const messages = []
    let cursor = mdat.offset
    const end = mdat.offset + mdat.size

    while (cursor + 4 <= end) {
      const nalSize = this.view.getUint32(cursor)
      cursor += 4

      if (nalSize < 2 || cursor + nalSize > this.view.byteLength) {
        cursor += Math.max(nalSize, 0)
        continue
      }

      // NAL type 6 = SEI, payload type 5 = user data unregistered
      if ((this.view.getUint8(cursor) & 0x1F) === 6 && this.view.getUint8(cursor + 1) === 5) {
        const sei = this.decodeSei(new Uint8Array(this.buffer.slice(cursor, cursor + nalSize)), SeiMetadata)
        if (sei) messages.push(sei)
      }
      cursor += nalSize
    }
    return messages
  }

  /** Decode SEI NAL unit to protobuf message */
  decodeSei(nal, SeiMetadata) {
    if (!SeiMetadata || nal.length < 4) return null

    let i = 3
    while (i < nal.length && nal[i] === 0x42) i++
    if (i <= 3 || i + 1 >= nal.length || nal[i] !== 0x69) return null

    try {
      return SeiMetadata.decode(this.stripEmulationBytes(nal.subarray(i + 1, nal.length - 1)))
    } catch {
      return null
    }
  }

  /** Strip H.264 emulation prevention bytes */
  stripEmulationBytes(data) {
    const out = []
    let zeros = 0
    for (const byte of data) {
      if (zeros >= 2 && byte === 0x03) { 
        zeros = 0
        continue
      }
      out.push(byte)
      zeros = byte === 0 ? zeros + 1 : 0
    }
    return Uint8Array.from(out)
  }

  // -------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------

  readAscii(start, len) {
    let s = ''
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(this.view.getUint8(start + i))
    }
    return s
  }
}

// -------------------------------------------------------------
// SEI Extraction Helper
// -------------------------------------------------------------

let SeiMetadata = null

/** Initialize protobuf by loading the .proto file */
export async function initProtobuf(protoPath = '/dashcam.proto') {
  if (SeiMetadata) return SeiMetadata

  const response = await fetch(protoPath)
  const protoText = await response.text()
  const root = protobuf.parse(protoText).root
  SeiMetadata = root.lookupType('SeiMetadata')
  return SeiMetadata
}

/** Extract SEI data from video file */
export async function extractSeiData(file) {
  try {
    // Initialize protobuf if not already done
    const SeiMetadataType = await initProtobuf()
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Parse MP4 and extract SEI messages
    const parser = new DashcamMP4(arrayBuffer)
    const messages = parser.extractSeiMessages(SeiMetadataType)
    
    return messages
  } catch (error) {
    console.error('Error extracting SEI data:', error)
    return []
  }
}

/** Format SEI field value for display */
export function formatSeiValue(key, value) {
  if (value === undefined || value === null) return 'N/A'
  
  // Format based on field type
  switch (key) {
    case 'vehicle_speed_mps':
      // Convert m/s to km/h and mph
      const kmh = (value * 3.6).toFixed(1)
      const mph = (value * 2.237).toFixed(1)
      return `${kmh} km/h (${mph} mph)`
    
    case 'steering_wheel_angle':
      return `${value.toFixed(1)}°`
    
    case 'accelerator_pedal_position':
      return `${(value * 100).toFixed(0)}%`
    
    case 'gear_state':
      const gearMap = { 0: 'Park', 1: 'Drive', 2: 'Reverse', 3: 'Neutral' }
      return gearMap[value] || value
    
    case 'autopilot_state':
      const apMap = { 0: 'None', 1: 'Self-Driving', 2: 'Autosteer', 3: 'TACC' }
      return apMap[value] || value
    
    case 'latitude_deg':
    case 'longitude_deg':
      return value.toFixed(6)
    
    case 'heading_deg':
      return `${value.toFixed(1)}°`
    
    case 'linear_acceleration_mps2_x':
    case 'linear_acceleration_mps2_y':
    case 'linear_acceleration_mps2_z':
      return `${value.toFixed(2)} m/s²`
    
    case 'blinker_on_left':
    case 'blinker_on_right':
    case 'brake_applied':
      return value ? 'Yes' : 'No'
    
    default:
      if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2)
      }
      return String(value)
  }
}

/** Get human-readable label for SEI field */
export function getSeiFieldLabel(key) {
  const labels = {
    version: 'Version',
    gear_state: 'Gear',
    frame_seq_no: 'Frame #',
    vehicle_speed_mps: 'Speed',
    accelerator_pedal_position: 'Accelerator',
    steering_wheel_angle: 'Steering Angle',
    blinker_on_left: 'Left Blinker',
    blinker_on_right: 'Right Blinker',
    brake_applied: 'Brake',
    autopilot_state: 'Autopilot',
    latitude_deg: 'Latitude',
    longitude_deg: 'Longitude',
    heading_deg: 'Heading',
    linear_acceleration_mps2_x: 'Accel X',
    linear_acceleration_mps2_y: 'Accel Y',
    linear_acceleration_mps2_z: 'Accel Z'
  }
  return labels[key] || key
}
