/**
 * Layout Configuration System
 * 
 * Each layout defines how video players should be positioned and sized.
 * Layouts use CSS grid or flexbox positioning with transitions for smooth switching.
 */

/**
 * Layout Definition Structure:
 * {
 *   id: string - Unique identifier
 *   name: string - Display name
 *   description: string - Brief description
 *   mainPlayer: object - Main video player configuration
 *     {
 *       gridArea: string - CSS grid area name (optional if using position)
 *       position: object - Absolute positioning (optional)
 *       width: string - CSS width value
 *       height: string - CSS height value
 *     }
 *   thumbnails: object - Thumbnail container configuration
 *     {
 *       gridArea: string - CSS grid area name
 *       layout: string - 'horizontal' | 'vertical' | 'grid'
 *       position: object - Positioning info
 *       maxHeight: string - Max height constraint
 *     }
 *   gridTemplate: object - Grid template configuration
 *     {
 *       columns: string - grid-template-columns value
 *       rows: string - grid-template-rows value
 *       areas: string - grid-template-areas value
 *     }
 * }
 */

const layouts = {
  // Default Layout - Main player on top, thumbnails on bottom
  default: {
    id: 'default',
    name: 'Default',
    description: 'Main player on top with horizontal thumbnails below',
    type: 'flex', // flex or grid
    containerStyle: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
    },
    mainPlayer: {
      style: {
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden',
        position: 'relative',
        minHeight: '0', // Important for flex
      },
    },
    progressBar: {
      style: {
        background: 'rgba(0, 0, 0, 0.9)',
        padding: '15px 20px',
        borderTop: '2px solid rgba(255, 255, 255, 0.1)',
        flexShrink: '0',
      },
    },
    thumbnails: {
      layout: 'horizontal',
      style: {
        display: 'flex',
        gap: '10px',
        padding: '15px',
        background: 'rgba(0, 0, 0, 0.9)',
        overflowX: 'auto',
        flexShrink: '0',
        borderTop: '2px solid rgba(255, 255, 255, 0.1)',
      },
      thumbnailStyle: {
        width: '240px',
        height: '135px',
        flexShrink: '0',
      },
    },
  },

  // Grid Layout - Multi-Camera View (2x2 for 4 cameras, 3x2 for 6 cameras)
  grid: {
    id: 'grid',
    name: 'Grid View',
    description: 'All cameras in a synchronized grid layout',
    type: 'flex',
    // Dynamic grid function - will be called with video count
    getContainerStyle: (videoCount) => {
      // Calculate grid columns based on video count
      let columns = 3;
      if (videoCount <= 2) columns = 2;
      else if (videoCount <= 4) columns = 2;
      else if (videoCount <= 6) columns = 3;
      
      return {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#000',
        padding: '0',
        gridTemplateColumns: `repeat(${columns}, 1fr)`, // Store for thumbnails
      };
    },
    containerStyle: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: '#000',
      padding: '0',
    },
    mainPlayer: {
      style: {
        display: 'none', // Hide main player in grid mode - all videos shown as thumbnails
      },
    },
    progressBar: {
      style: {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'rgba(0, 0, 0, 0.9)',
        padding: '15px 20px',
        borderTop: '2px solid rgba(255, 255, 255, 0.1)',
        zIndex: '100',
      },
    },
    thumbnails: {
      layout: 'grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0',
        width: '100%',
        minHeight: '0',
      },
      thumbnailStyle: {
        width: '100%',
        height: '100%',
        minHeight: '0',
        border: 'none',
        borderRadius: '0',
      },
    },
  },
};

/**
 * Get layout by ID
 * @param {string} layoutId - Layout identifier
 * @returns {object} Layout configuration
 */
export function getLayout(layoutId) {
  return layouts[layoutId] || layouts.default;
}

/**
 * Get all available layouts
 * @returns {array} Array of layout objects
 */
export function getAllLayouts() {
  return Object.values(layouts);
}

/**
 * Get layout IDs
 * @returns {array} Array of layout IDs
 */
export function getLayoutIds() {
  return Object.keys(layouts);
}

export default layouts;
