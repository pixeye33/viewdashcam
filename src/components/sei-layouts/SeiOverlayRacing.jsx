import { useMemo } from 'react';
import './SeiOverlayRacing.css';

// Gear state mapping
const GEAR_LABELS = {
  0: 'P',
  1: 'D',
  2: 'R',
  3: 'N'
};

// Autopilot state labels
const AUTOPILOT_LABELS = {
  0: 'OFF',
  1: 'FSD',
  2: 'AP',
  3: 'TACC'
};

export function SeiOverlayRacing({ 
  seiData, 
  isLoading, 
  error, 
  speedUnit = 'mph', 
  onSpeedUnitToggle 
}) {
  // Convert m/s to mph
  const speedMph = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return seiData.vehicle_speed_mps * 2.23694;
  }, [seiData]);

  // Convert m/s to km/h
  const speedKmh = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return seiData.vehicle_speed_mps * 3.6;
  }, [seiData]);

  // Calculate G-forces from acceleration
  const gForce = useMemo(() => {
    if (!seiData?.linear_acceleration_mps2_x && !seiData?.linear_acceleration_mps2_y) {
      return { lateral: 0, longitudinal: 0 };
    }
    return {
      lateral: ((seiData?.linear_acceleration_mps2_y || 0) / 9.81).toFixed(2),
      longitudinal: ((seiData?.linear_acceleration_mps2_x || 0) / 9.81).toFixed(2)
    };
  }, [seiData]);

  // Calculate acceleration circle position (normalized to circle radius)
  const accelPosition = useMemo(() => {
    const x = seiData?.linear_acceleration_mps2_x || 0;
    const y = seiData?.linear_acceleration_mps2_y || 0;
    const z = seiData?.linear_acceleration_mps2_z || 0;
    
    // Convert to G-forces
    const gx = x / 9.81;
    const gy = y / 9.81;
    const gz = z / 9.81;
    
    // Calculate magnitude
    const magnitude = Math.sqrt(gx * gx + gy * gy + gz * gz);
    
    // Map to circle (use X for horizontal, Y for vertical)
    // Scale to fit within circle (max 2G = edge of circle)
    const maxG = 2;
    const scale = 50; // Radius of circle in SVG units
    
    // Format values and fix -0.00 issue
    const formatG = (val) => {
      const fixed = val.toFixed(2);
      // Convert -0.00 to 0.00
      return fixed === '-0.00' ? '0.00' : fixed;
    };
    
    return {
      x: (gx / maxG) * scale,
      y: -(gy / maxG) * scale, // Negative because SVG Y axis is inverted
      magnitude: formatG(magnitude),
      gx: formatG(gx),
      gy: formatG(gy),
      gz: formatG(gz)
    };
  }, [seiData]);

  // Calculate speedometer arc angle (0-280 degrees)
  const speedAngle = useMemo(() => {
    const speed = speedUnit === 'mph' ? speedMph : speedKmh;
    const maxSpeed = speedUnit === 'mph' ? 120 : 200;
    const angle = Math.min((speed / maxSpeed) * 280, 280);
    return angle;
  }, [speedMph, speedKmh, speedUnit]);

  // Calculate steering wheel rotation (normalized to -180 to +180)
  const steeringRotation = useMemo(() => {
    if (!seiData?.steering_wheel_angle) return 0;
    // Tesla steering wheel ranges from -540 to +540, normalize to -180 to +180
    return Math.max(-180, Math.min(180, seiData.steering_wheel_angle / 3));
  }, [seiData]);

  if (isLoading) {
    return (
      <div className="sei-overlay-racing">
        <div className="sei-racing-message">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sei-overlay-racing">
        <div className="sei-racing-message sei-racing-error">Error: {error}</div>
      </div>
    );
  }

  if (!seiData) {
    return null;
  }

  const displaySpeed = speedUnit === 'mph' ? speedMph : speedKmh;
  const speedLabel = speedUnit;

  return (
    <div className="sei-overlay-racing">
      {/* Left Side - Speed Gauge */}
      <div className="sei-racing-speedometer">
        <svg viewBox="0 0 200 200" className="sei-racing-gauge-svg">
          {/* Background arc */}
          <path
            d="M 30 170 A 90 90 0 1 1 170 170"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Speed arc */}
          <path
            d="M 30 170 A 90 90 0 1 1 170 170"
            fill="none"
            stroke="url(#speedGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${speedAngle * 1.57} 440`}
            className="sei-racing-speed-arc"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff00" />
              <stop offset="50%" stopColor="#ffff00" />
              <stop offset="100%" stopColor="#ff0000" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Speed Display */}
        <div className="sei-racing-speed-display" onClick={onSpeedUnitToggle} title="Click to toggle unit">
          <div className="sei-racing-speed-value">{Math.round(displaySpeed)}</div>
          <div className="sei-racing-speed-unit">{speedLabel}</div>
        </div>

        {/* Gear Display */}
        <div className="sei-racing-gear">
          {GEAR_LABELS[seiData.gear_state] || '-'}
        </div>
      </div>

      {/* Top Center - Status Indicators */}
      <div className="sei-racing-indicators">
        {/* Brake */}
        {seiData.brake_applied && (
          <div className="sei-racing-indicator sei-racing-brake">BRAKE</div>
        )}

        {/* Autopilot */}
        {seiData.autopilot_state > 0 && (
          <div className="sei-racing-indicator sei-racing-autopilot">
            {AUTOPILOT_LABELS[seiData.autopilot_state]}
          </div>
        )}

        {/* Blinkers */}
        {seiData.blinker_on_left && (
          <div className="sei-racing-indicator sei-racing-blinker-left">
            <img src="/blinker.svg" alt="Left Blinker" className="sei-racing-blinker-icon" />
          </div>
        )}
        {seiData.blinker_on_right && (
          <div className="sei-racing-indicator sei-racing-blinker-right">
            <img src="/blinker.svg" alt="Right Blinker" className="sei-racing-blinker-icon sei-racing-blinker-icon-right" />
          </div>
        )}
      </div>

      {/* Right Side - Performance Metrics */}
      <div className="sei-racing-metrics">
        {/* Steering Wheel Indicator */}
        <div className="sei-racing-metric">
          <div className="sei-racing-metric-label">STEERING</div>
          <div className="sei-racing-steering-wheel">
            <div 
              className="sei-racing-steering-indicator"
              style={{ transform: `rotate(${steeringRotation}deg)` }}
            >
              <img src="/wheel.svg" alt="Steering Wheel" className="sei-racing-wheel-icon" />
            </div>
            <div className="sei-racing-steering-angle">
              {Math.round(seiData?.steering_wheel_angle || 0)}°
            </div>
          </div>
        </div>

        {/* G-Force Meter - Circular Display */}
        <div className="sei-racing-metric">
          <div className="sei-racing-metric-label">G-FORCE</div>
          <div className="sei-racing-gforce-circle">
            <svg viewBox="0 0 120 120" className="sei-racing-gforce-svg">
              {/* Outer circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="rgba(0, 0, 0, 0.4)"
                stroke="rgba(0, 255, 0, 0.3)"
                strokeWidth="2"
              />
              
              {/* Inner circle (1G marker) */}
              <circle
                cx="60"
                cy="60"
                r="25"
                fill="none"
                stroke="rgba(0, 255, 0, 0.15)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              
              {/* Center crosshair */}
              <line x1="60" y1="55" x2="60" y2="65" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
              <line x1="55" y1="60" x2="65" y2="60" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
              
              {/* Acceleration point */}
              <circle
                cx={60 + accelPosition.x}
                cy={60 + accelPosition.y}
                r="6"
                fill="#00ff00"
                stroke="#ffffff"
                strokeWidth="2"
                className="sei-racing-gforce-point"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(0, 255, 0, 0.8))'
                }}
              />
              
              {/* Line from center to point */}
              <line
                x1="60"
                y1="60"
                x2={60 + accelPosition.x}
                y2={60 + accelPosition.y}
                stroke="rgba(0, 255, 0, 0.5)"
                strokeWidth="2"
              />
            </svg>
            
            {/* G-Force values below circle */}
            <div className="sei-racing-gforce-values">
              <div className="sei-racing-gforce-value-item">
                <span className="sei-racing-gforce-axis">X</span>
                <span className="sei-racing-gforce-num">{accelPosition.gx.startsWith('-') ? '' : '+'}{accelPosition.gx}</span>
              </div>
              <div className="sei-racing-gforce-value-item">
                <span className="sei-racing-gforce-axis">Y</span>
                <span className="sei-racing-gforce-num">{accelPosition.gy.startsWith('-') ? '' : '+'}{accelPosition.gy}</span>
              </div>
              <div className="sei-racing-gforce-value-item">
                <span className="sei-racing-gforce-axis">Z</span>
                <span className="sei-racing-gforce-num">{accelPosition.gz.startsWith('-') ? '' : '+'}{accelPosition.gz}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accelerator Position */}
        <div className="sei-racing-metric">
          <div className="sei-racing-metric-label">THROTTLE</div>
          <div className="sei-racing-bar-container">
            <div 
              className="sei-racing-bar-fill"
              style={{ height: `${seiData?.accelerator_pedal_position || 0}%` }}
            />
            <div className="sei-racing-bar-value">
              {Math.round(seiData?.accelerator_pedal_position || 0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
