// Premium Design System Tokens (HSL-based)
export const theme = {
  colors: {
    background: 'hsl(224, 71%, 4%)',
    foreground: 'hsl(213, 31%, 91%)',
    card: 'hsl(224, 71%, 6%)',
    cardForeground: 'hsl(213, 31%, 91%)',
    popover: 'hsl(224, 71%, 4%)',
    popoverForeground: 'hsl(215, 20.2%, 65.1%)',
    primary: 'hsl(210, 40%, 98%)',
    primaryForeground: 'hsl(222.2, 47.4%, 1.2%)',
    secondary: 'hsl(222.2, 47.4%, 11.2%)',
    secondaryForeground: 'hsl(210, 40%, 98%)',
    muted: 'hsl(223, 47%, 11%)',
    mutedForeground: 'hsl(215.4, 16.3%, 56.9%)',
    accent: 'hsl(216, 34%, 17%)',
    accentForeground: 'hsl(210, 40%, 98%)',
    destructive: 'hsl(0, 63%, 31%)',
    destructiveForeground: 'hsl(210, 40%, 98%)',
    border: 'hsl(216, 34%, 17%)',
    input: 'hsl(216, 34%, 17%)',
    ring: 'hsl(214, 32%, 91%)',
  },
  radius: '0.75rem',
  glass: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }
};

export type Theme = typeof theme;
