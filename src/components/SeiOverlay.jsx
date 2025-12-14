import { getSeiLayout } from '../layouts/seiLayouts';

/**
 * SeiOverlay Wrapper Component
 * 
 * This component acts as a wrapper that dynamically renders the selected SEI layout.
 * Each layout is completely independent and can have its own DOM structure.
 * 
 * The wrapper div ensures SEI layouts don't cover the media player controls
 * by constraining the layout area. Layouts can freely use bottom: 0 within this constrained area.
 */
export function SeiOverlay({ 
  seiData, 
  isLoading, 
  error, 
  currentAngle, 
  speedUnit = 'mph', 
  onSpeedUnitToggle, 
  isHighPrecision = false,
  layoutId = 'default'
}) {
  // Get the layout configuration and component
  const layout = getSeiLayout(layoutId);
  const LayoutComponent = layout.component;

  // Render the selected layout component within a constrained wrapper
  // The wrapper prevents layouts from covering media controls at the bottom
  return (
    <div className="sei-overlay-wrapper">
      <LayoutComponent
        seiData={seiData}
        isLoading={isLoading}
        error={error}
        currentAngle={currentAngle}
        speedUnit={speedUnit}
        onSpeedUnitToggle={onSpeedUnitToggle}
        isHighPrecision={isHighPrecision}
      />
    </div>
  );
}
