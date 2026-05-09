export const lightTheme = {
  mode: 'light' as const,
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F5',
  primary: '#E54D2E',
  primaryText: '#FFFFFF',
  textMain: '#111111',
  textMuted: '#666666',
  border: '#EAEAEA',
  success: '#2E904F',
  warning: '#F5A623',
  error: '#D33D3D',
  overlay: 'rgba(0,0,0,0.4)',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#000000',
  surface: '#121212',
  surfaceElevated: '#1E1E1E',
  primary: '#E54D2E',
  primaryText: '#FFFFFF',
  textMain: '#EEEEEE',
  textMuted: '#A0A0A0',
  border: '#2D2D2D',
  success: '#4CAF50',
  warning: '#FFB74D',
  error: '#E57373',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Theme = typeof lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 9999,
};
