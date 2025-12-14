/**
 * SEI Overlay Layout Configuration System
 * 
 * Each layout completely re-renders the SEI overlay with different component arrangements.
 * Unlike video layouts, SEI layouts can destroy and recreate the overlay DOM.
 */

import { SeiOverlayCompact } from '../components/sei-layouts/SeiOverlayCompact'
import { SeiOverlayDefault } from '../components/sei-layouts/SeiOverlayDefault'
import { SeiOverlayRacing } from '../components/sei-layouts/SeiOverlayRacing'
import { SeiOverlayHidden } from '../components/sei-layouts/SeiOverlayHidden'

/**
 * SEI Layout Definition Structure:
 * {
 *   id: string - Unique identifier
 *   name: string - Display name
 *   description: string - Brief description
 *   component: React.Component - Component to render the overlay
 * }
 */

const seiLayouts = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Full telemetry data display on the right side',
    component: SeiOverlayDefault,
  },

  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Minimal telemetry display with essential metrics only',
    component: SeiOverlayCompact,
  },

  racing: {
    id: 'racing',
    name: 'Racing',
    description: 'Performance-focused layout with speedometer, G-forces, and steering wheel',
    component: SeiOverlayRacing,
  },

  hidden: {
    id: 'hidden',
    name: 'Hidden',
    description: 'Hide all telemetry data',
    component: SeiOverlayHidden,
  },
};

/**
 * Get SEI layout by ID
 * @param {string} layoutId - Layout identifier
 * @returns {object} Layout configuration
 */
export function getSeiLayout(layoutId) {
  return seiLayouts[layoutId] || seiLayouts.default;
}

/**
 * Get all available SEI layouts
 * @returns {array} Array of layout objects
 */
export function getAllSeiLayouts() {
  return Object.values(seiLayouts);
}

/**
 * Get SEI layout IDs
 * @returns {array} Array of layout IDs
 */
export function getSeiLayoutIds() {
  return Object.keys(seiLayouts);
}

export default seiLayouts;
