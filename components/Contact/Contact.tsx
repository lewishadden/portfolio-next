'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container, Row, Col, Toast } from 'react-bootstrap';
import { Icon } from '@iconify/react';

import { BasicInfo } from '@/types';
import ContactForm from './ContactForm/ContactForm';

import './Contact.scss';

export const Contact = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState(false);

  const { sectionName, contactInfo } = basicInfo;
  const headingText = sectionName.contact;

  const ContactBadges = () =>
    contactInfo.map((info, i) => (
      <Col md="auto" className="contact__body__personal-info__item d-flex" key={i}>
        <Link
          href={info.link}
          target="_blank"
          rel="noreferrer"
          aria-label={`Contact me at ${info.link}`}
        >
          <div className="contact__body__personal-info__item__icon-badge rounded-circle me-4">
            <Icon
              icon={info.class}
              className="contact__body__personal-info__item__icon-badge__icon"
            />
          </div>
        </Link>

        <div className="contact__body__personal-info__item__details">
          <div className="contact__body__personal-info__item__details__name">{info.name}</div>
          <div className="contact__body__personal-info__item__details__text">
            <Link
              href={info.link}
              target="_blank"
              rel="noreferrer"
              aria-label={`Contact me via ${info.value}`}
            >
              {info.value}
            </Link>
          </div>
        </div>
      </Col>
    ));

  return (
    <section id="contact" className="contact" aria-labelledby="contact-heading">
      <Container>
        <Row>
          <Col md={12}>
            <h2 id="contact-heading" className="text-center contact__heading">
              {headingText}
            </h2>
          </Col>
        </Row>
        <Row className={`contact__body g-5${submitted ? ' form-submitted' : ''}`}>
          <Col md={12} lg={submitted ? { span: 8, offset: 4 } : 4} className="mx-auto">
            <Row className="contact__body__personal-info gy-4">
              <ContactBadges />
            </Row>
          </Col>
          {!submitted && (
            <ContactForm
              onSuccess={() => {
                setError(false);
                setSubmitted(true);
                setShowToast(true);
              }}
              onFail={() => {
                setError(true);
                setShowToast(true);
              }}
            />
          )}
          <Col md={12} lg={{ span: 8, offset: 4 }} className="my-0 mx-auto">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="position-relative"
            >
              <Toast
                className="contact__body__submitted-toast text-center mt-5"
                show={showToast}
                animation
                onClose={() => {
                  setError(false);
                  setShowToast(false);
                }}
                bg={error ? 'danger' : 'success'}
              >
                <Toast.Header>
                  <strong className="mx-auto">
                    {error ? 'There was a problem sending the message' : 'Message sent!'}
                  </strong>
                </Toast.Header>
                <Toast.Body>
                  {error
                    ? 'Please try again soon, or contact me directly via email or phone'
                    : 'I will be in touch with you shortly to answer your message.'}
                </Toast.Body>
              </Toast>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};
