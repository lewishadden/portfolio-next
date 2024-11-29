import '@mantine/core/styles.css';
import 'bootstrap/scss/bootstrap.scss';
import React from 'react';
import { MantineProvider } from '@mantine/core';
import { Layout } from 'components/Layout/Layout';

import { theme } from '../theme';

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        <title>UI Boilerplate</title>
        <meta name="description" content="UI Boilerplate"></meta>
      </head>
      <body>
        <MantineProvider forceColorScheme="light" theme={theme}>
          <Layout>{children}</Layout>
        </MantineProvider>
      </body>
    </html>
  );
}
