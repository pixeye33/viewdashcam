import { useMemo } from 'react';
import './SeiOverlayIconLine.css';

// Gear state mapping
const GEAR_LABELS = {
  0: 'P',
  1: 'D',
  2: 'R',
  3: 'N'
};

// Autopilot state mapping
const AUTOPILOT_LABELS = {
  0: 'OFF',
  1: 'Self Driving',
  2: 'Autosteer',
  3: 'TACC'
};

export function SeiOverlayIconLine({ 
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

  // Get steering wheel angle for rotation
  const steeringAngle = useMemo(() => {
    return seiData?.steering_wheel_angle || 0;
  }, [seiData]);

  // Get gear letter
  const gearLetter = useMemo(() => {
    if (!seiData?.gear_state && seiData?.gear_state !== 0) return 'P';
    return GEAR_LABELS[seiData.gear_state] || 'P';
  }, [seiData]);

  // Get autopilot state label
  const autopilotLabel = useMemo(() => {
    return AUTOPILOT_LABELS[seiData?.autopilot_state] || 'OFF';
  }, [seiData]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="sei-overlay-icon-line">
        <div className="icon-line-loading">Loading...</div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="sei-overlay-icon-line">
        <div className="icon-line-error">Error: {error}</div>
      </div>
    );
  }

  // Handle no data
  if (!seiData) {
    return null;
  }

  return (
    <div className="sei-overlay-icon-line">
      {/* Single line layout with 4 icons (no circles) */}
      <div className="icon-line-row">
        {/* Brake Pedal */}
        <div className={`icon-line-item ${seiData.brake_applied ? 'brake-active' : ''}`}>
          <img 
            src="/left-pedal.png" 
            alt="Brake" 
            className="icon-line-image" 
          />
        </div>

        {/* Gear Indicator */}
        <div className="icon-line-item icon-line-gear">
          <div className="icon-line-gear-letter">{gearLetter}</div>
        </div>

        {/* Left Blinker */}
        <div className={`icon-line-blinker ${seiData.blinker_on_left ? 'blinker-active' : ''}`}>
          <img 
            src="/blinker.svg" 
            alt="Left Blinker" 
            className="icon-line-image blinker-left" 
          />
        </div>

        {/* Speed Display */}
        <div className="icon-line-speed" onClick={onSpeedUnitToggle}>
          <div className="icon-line-speed-value">{displaySpeed}</div>
          <div className="icon-line-speed-unit">{speedUnit}</div>
        </div>

        {/* Right Blinker */}
        <div className={`icon-line-blinker ${seiData.blinker_on_right ? 'blinker-active' : ''}`}>
          <img 
            src="/blinker.svg" 
            alt="Right Blinker" 
            className="icon-line-image blinker-right" 
          />
        </div>

        {/* Steering Wheel */}
        <div className="icon-line-item">
          <img 
            src="/wheel.svg" 
            alt="Steering" 
            className="icon-line-image" 
            style={{ transform: `rotate(${steeringAngle}deg)` }}
          />
        </div>

        {/* Accelerator Pedal with fill */}
        <div className="icon-line-item accelerator-wrapper">
          <div 
            className="accelerator-fill-bg"
            style={{ height: `${seiData.accelerator_pedal_position || 0}%` }}
          />
          <img 
            src="/right-pedal.png" 
            alt="Accelerator" 
            className="icon-line-image accelerator-image" 
          />
        </div>
      </div>

      {/* Autopilot State Label - Below icons (only shown when active) */}
      {seiData.autopilot_state !== undefined && seiData.autopilot_state !== null && seiData.autopilot_state !== 0 && (
        <div className="icon-line-autopilot">
          {autopilotLabel}
        </div>
      )}
    </div>
  );
}
