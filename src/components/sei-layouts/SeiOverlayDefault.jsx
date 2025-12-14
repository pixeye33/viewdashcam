import { useMemo, useState } from 'react';
import '../SeiOverlay.css';
import wheelIcon from '../../../wheel.svg';

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

export function SeiOverlayDefault({ seiData, isLoading, error, currentAngle, speedUnit = 'mph', onSpeedUnitToggle, isHighPrecision = false }) {
  const [showPrecisionModal, setShowPrecisionModal] = useState(false);
  
  // Convert m/s to mph
  const speedMph = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return (seiData.vehicle_speed_mps * 2.23694).toFixed(1);
  }, [seiData]);

  // Convert m/s to km/h
  const speedKmh = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return (seiData.vehicle_speed_mps * 3.6).toFixed(1);
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
    <>
      <div className="sei-overlay">
        {/* High Precision Indicator */}
        <div 
          className={`sei-precision-indicator ${!isHighPrecision ? 'disabled' : ''}`}
          onClick={() => setShowPrecisionModal(true)}
          title={isHighPrecision ? "High precision mode active - Click to learn more" : "Standard mode - Click to learn about high precision"}
        >
          <span className="precision-icon">⚡</span>
          <span className="precision-text">{isHighPrecision ? 'High Precision' : 'Standard Mode'}</span>
        </div>

        {/* Speed Display */}
        <div 
          className="sei-component sei-speed" 
          onClick={onSpeedUnitToggle}
          style={{ cursor: 'pointer' }}
          title="Click to toggle between mph and km/h"
        >
          <div className="sei-label">Speed</div>
          {speedUnit === 'mph' ? (
            <>
              <div className="sei-value-large">{speedMph}</div>
              <div className="sei-unit">mph</div>
              <div className="sei-value-small">{speedKmh} km/h</div>
            </>
          ) : (
            <>
              <div className="sei-value-large">{speedKmh}</div>
              <div className="sei-unit">km/h</div>
              <div className="sei-value-small">{speedMph} mph</div>
            </>
          )}
        </div>

        {/* Gear State */}
        <div className="sei-component sei-gear">
          <div className="sei-label">Gear</div>
          <div className="sei-value-large">{GEAR_LABELS[seiData.gear_state] || '-'}</div>
        </div>

        {/* Steering Wheel Angle */}
        <div className="sei-component sei-steering">
          <div className="sei-label">Steering</div>
          <div className="sei-value-medium">{(seiData.steering_wheel_angle || 0).toFixed(1)}°</div>
          <div className="sei-steering-indicator">
            <img 
              src={wheelIcon} 
              alt="Steering Wheel"
              className="sei-steering-wheel" 
              style={{ 
                transform: `rotate(${seiData.steering_wheel_angle || 0}deg)` 
              }}
            />
          </div>
        </div>

        {/* Accelerator Pedal */}
        <div className="sei-component sei-pedal">
          <div className="sei-label">Accelerator</div>
          <div className="sei-value-medium">{(seiData.accelerator_pedal_position || 0).toFixed(0)}</div>
          <div className="sei-bar-container">
            <div 
              className="sei-bar-fill sei-bar-accelerator" 
              style={{ width: `${seiData.accelerator_pedal_position || 0}%` }}
            />
          </div>
        </div>

        {/* Brake Status */}
        <div className={`sei-component sei-brake ${seiData.brake_applied ? 'sei-brake-active' : ''}`}>
          <div className="sei-label">Brake</div>
          <div className="sei-value-medium">{seiData.brake_applied ? 'ON' : 'OFF'}</div>
        </div>

        {/* Blinker Status */}
        <div className="sei-component sei-blinkers">
          <div className="sei-label">Blinkers</div>
          <div className="sei-blinker-row">
            <div className={`sei-blinker-indicator sei-blinker-left ${seiData.blinker_on_left ? 'sei-blinker-active' : ''}`}>
              <img src="/blinker.svg" alt="Left Blinker" className="sei-blinker-icon" />
            </div>
            <div className={`sei-blinker-indicator sei-blinker-right ${seiData.blinker_on_right ? 'sei-blinker-active' : ''}`}>
              <img src="/blinker.svg" alt="Right Blinker" className="sei-blinker-icon sei-blinker-icon-right" />
            </div>
          </div>
        </div>

        {/* Autopilot State */}
        <div className={`sei-component sei-autopilot ${seiData.autopilot_state === 0 ? 'sei-autopilot-inactive' : ''}`}>
          <div className="sei-label">Autopilot</div>
          <div className="sei-value-medium">{AUTOPILOT_LABELS[seiData.autopilot_state] || 'OFF'}</div>
        </div>

        {/* GPS Coordinates */}
        {seiData.latitude_deg && seiData.longitude_deg && (
          <div className="sei-component sei-gps">
            <div className="sei-label">GPS</div>
            <div className="sei-value-small">
              {seiData.latitude_deg.toFixed(6)}, {seiData.longitude_deg.toFixed(6)}
            </div>
            {seiData.heading_deg !== undefined && (
              <div className="sei-value-small">Heading: {seiData.heading_deg.toFixed(1)}°</div>
            )}
          </div>
        )}

        {/* Acceleration */}
        {(seiData.linear_acceleration_mps2_x !== undefined || 
          seiData.linear_acceleration_mps2_y !== undefined || 
          seiData.linear_acceleration_mps2_z !== undefined) && (
          <div className="sei-component sei-acceleration">
            <div className="sei-label">Acceleration</div>
            <div className="sei-value-small">
              X: {(seiData.linear_acceleration_mps2_x || 0).toFixed(2)} m/s²
            </div>
            <div className="sei-value-small">
              Y: {(seiData.linear_acceleration_mps2_y || 0).toFixed(2)} m/s²
            </div>
            <div className="sei-value-small">
              Z: {(seiData.linear_acceleration_mps2_z || 0).toFixed(2)} m/s²
            </div>
          </div>
        )}
      </div>

      {/* Precision Modal */}
      {showPrecisionModal && (
        <div className="modal-overlay" onClick={() => setShowPrecisionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Telemetry Precision Modes</h2>
              <button className="modal-close" onClick={() => setShowPrecisionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>
                The telemetry data displayed can be extracted using two different methods, each with different accuracy levels.
              </p>
                            
              <div className="precision-comparison">
                <div className={`precision-method ${!isHighPrecision ? 'precision-method-active' : ''}`}>
                  <div className="precision-method-title">Standard Mode {!isHighPrecision && '(Current)'}</div>
                  <div className="precision-method-desc">
                    During normal playback, SEI data is extracted from the MP4 file and matched to the current video timestamp. This requires estimating which frame is currently displayed based on the playback time and calculated FPS.
                  </div>
                  <div className="precision-accuracy">Accuracy: ±1-2 frames</div>
                </div>
                
                <div className={`precision-method ${isHighPrecision ? 'precision-method-active' : ''}`}>
                  <div className="precision-method-title">
                    <span className="precision-icon">⚡</span>
                    High Precision Mode {isHighPrecision && '(Current)'}
                  </div>
                  <div className="precision-method-desc">
                    In frame-by-frame navigation, each video frame is decoded individually using WebCodecs, and the SEI metadata is extracted directly from that exact decoded frame. There's no time-based estimation involved.
                  </div>
                  <div className="precision-accuracy">Accuracy: Exact frame match</div>
                </div>
              </div>
              
              <div className="precision-tip">
                <strong>Tip:</strong> Use the left/right arrow keys (←/→) to navigate frame-by-frame and automatically activate High Precision Mode for perfect frame accuracy.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
