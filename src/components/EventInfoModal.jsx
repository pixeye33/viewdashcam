import './EventInfoModal.css';

// Helper to format event reason
const formatReason = (reason) => {
  if (!reason) return 'Unknown';
  
  // Check for acceleration values
  const accelMatch = reason.match(/sentry_(aware|panic)_accel_([\d.]+)/);
  if (accelMatch) {
    const severity = accelMatch[1] === 'panic' ? 'Panic' : 'Aware';
    const accel = parseFloat(accelMatch[2]);
    return `Sentry ${severity} - Acceleration: ${accel.toFixed(3)} m/s²`;
  }
  
  // Map known reasons to user-friendly names
  const reasonMap = {
    'user_interaction_dashcam_launcher_action_tapped': 'Manual Save (User Tapped)',
    'sentry_aware_object_detection': 'Sentry - Object Detected',
    'sentry_locked_handle_pulled': 'Sentry - Door Handle Pulled',
    'vehicle_auto_emergency_braking': 'Auto Emergency Braking (AEB)'
  };
  
  return reasonMap[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper to format camera ID
const formatCamera = (camera) => {
  return `Camera ${camera}`;
};

// Helper to determine event severity/category
const getEventCategory = (reason) => {
  if (!reason) return { category: 'unknown', icon: '❓', color: '#888' };
  
  if (reason.includes('user_interaction')) {
    return { category: 'manual', icon: '👆', color: '#667eea' };
  }
  
  if (reason.includes('emergency_braking')) {
    return { category: 'critical', icon: '🚨', color: '#ff4444' };
  }
  
  if (reason.includes('panic')) {
    return { category: 'high', icon: '⚠️', color: '#ff8800' };
  }
  
  if (reason.includes('sentry')) {
    return { category: 'sentry', icon: '🛡️', color: '#ffaa00' };
  }
  
  return { category: 'other', icon: 'ℹ️', color: '#00aaff' };
};

export function EventInfoModal({ eventData, onClose }) {
  if (!eventData) return null;
  
  const { category, icon, color } = getEventCategory(eventData.reason);
  
  // Format timestamp to local time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return timestamp;
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content event-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Event Information</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body event-info-body">
          {/* Event Category Banner */}
          <div className="event-category-banner" style={{ borderLeftColor: color }}>
            <span className="event-category-icon">{icon}</span>
            <div className="event-category-info">
              <div className="event-category-label">Event Type</div>
              <div className="event-category-name">{formatReason(eventData.reason)}</div>
            </div>
          </div>
          
          {/* Event Details Grid */}
          <div className="event-details-grid">
            {/* Timestamp */}
            {eventData.timestamp && (
              <div className="event-detail-item">
                <div className="event-detail-label">
                  <span className="event-detail-icon">🕐</span>
                  Timestamp
                </div>
                <div className="event-detail-value">{formatTimestamp(eventData.timestamp)}</div>
              </div>
            )}
            
            {/* Camera */}
            {eventData.camera !== undefined && (
              <div className="event-detail-item">
                <div className="event-detail-label">
                  <span className="event-detail-icon">📹</span>
                  Trigger Camera
                </div>
                <div className="event-detail-value">{formatCamera(eventData.camera)}</div>
              </div>
            )}
            
            {/* Location */}
            {eventData.city && (
              <div className="event-detail-item">
                <div className="event-detail-label">
                  <span className="event-detail-icon">📍</span>
                  Location
                </div>
                <div className="event-detail-value">{eventData.city}</div>
              </div>
            )}
            
            {/* GPS Coordinates */}
            {(eventData.est_lat || eventData.est_lon) && (
              <div className="event-detail-item event-detail-full-width">
                <div className="event-detail-label">
                  <span className="event-detail-icon">🌍</span>
                  GPS Coordinates
                </div>
                <div className="event-detail-value event-gps-coords">
                  <span>Latitude: {eventData.est_lat || 'N/A'}</span>
                  <span>Longitude: {eventData.est_lon || 'N/A'}</span>
                  {eventData.est_lat && eventData.est_lon && (
                    <a 
                      href={`https://www.google.com/maps?q=${eventData.est_lat},${eventData.est_lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="event-map-link"
                    >
                      View on Google Maps →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Raw JSON Section */}
          <details className="event-raw-json">
            <summary>Raw JSON Data</summary>
            <pre>{JSON.stringify(eventData, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
