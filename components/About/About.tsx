'use client';

import { Container, Row, Col, Card, CardBody, CardTitle, CardText } from 'react-bootstrap';
import { useMediaQuery } from '@mantine/hooks';
import ExportedImage from 'next-image-export-optimizer';

import { BasicInfo } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './About.scss';

export const About = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { image, sectionName, description, descriptionHeader } = basicInfo;
  const headingText = sectionName.about;
  const isServer = typeof window === 'undefined';
  const isDesktop = isServer ? false : useMediaQuery('(min-width: 768px)');

  return (
    <section id="about" className="about" aria-labelledby="about-heading">
      <Container>
        <Row>
          <Col md={12}>
            <h2 id="about-heading" className="text-center about__heading">
              {headingText}
            </h2>
          </Col>
        </Row>
        <Row className="about__body center">
          <Col md={10} lg={12}>
            <ScrollReveal animation="slideInRight">
              <Card text="white" className="about__body__picture-card">
                <Row className="g-0">
                  <Col md={12} lg={5} xl={3} className="pe-md-0">
                    <ExportedImage
                      src={image.url}
                      className="about__body__picture-card__image"
                      width={image.size.width}
                      height={image.size.height}
                      alt="Portrait photo of Lewis Hadden"
                      sizes="(min-width: 992px) 25vw, (min-width: 768px) 40vw, 80vw"
                      loading={isDesktop ? 'eager' : 'lazy'}
                      fetchPriority={isDesktop ? 'high' : 'low'}
                      preload={Boolean(isDesktop)}
                      decoding="async"
                    />
                  </Col>
                  <Col md={12} lg={7} xl={9} className="ps-md-0">
                    <CardBody className="font-trebuchet text-start text-justify ms-3 me-3">
                      <CardTitle
                        dangerouslySetInnerHTML={{ __html: descriptionHeader }}
                        className="about__body__picture-card__title mb-3"
                        as="h3"
                      />
                      <CardText
                        dangerouslySetInnerHTML={{ __html: description }}
                        className="about__body__picture-card__description"
                        as="p"
                      />
                    </CardBody>
                  </Col>
                </Row>
              </Card>
            </ScrollReveal>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default About;
