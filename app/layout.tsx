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
        <title>Portfolio - Lewis Hadden</title>
        <meta
          name="description"
          content="Welcome to my personal portfolio, built with NextJS, React Bootstrap and Mantine UI"
        />
      </head>
      <body data-theme="dark" data-bs-theme="dark">
        <MantineProvider forceColorScheme="light" theme={theme}>
          <Layout>{children}</Layout>
        </MantineProvider>
      </body>
    </html>
  );
}
