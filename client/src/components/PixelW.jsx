import React from 'react';

// Logo thuong hieu: chu W pixel (khop voi favicon-w.svg / web brand-mark).
export default function PixelW({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 12 12" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <g fill="currentColor">
        <rect x="0" y="0" width="1" height="10" />
        <rect x="11" y="0" width="1" height="10" />
        <rect x="5" y="0" width="2" height="1" />
        <rect x="4" y="1" width="1" height="3" />
        <rect x="7" y="1" width="1" height="3" />
        <rect x="3" y="3" width="1" height="3" />
        <rect x="8" y="3" width="1" height="3" />
        <rect x="2" y="5" width="1" height="2" />
        <rect x="9" y="5" width="1" height="2" />
      </g>
    </svg>
  );
}
