'use client';

import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /* Put your mantine theme override here */
  breakpoints: {
    xxs: '25em',
    xxl: '110em',
  },
  colors: {
    'custom-red': [
      '#ffe3e3',
      '#F4E2E4',
      '#E5BCC1',
      '#CD8893',
      '#ff6b6b',
      '#fa5252',
      '#f03e3e',
      '#bf1528',
      '#8F0039',
      '#810033',
      '#601028',
    ],
    'custom-blue': [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#4dabf7',
      '#339af0',
      '#1c7ed6',
      '#47bcc5',
      '#0f94a7',
      '#193343',
    ],
  },
  primaryColor: 'custom-red',
  primaryShade: 8,
});
