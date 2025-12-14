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
  onSpeedUnitToggle, 
  onDebugClick 
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
  const speedLabel = speedUnit.toUpperCase();

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
          <div className="sei-racing-indicator sei-racing-blinker-left">◀</div>
        )}
        {seiData.blinker_on_right && (
          <div className="sei-racing-indicator sei-racing-blinker-right">▶</div>
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
              ⊕
            </div>
            <div className="sei-racing-steering-angle">
              {Math.round(seiData?.steering_wheel_angle || 0)}°
            </div>
          </div>
        </div>

        {/* G-Force Meter */}
        <div className="sei-racing-metric">
          <div className="sei-racing-metric-label">G-FORCE</div>
          <div className="sei-racing-gforce">
            <div className="sei-racing-gforce-item">
              <span className="sei-racing-gforce-axis">LAT</span>
              <span className={`sei-racing-gforce-value ${Math.abs(gForce.lateral) > 0.5 ? 'active' : ''}`}>
                {gForce.lateral}
              </span>
            </div>
            <div className="sei-racing-gforce-item">
              <span className="sei-racing-gforce-axis">LON</span>
              <span className={`sei-racing-gforce-value ${Math.abs(gForce.longitudinal) > 0.5 ? 'active' : ''}`}>
                {gForce.longitudinal}
              </span>
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
