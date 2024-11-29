import { Container, Title, Text, Button, Group } from '@mantine/core';
import Link from 'next/link';
import { Illustration } from './Illustration';
import classes from './PageNotFound.module.css';

export type PageNotFoundProps = {
  title: string;
  description: string;
  cta: {
    text: string;
  };
};

export function PageNotFound({ title, description, cta }: PageNotFoundProps) {
  return (
    <Container className={classes.root}>
      <div className={classes.inner}>
        <Illustration className={classes.image} />
        <div className={classes.content}>
          <Title className={classes.title}>{title}</Title>
          <Text
            c="var(--mantine-color-gray-2)"
            size="lg"
            ta="center"
            className={classes.description}
          >
            {description}
          </Text>
          <Group justify="center">
            <Button size="md" component={Link} href="/" aria-label={cta.text}>
              {cta.text}
            </Button>
          </Group>
        </div>
      </div>
    </Container>
  );
}
