import { useMemo } from 'react';
import './SeiOverlayMinimal.css';

// Autopilot state mapping
const AUTOPILOT_LABELS = {
  0: 'OFF',
  1: 'Self Driving',
  2: 'Autosteer',
  3: 'TACC'
};

export function SeiOverlayMinimal({ 
  seiData, 
  isLoading, 
  error, 
  currentAngle, 
  speedUnit = 'mph', 
  onSpeedUnitToggle, 
  isHighPrecision = false 
}) {
  // Calculate speed based on unit preference
  const speedMph = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return Math.round(seiData.vehicle_speed_mps * 2.23694);
  }, [seiData]);

  const speedKmh = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return Math.round(seiData.vehicle_speed_mps * 3.6);
  }, [seiData]);

  const displaySpeed = speedUnit === 'mph' ? speedMph : speedKmh;

  // Get gear letter
  const gearLetter = useMemo(() => {
    if (!seiData?.gear_state && seiData?.gear_state !== 0) return 'P';
    return ['P', 'D', 'R', 'N'][seiData.gear_state] || 'P';
  }, [seiData]);

  // Get steering wheel angle for rotation
  const steeringAngle = useMemo(() => {
    return seiData?.steering_wheel_angle || 0;
  }, [seiData]);

  // Get autopilot state label
  const autopilotLabel = useMemo(() => {
    return AUTOPILOT_LABELS[seiData?.autopilot_state] || 'OFF';
  }, [seiData]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="sei-overlay-minimal">
        <div className="minimal-loading">Loading...</div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="sei-overlay-minimal">
        <div className="minimal-error">Error: {error}</div>
      </div>
    );
  }

  // Handle no data
  if (!seiData) {
    return null;
  }

  return (
    <div className="sei-overlay-minimal">
      {/* Compact card at top center - 5 columns */}
      <div className="minimal-card">
        {/* Column 1: Gear - Vertical Stack */}
        <div className="card-column">
          <div className="card-circle card-gear">
            {gearLetter}
          </div>
          <div className={`card-circle card-brake ${seiData.brake_applied ? 'brake-active' : ''}`}>
            <img 
              src="/left-pedal.png" 
              alt="Left Pedal" 
              className="pedal-icon" 
            />
          </div>
        </div>

        {/* Column 2: Left Blinker */}
        <div className={`card-blinker card-blinker-left ${seiData.blinker_on_left ? 'active' : ''}`}>
          <img 
            src="/blinker.svg" 
            alt="Left Blinker" 
            className="blinker-icon" 
          />
        </div>

        {/* Column 3: Speed Display */}
        <div className="card-speed" onClick={onSpeedUnitToggle}>
          <div className="card-speed-value">{displaySpeed}</div>
          <div className="card-speed-unit">{speedUnit}</div>
        </div>

        {/* Column 4: Right Blinker */}
        <div className={`card-blinker card-blinker-right ${seiData.blinker_on_right ? 'active' : ''}`}>
          <img 
            src="/blinker.svg" 
            alt="Right Blinker" 
            className="blinker-icon blinker-icon-right" 
          />
        </div>

        {/* Column 5: Steering Wheel - Vertical Stack */}
        <div className="card-column">
          <div className="card-circle card-steering">
            <img 
              src="/wheel.svg" 
              alt="Steering Wheel" 
              className="wheel-icon" 
              style={{ transform: `rotate(${steeringAngle}deg)` }}
            />
          </div>
          <div className="card-circle card-accelerator">
            <div 
              className="accelerator-fill"
              style={{ height: `${seiData.accelerator_pedal_position || 0}%` }}
            />
            <img 
              src="/right-pedal.png" 
              alt="Right Pedal" 
              className="pedal-icon pedal-icon-overlay" 
            />
          </div>
        </div>
      </div>

      {/* Autopilot State Label - Below card (only shown when active) */}
      {seiData.autopilot_state !== undefined && seiData.autopilot_state !== null && seiData.autopilot_state !== 0 && (
        <div className="minimal-label">
          {autopilotLabel}
        </div>
      )}
    </div>
  );
}
