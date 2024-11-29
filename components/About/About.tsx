'use client';

import { Container, Grid, Card } from '@mantine/core';
// import ExportedImage from 'next-image-export-optimizer';
import { BadgeCard } from 'components/BadgeCard/BadgeCard';
import { BasicInfo } from '@/types';

// import classes from './About.module.css';

export const About = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { image, description, descriptionHeader } = basicInfo;

  // const profilepic = `/static/images/${image}`;
  // const headingText = sectionName.about;

  return (
    <section id="about" className="about">
      {/* <Container mx={{ base: 'sm', md: 'xl' }} py="lg"> */}
      <BadgeCard image={image} descriptionHeader={descriptionHeader} description={description} />
      {/* <Grid>
          <Grid.Col span={{ md: 12, lg: 12 }}>
            <h2 className="text-center about__heading">{headingText}</h2>
          </Grid.Col>
          <Grid.Col span={{ md: 10, lg: 12 }}>
            <Card text="white" border="secondary" className="about__body__picture-card">
              <Row className="g-0">
                <Col md={12} lg={5} xl={3} className="pe-md-0">
                  <ExportedImage
                    src={profilepic}
                    alt="Portrait"
                    width={70}
                    height={78}
                    title="Portrait"
                    className={classes.image}
                    priority
                  />
                </Col>
                <Col md={12} lg={7} xl={9} className="ps-md-0">
                  <Card.Body className="font-trebuchet text-start text-justify ms-3 me-3">
                    <Card.Title
                      dangerouslySetInnerHTML={{ __html: descriptionHeader }}
                      className="about__body__picture-card__title mb-3"
                      as="h4"
                    />
                    <Card.Text
                      dangerouslySetInnerHTML={{ __html: description }}
                      className="about__body__picture-card__description"
                      as="p"
                    />
                  </Card.Body>
                </Col>
              </Row>
            </Card>
          </Grid.Col>
        </Grid> */}
      {/* </Container> */}
    </section>
  );
};
