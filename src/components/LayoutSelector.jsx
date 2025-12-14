import { getAllLayouts } from '../layouts/layouts'
import './LayoutSelector.css'

export function LayoutSelector({ currentLayout, onLayoutChange, isOpen, onToggle, onClose }) {
  const layouts = getAllLayouts()

  const handleLayoutClick = (layoutId) => {
    onLayoutChange(layoutId)
    onClose()
  }

  const currentLayoutObj = layouts.find(l => l.id === currentLayout)

  return (
    <div className="layout-selector">
      <button 
        className="layout-selector-button"
        onClick={onToggle}
        title="Change Layout"
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className="layout-icon"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        <span className="layout-name">{currentLayoutObj?.name || 'Layout'}</span>
      </button>

      {isOpen && (
        <div className="layout-selector-dropdown">
          <div className="layout-selector-header">Select Layout</div>
          {layouts.map(layout => (
            <div
              key={layout.id}
              className={`layout-option ${layout.id === currentLayout ? 'active' : ''}`}
              onClick={() => handleLayoutClick(layout.id)}
            >
              <div className="layout-option-name">{layout.name}</div>
              <div className="layout-option-description">{layout.description}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div 
          className="layout-selector-overlay"
          onClick={onClose}
        />
      )}
    </div>
  )
}
