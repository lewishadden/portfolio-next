'use client';

import { Container, Row, Col, Card, CardBody, CardTitle, CardText } from 'react-bootstrap';
import { useMediaQuery } from '@mantine/hooks';
import ExportedImage from 'next-image-export-optimizer';

import { BasicInfo } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './About.scss';

export const About = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { image, sectionName, description, descriptionHeader, cv } = basicInfo;
  const headingText = sectionName.about;
  const isServer = typeof window === 'undefined';
  const isDesktop = isServer ? false : useMediaQuery('(min-width: 768px)');

  return (
    <section id="about" className="about" aria-labelledby="about-heading">
      <Container>
        <Row>
          <Col md={12}>
            <div className="about__heading-wrapper">
              <h2 id="about-heading" className="about__heading">
                {headingText}
              </h2>
              <div className="about__heading-underline"></div>
            </div>
          </Col>
        </Row>
        <Row className="about__body center">
          <Col md={10} lg={11} xl={10}>
            <ScrollReveal animation="fadeIn">
              <Card className="about__body__picture-card">
                <Row className="g-0">
                  <Col md={12} lg={4} className="about__body__picture-card__image-col">
                    <div className="about__body__picture-card__image-wrapper">
                      <ExportedImage
                        src={image.url}
                        className="about__body__picture-card__image"
                        width={image.size.width}
                        height={image.size.height}
                        alt="Portrait photo of Lewis Hadden"
                        sizes="(min-width: 992px) 30vw, (min-width: 768px) 40vw, 100vw"
                        loading={isDesktop ? 'eager' : 'lazy'}
                        fetchPriority={isDesktop ? 'high' : 'low'}
                        preload={Boolean(isDesktop)}
                        decoding="async"
                      />
                      <div className="about__body__picture-card__image-overlay"></div>
                    </div>
                  </Col>
                  <Col md={12} lg={8}>
                    <CardBody className="about__body__picture-card__content">
                      <div className="about__body__picture-card__status">
                        <span className="about__body__picture-card__status-dot"></span>
                        <span className="about__body__picture-card__status-text">
                          Available for opportunities
                        </span>
                      </div>
                      <CardTitle
                        dangerouslySetInnerHTML={{ __html: descriptionHeader }}
                        className="about__body__picture-card__title"
                        as="h3"
                      />
                      <CardText
                        dangerouslySetInnerHTML={{ __html: description }}
                        className="about__body__picture-card__description"
                        as="div"
                      />
                      <div className="about__body__picture-card__actions">
                        <a
                          href={cv.url}
                          download="Lewis_Hadden_CV.pdf"
                          className="about__body__picture-card__btn about__body__picture-card__btn--primary"
                          aria-label="Download CV as PDF"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.979 19.804 4.587 19.412C4.195 19.02 3.99934 18.5493 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.412 19.413C19.02 19.805 18.5493 20.0007 18 20H6Z"
                              fill="currentColor"
                            />
                          </svg>
                          <span>Download CV</span>
                        </a>
                        <a
                          href="#contact"
                          className="about__body__picture-card__btn about__body__picture-card__btn--secondary"
                          aria-label="Go to contact section"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"
                              fill="currentColor"
                            />
                          </svg>
                          <span>Get in Touch</span>
                        </a>
                      </div>
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
