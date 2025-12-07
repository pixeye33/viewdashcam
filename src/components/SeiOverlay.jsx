import { useMemo } from 'react';
import './SeiOverlay.css';

// Gear state mapping
const GEAR_LABELS = {
  0: 'P',
  1: 'D',
  2: 'R',
  3: 'N'
};

// Autopilot state mapping
const AUTOPILOT_LABELS = {
  0: 'None',
  1: 'Self Driving',
  2: 'Autosteer',
  3: 'TACC'
};

export function SeiOverlay({ seiData, isLoading, error }) {
  // Convert m/s to mph
  const speedMph = useMemo(() => {
    if (!seiData?.vehicleSpeedMps) return 0;
    return (seiData.vehicleSpeedMps * 2.23694).toFixed(1);
  }, [seiData]);

  // Convert m/s to km/h
  const speedKmh = useMemo(() => {
    if (!seiData?.vehicleSpeedMps) return 0;
    return (seiData.vehicleSpeedMps * 3.6).toFixed(1);
  }, [seiData]);

  if (isLoading) {
    return (
      <div className="sei-overlay">
        <div className="sei-message">Loading SEI data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sei-overlay">
        <div className="sei-message sei-error">SEI: {error}</div>
      </div>
    );
  }

  if (!seiData) {
    return null;
  }

  return (
    <div className="sei-overlay">
      {/* Speed Display */}
      <div className="sei-component sei-speed">
        <div className="sei-label">Speed</div>
        <div className="sei-value-large">{speedMph}</div>
        <div className="sei-unit">mph</div>
        <div className="sei-value-small">{speedKmh} km/h</div>
      </div>

      {/* Gear State */}
      <div className="sei-component sei-gear">
        <div className="sei-label">Gear</div>
        <div className="sei-value-large">{GEAR_LABELS[seiData.gearState] || '-'}</div>
      </div>

      {/* Steering Wheel Angle */}
      <div className="sei-component sei-steering">
        <div className="sei-label">Steering</div>
        <div className="sei-value-medium">{(seiData.steeringWheelAngle || 0).toFixed(1)}°</div>
        <div className="sei-steering-indicator">
          <div 
            className="sei-steering-bar" 
            style={{ 
              transform: `rotate(${Math.max(-90, Math.min(90, seiData.steeringWheelAngle || 0))}deg)` 
            }}
          />
        </div>
      </div>

      {/* Accelerator Pedal */}
      <div className="sei-component sei-pedal">
        <div className="sei-label">Accelerator</div>
        <div className="sei-value-medium">{((seiData.acceleratorPedalPosition || 0) * 100).toFixed(0)}%</div>
        <div className="sei-bar-container">
          <div 
            className="sei-bar-fill sei-bar-accelerator" 
            style={{ width: `${(seiData.acceleratorPedalPosition || 0) * 100}%` }}
          />
        </div>
      </div>

      {/* Brake Status */}
      <div className={`sei-component sei-brake ${seiData.brakeApplied ? 'sei-brake-active' : ''}`}>
        <div className="sei-label">Brake</div>
        <div className="sei-value-medium">{seiData.brakeApplied ? 'ON' : 'OFF'}</div>
      </div>

      {/* Blinker Status */}
      <div className="sei-component sei-blinkers">
        <div className="sei-label">Blinkers</div>
        <div className="sei-blinker-row">
          <div className={`sei-blinker-indicator sei-blinker-left ${seiData.blinkerOnLeft ? 'sei-blinker-active' : ''}`}>
            ◀
          </div>
          <div className={`sei-blinker-indicator sei-blinker-right ${seiData.blinkerOnRight ? 'sei-blinker-active' : ''}`}>
            ▶
          </div>
        </div>
      </div>

      {/* Autopilot State */}
      {seiData.autopilotState > 0 && (
        <div className="sei-component sei-autopilot">
          <div className="sei-label">Autopilot</div>
          <div className="sei-value-medium">{AUTOPILOT_LABELS[seiData.autopilotState] || 'Unknown'}</div>
        </div>
      )}

      {/* GPS Coordinates */}
      {seiData.latitudeDeg && seiData.longitudeDeg && (
        <div className="sei-component sei-gps">
          <div className="sei-label">GPS</div>
          <div className="sei-value-small">
            {seiData.latitudeDeg.toFixed(6)}, {seiData.longitudeDeg.toFixed(6)}
          </div>
          {seiData.headingDeg !== undefined && (
            <div className="sei-value-small">Heading: {seiData.headingDeg.toFixed(1)}°</div>
          )}
        </div>
      )}

      {/* Acceleration */}
      {(seiData.linearAccelerationMps2X !== undefined || 
        seiData.linearAccelerationMps2Y !== undefined || 
        seiData.linearAccelerationMps2Z !== undefined) && (
        <div className="sei-component sei-acceleration">
          <div className="sei-label">Acceleration</div>
          <div className="sei-value-small">
            X: {(seiData.linearAccelerationMps2X || 0).toFixed(2)} m/s²
          </div>
          <div className="sei-value-small">
            Y: {(seiData.linearAccelerationMps2Y || 0).toFixed(2)} m/s²
          </div>
          <div className="sei-value-small">
            Z: {(seiData.linearAccelerationMps2Z || 0).toFixed(2)} m/s²
          </div>
        </div>
      )}
    </div>
  );
}
