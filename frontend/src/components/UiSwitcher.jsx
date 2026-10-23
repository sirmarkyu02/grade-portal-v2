import React, { useState } from 'react';
import { Sparkles, Layers, Sliders, Check } from 'lucide-react';
import { useUiTheme } from '../context/UiThemeContext';

/**
 * Floating Quick Toggle Widget (Rendered in root App layout)
 */
export function UiFloatingSwitcher() {
  const { uiMode, setUiMode, isModern } = useUiTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={`ui-floating-switcher ${collapsed ? 'collapsed' : ''} ${isModern ? 'is-modern' : 'is-classic'}`}
      aria-label="UI Version Switcher"
    >
      <div className="ui-switcher-card">
        <button 
          className="ui-switcher-toggle-main"
          onClick={() => setUiMode(isModern ? 'classic' : 'modern')}
          title={isModern ? 'Switch to Classic v2 Portal' : 'Switch to Nova Modern UI'}
        >
          <div className="ui-switcher-icon-wrap">
            {isModern ? <Sparkles size={16} className="sparkle-anim" /> : <Layers size={16} />}
          </div>
          <div className="ui-switcher-text-wrap">
            <span className="ui-switcher-title">
              {isModern ? 'Nova Modern UI' : 'Classic Portal v2'}
            </span>
            <span className="ui-switcher-subtitle">
              Click to switch to {isModern ? 'Classic' : 'Modern'}
            </span>
          </div>
        </button>

        <div className="ui-switcher-actions">
          <button 
            type="button"
            className={`ui-switcher-pill-btn ${!isModern ? 'active' : ''}`}
            onClick={() => setUiMode('classic')}
            title="Use Classic Portal v2 UI"
          >
            <span>Classic</span>
          </button>
          <button 
            type="button"
            className={`ui-switcher-pill-btn ${isModern ? 'active' : ''}`}
            onClick={() => setUiMode('modern')}
            title="Use Nova Modern UI"
          >
            <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
            <span>Modern</span>
          </button>
        </div>

        <button 
          type="button"
          className="ui-switcher-collapse-btn"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand UI Switcher' : 'Minimize UI Switcher'}
        >
          <Sliders size={13} />
        </button>
      </div>
    </aside>
  );
}

/**
 * Inline Segmented Switcher (Can be placed in Sidebar, Page Headers, or Settings)
 */
export function UiInlineSwitcher({ size = 'md', className = '', compact = false }) {
  const { uiMode, setUiMode, isModern } = useUiTheme();

  return (
    <div className={`ui-segmented-switcher size-${size} ${className}`} role="radiogroup" aria-label="Select UI Version">
      <button
        type="button"
        role="radio"
        aria-checked={!isModern}
        className={`ui-segment-btn ${!isModern ? 'active' : ''}`}
        onClick={() => setUiMode('classic')}
        title="Use Classic Portal v2 UI"
      >
        <Layers size={size === 'xs' ? 11 : size === 'sm' ? 13 : 15} />
        <span>{compact ? 'Classic' : 'Classic v2'}</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isModern}
        className={`ui-segment-btn ${isModern ? 'active' : ''}`}
        onClick={() => setUiMode('modern')}
        title="Use Nova Modern UI"
      >
        <Sparkles size={size === 'xs' ? 11 : size === 'sm' ? 13 : 15} />
        <span>{compact ? 'Modern' : 'Nova Modern'}</span>
      </button>
    </div>
  );
}

/**
 * Compact Header Button Toggle
 */
export function UiHeaderButton() {
  const { isModern, toggleUiMode } = useUiTheme();

  return (
    <button
      type="button"
      className="btn-ui-header-toggle"
      onClick={toggleUiMode}
      title={isModern ? 'Switch to Classic v2 UI' : 'Switch to Nova Modern UI'}
      aria-label="Toggle UI Version"
    >
      {isModern ? (
        <>
          <span className="ui-header-badge-pulse" />
          <Sparkles size={14} className="ui-header-icon-modern" />
          <span className="ui-header-btn-text">Nova UI</span>
        </>
      ) : (
        <>
          <Layers size={14} />
          <span className="ui-header-btn-text">Classic v2</span>
        </>
      )}
    </button>
  );
}
