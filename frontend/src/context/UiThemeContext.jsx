import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export const UiThemeContext = createContext(null);

export const useUiTheme = () => {
  const ctx = useContext(UiThemeContext);
  if (!ctx) {
    throw new Error('useUiTheme must be used within a UiThemeProvider');
  }
  return ctx;
};

const UI_STORAGE_KEY = 'gp_ui_mode';

export function UiThemeProvider({ children }) {
  const [uiMode, setUiModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(UI_STORAGE_KEY);
      if (saved === 'classic' || saved === 'modern') return saved;
      return 'modern'; // Default to modern design
    } catch {
      return 'modern';
    }
  });

  const applyUiMode = useCallback((mode) => {
    document.documentElement.setAttribute('data-ui-mode', mode);
    if (mode === 'modern') {
      document.body.classList.add('ui-modern');
      document.body.classList.remove('ui-classic');
    } else {
      document.body.classList.add('ui-classic');
      document.body.classList.remove('ui-modern');
    }
  }, []);

  useEffect(() => {
    applyUiMode(uiMode);
    try {
      localStorage.setItem(UI_STORAGE_KEY, uiMode);
    } catch {}
  }, [uiMode, applyUiMode]);

  const setUiMode = useCallback((newMode) => {
    if (newMode !== 'modern' && newMode !== 'classic') return;
    setUiModeState(newMode);
    applyUiMode(newMode);
    try {
      localStorage.setItem(UI_STORAGE_KEY, newMode);
    } catch {}
    if (newMode === 'modern') {
      toast.success('Switched to Nova Modern UI ✨', {
        id: 'ui-switch-toast',
        icon: '✨',
        duration: 2500
      });
    } else {
      toast.success('Reverted to Classic Portal v2 🏛️', {
        id: 'ui-switch-toast',
        icon: '🏛️',
        duration: 2500
      });
    }
  }, [applyUiMode]);

  const toggleUiMode = useCallback(() => {
    setUiMode(uiMode === 'modern' ? 'classic' : 'modern');
  }, [uiMode, setUiMode]);

  const isModern = uiMode === 'modern';

  return (
    <UiThemeContext.Provider value={{ uiMode, setUiMode, toggleUiMode, isModern }}>
      {children}
    </UiThemeContext.Provider>
  );
}
