import { getAllSeiLayouts } from '../layouts/seiLayouts'
import './SeiLayoutSelector.css'

export function SeiLayoutSelector({ currentLayout, onLayoutChange, isOpen, onToggle, onClose }) {
  const layouts = getAllSeiLayouts()

  const handleLayoutClick = (layoutId) => {
    onLayoutChange(layoutId)
    onClose()
  }

  const currentLayoutObj = layouts.find(l => l.id === currentLayout)

  return (
    <div className="sei-layout-selector">
      <button 
        className="sei-layout-selector-button"
        onClick={onToggle}
        title="Change SEI Overlay Layout"
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className="sei-layout-icon"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <span className="sei-layout-name">{currentLayoutObj?.name || 'Telemetry'}</span>
      </button>

      {isOpen && (
        <div className="sei-layout-selector-dropdown">
          <div className="sei-layout-selector-header">Telemetry Layout</div>
          {layouts.map(layout => (
            <div
              key={layout.id}
              className={`sei-layout-option ${layout.id === currentLayout ? 'active' : ''}`}
              onClick={() => handleLayoutClick(layout.id)}
            >
              <div className="sei-layout-option-name">{layout.name}</div>
              <div className="sei-layout-option-description">{layout.description}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div 
          className="sei-layout-selector-overlay"
          onClick={onClose}
        />
      )}
    </div>
  )
}
