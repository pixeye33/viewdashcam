import { useMemo } from 'react';
import './SeiOverlayCompact.css';

// Gear state mapping
const GEAR_LABELS = {
  0: 'P',
  1: 'D',
  2: 'R',
  3: 'N'
};

export function SeiOverlayCompact({ seiData, isLoading, error, speedUnit = 'mph', onSpeedUnitToggle, onDebugClick }) {
  // Convert m/s to mph
  const speedMph = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return (seiData.vehicle_speed_mps * 2.23694).toFixed(0);
  }, [seiData]);

  // Convert m/s to km/h
  const speedKmh = useMemo(() => {
    if (!seiData?.vehicle_speed_mps) return 0;
    return (seiData.vehicle_speed_mps * 3.6).toFixed(0);
  }, [seiData]);

  if (isLoading) {
    return (
      <div className="sei-overlay-compact">
        <div className="sei-compact-message">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sei-overlay-compact">
        <div className="sei-compact-message sei-compact-error">Error: {error}</div>
      </div>
    );
  }

  if (!seiData) {
    return null;
  }

  const displaySpeed = speedUnit === 'mph' ? speedMph : speedKmh;
  const speedLabel = speedUnit === 'mph' ? 'MPH' : 'KMH';

  return (
    <div className="sei-overlay-compact">
      {/* Compact HUD Display */}
      <div className="sei-compact-hud">
        {/* Speed */}
        <div 
          className="sei-compact-speed"
          onClick={onSpeedUnitToggle}
          title="Click to toggle speed unit"
        >
          <div className="sei-compact-speed-value">{displaySpeed}</div>
          <div className="sei-compact-speed-unit">{speedLabel}</div>
        </div>

        {/* Gear */}
        <div className="sei-compact-gear">
          <div className="sei-compact-gear-label">GEAR</div>
          <div className="sei-compact-gear-value">{GEAR_LABELS[seiData.gear_state] || '-'}</div>
        </div>

        {/* Brake Indicator */}
        {seiData.brake_applied && (
          <div className="sei-compact-brake">
            BRAKE
          </div>
        )}

        {/* Blinker Indicators */}
        {seiData.blinker_on_left && (
          <div className="sei-compact-blinker sei-compact-blinker-left">
            ◀
          </div>
        )}
        {seiData.blinker_on_right && (
          <div className="sei-compact-blinker sei-compact-blinker-right">
            ▶
          </div>
        )}
      </div>
    </div>
  );
}
