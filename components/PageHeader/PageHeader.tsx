'use client';

import { Badge, Group, Title, Anchor, Grid } from '@mantine/core';
import NextLink from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { TextSection } from '../TextSection/TextSection';

import classes from './PageHeader.module.css';

export type PageHeaderProps = {
  badgeText?: string;
  title?: string;
  description?: string;
  backButton?: {
    href: string;
    text: string;
  };
};

export function PageHeader({ badgeText, title, description, backButton }: PageHeaderProps) {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 3 }}>
        {backButton && backButton.href && (
          <div className={classes.backBtn}>
            <Anchor
              renderRoot={(props) => (
                <NextLink {...props} href={backButton.href}>
                  <Group align="center" wrap="nowrap">
                    <IconArrowLeft />
                    {backButton.text}
                  </Group>
                </NextLink>
              )}
            />
          </div>
        )}
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        {badgeText && (
          <Group justify="center">
            <Badge variant="filled" size="lg" mt="xs">
              {badgeText}
            </Badge>
          </Group>
        )}

        {title && (
          <Title order={2} className={classes.title} ta="center" mt="xs">
            {title}
          </Title>
        )}

        {description && (
          <>
            <TextSection
              className={classes.description}
              html={description}
              color="var(--mantine-color-gray-7)"
              fz="1rem"
            />
          </>
        )}
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 3 }} />
    </Grid>
  );
}
