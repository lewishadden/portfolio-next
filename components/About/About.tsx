'use client';

import { Container, Row, Col, Card } from 'react-bootstrap';
import ExportedImage from 'next-image-export-optimizer';

import { BasicInfo } from '@/types';

import './About.scss';

export const About = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { image, sectionName, description, descriptionHeader } = basicInfo;
  const headingText = sectionName.about;

  return (
    <section id="about" className="about">
      <Container>
        <Row>
          <Col md={12}>
            <h2 className="text-center about__heading">{headingText}</h2>
          </Col>
        </Row>
        <Row className="about__body center">
          <Col md={10} lg={12}>
            <Card text="white" border="secondary" className="about__body__picture-card">
              <Row className="g-0">
                <Col md={12} lg={5} xl={3} className="pe-md-0">
                  <ExportedImage
                    src={image.url}
                    className="about__body__picture-card__image"
                    width={image.size.width}
                    height={image.size.height}
                    alt={`Portrait Photo`}
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
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default About;
