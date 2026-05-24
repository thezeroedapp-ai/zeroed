import { createTheme, MantineColorsTuple, CSSVariablesResolver } from '@mantine/core';

// Burnt orange — 10-shade scale (Mantine format, lightest → darkest)
const burntOrange: MantineColorsTuple = [
  '#FFF3EC',  // 0  very light
  '#FFE4CC',  // 1
  '#FFCC99',  // 2
  '#FFB366',  // 3
  '#FF9933',  // 4
  '#E87820',  // 5  medium — used as primary in dark/charcoal mode
  '#CC5500',  // 6  true burnt orange — primary in light/cream mode
  '#A84400',  // 7
  '#8B3500',  // 8
  '#6B2800',  // 9  very dark
];

// Map our design tokens into Mantine's CSS variable slots
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--mantine-font-family':          'Montserrat, Segoe UI, sans-serif',
    '--mantine-font-family-headings': 'Playfair Display, Georgia, serif',
    '--mantine-font-family-monospace':'Menlo, Consolas, Monaco, monospace',
  },
  light: {
    // cream theme surfaces
    '--mantine-color-body':           'oklch(0.920 0.040 72)',   // #F7E7CE
    '--mantine-color-text':           'oklch(0.130 0.005 55)',
    '--mantine-color-default':        'oklch(1 0 0)',            // white cards
    '--mantine-color-default-border': 'oklch(0 0 0 / 9%)',
    '--mantine-color-dimmed':         'oklch(0.430 0.012 60)',
    '--mantine-color-placeholder':    'oklch(0.560 0.012 60)',
    '--mantine-color-anchor':         '#CC5500',
  },
  dark: {
    // charcoal theme surfaces
    '--mantine-color-body':           'oklch(0.135 0.003 55)',   // deep charcoal
    '--mantine-color-text':           'oklch(0.920 0.006 55)',
    '--mantine-color-default':        'oklch(0.172 0.004 55)',   // card bg
    '--mantine-color-default-border': 'oklch(1 0 0 / 10%)',
    '--mantine-color-dimmed':         'oklch(0.560 0.008 55)',
    '--mantine-color-placeholder':    'oklch(0.460 0.008 55)',
    '--mantine-color-anchor':         '#E87820',
    '--mantine-color-dark-0':         'oklch(0.920 0.006 55)',
    '--mantine-color-dark-1':         'oklch(0.820 0.006 55)',
    '--mantine-color-dark-2':         'oklch(0.680 0.008 55)',
    '--mantine-color-dark-3':         'oklch(0.560 0.008 55)',
    '--mantine-color-dark-4':         'oklch(0.350 0.005 55)',
    '--mantine-color-dark-5':         'oklch(0.265 0.004 55)',
    '--mantine-color-dark-6':         'oklch(0.215 0.004 55)',
    '--mantine-color-dark-7':         'oklch(0.172 0.004 55)',
    '--mantine-color-dark-8':         'oklch(0.135 0.003 55)',
    '--mantine-color-dark-9':         'oklch(0.108 0.003 55)',
  },
});

export const mantineTheme = createTheme({
  primaryColor: 'burntOrange',
  primaryShade: { light: 6, dark: 5 },

  colors: { burntOrange },

  fontFamily:          'Montserrat, Segoe UI, sans-serif',
  fontFamilyMonospace: 'Menlo, Consolas, Monaco, monospace',
  headings: {
    fontFamily: 'Playfair Display, Georgia, serif',
    sizes: {
      h1: { fontSize: '2rem',    fontWeight: '700' },
      h2: { fontSize: '1.5rem',  fontWeight: '700' },
      h3: { fontSize: '1.25rem', fontWeight: '600' },
      h4: { fontSize: '1rem',    fontWeight: '600' },
    },
  },

  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },

  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  components: {
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
        padding: 'lg',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Input: {
      defaultProps: {
        radius: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    NumberInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Progress: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
