import { IconHeart } from '@tabler/icons-react';
import { ActionIcon, Avatar, Badge, Button, Card, Grid, Group, Text } from '@mantine/core';
import ExportedImage from 'next-image-export-optimizer';
import { TextSection } from '../TextSection/TextSection';
import classes from './BadgeCard.module.css';

const mockdata = {
  title: 'Verudela Beach',
  country: 'Croatia',
  description:
    'Completely renovated for the season 2020, Arena Verudela Bech Apartments are fully equipped and modernly furnished 4-star self-service apartments located on the Adriatic coastline by one of the most beautiful beaches in Pula.',
  badges: [
    { emoji: '☀️', label: 'Sunny weather' },
    { emoji: '🦓', label: 'Onsite zoo' },
    { emoji: '🌊', label: 'Sea' },
    { emoji: '🌲', label: 'Nature' },
    { emoji: '🤽', label: 'Water sports' },
  ],
};

export const BadgeCard = ({
  image,
  descriptionHeader,
  description,
}: {
  image: string;
  descriptionHeader: string;
  description: string;
}) => {
  const profilepic = `/static/images/${image}`;
  const ProfileImage = () => (
    <ExportedImage
      src={profilepic}
      alt="Portrait"
      width={70}
      height={78}
      title="Portrait"
      className={classes.image}
      priority
    />
  );
  const { title, country, badges } = mockdata;
  const features = badges.map((badge) => (
    <Badge variant="light" key={badge.label} leftSection={badge.emoji}>
      {badge.label}
    </Badge>
  ));

  return (
    <Card withBorder shadow="lg" radius="md" p="0" className={classes.card}>
      <Grid>
        <Grid.Col span={{ xxs: 12 }} hiddenFrom="xs">
          <Card.Section m={0}>
            <ExportedImage
              src={profilepic}
              alt="Portrait"
              width={70}
              height={78}
              title="Portrait"
              className={classes.image}
              priority
            />
          </Card.Section>
        </Grid.Col>
        <Grid.Col span={{ xs: 2 }} visibleFrom="xs">
          <Card.Section m="md">
            <Avatar radius="xl" src={profilepic} alt="Portrait" className={classes.avatar} />
          </Card.Section>
        </Grid.Col>

        <Grid.Col span={{ xxs: 12, xs: 10 }}>
          <Card.Section className={classes.section} m="md">
            <TextSection fz="1.2rem" html={descriptionHeader} />
          </Card.Section>
          <Card.Section className={classes.section} m="md">
            <TextSection fz="1rem" html={description} />
          </Card.Section>
        </Grid.Col>

        {/* <Group>
          <Card.Section className={classes.section}>
            <Text mt="md" className={classes.label} c="dimmed">
              Perfect for you, if you enjoy
            </Text>
            <Group gap={7} mt={5}>
              {features}
            </Group>
          </Card.Section>

          <Group mt="xs">
            <Button radius="md" style={{ flex: 1 }}>
              Show details
            </Button>
            <ActionIcon variant="default" radius="md" size={36}>
              <IconHeart className={classes.like} stroke={1.5} />
            </ActionIcon>
          </Group>
        </Group> */}
      </Grid>
    </Card>
  );
};
