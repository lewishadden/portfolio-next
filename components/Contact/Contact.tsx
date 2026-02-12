'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { BasicInfo, Contact as ContactType } from '@/types';
import ContactForm from './ContactForm/ContactForm';

import './Contact.scss';

const toastAutoDismissMs = 8000;

export const Contact = ({ basicInfo, contact }: { basicInfo: BasicInfo; contact: ContactType }) => {
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState(false);

  const { sectionName, contactInfo } = basicInfo;
  const headingText = sectionName.contact;

  const dismissToast = useCallback(() => {
    setError(false);
    setShowToast(false);
  }, []);

  // Auto-dismiss toast after timeout
  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(dismissToast, toastAutoDismissMs);
    return () => clearTimeout(timer);
  }, [showToast, dismissToast]);

  const handleSendAnother = () => {
    setSubmitted(false);
    setShowToast(false);
    setError(false);
  };

  return (
    <section id="contact" className="contact" aria-labelledby="contact-heading">
      <div className="contact__container">
        <div className="contact__heading-wrapper">
          <span className="contact__label">Let&rsquo;s connect</span>
          <h2 id="contact-heading" className="contact__heading">
            {headingText}
          </h2>
          <p className="contact__tagline">Let&rsquo;s work together on your next project</p>
        </div>

        <div className={`contact__body${submitted ? ' contact__body--submitted' : ''}`}>
          <div className="contact__info">
            <div className="contact__info-card">
              <h3 className="contact__info-title">Get in touch</h3>
              <p className="contact__info-description">
                Feel free to reach out. I&rsquo;m always open to discussing new projects and
                opportunities.
              </p>
              <address className="contact__info-list">
                <ul className="contact__info-items">
                  {contactInfo.map((info, i) => (
                    <li className="contact__info-item" key={i}>
                      <Link
                        href={info.link}
                        target="_blank"
                        rel="noreferrer"
                        className="contact__info-link"
                        aria-label={`Contact me via ${info.value}`}
                      >
                        <span className="contact__info-icon">
                          <Icon icon={info.class} aria-hidden="true" />
                        </span>
                        <span className="contact__info-detail">
                          <span className="contact__info-label">{info.name}</span>
                          <span className="contact__info-value">{info.value}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </address>
            </div>
          </div>

          {submitted ? (
            <div className="contact__success-panel">
              <Icon icon="mdi:check-circle" className="contact__success-icon" aria-hidden="true" />
              <h3 className="contact__success-title">{contact.success.headerText}</h3>
              <p className="contact__success-text">{contact.success.bodyText}</p>
              <button type="button" className="contact__send-another" onClick={handleSendAnother}>
                <Icon icon="mdi:email-edit-outline" aria-hidden="true" />
                Send another message
              </button>
            </div>
          ) : (
            <ContactForm
              contact={contact}
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
        </div>

        {showToast && (
          <div
            className={`contact__toast contact__toast--${error ? 'error' : 'success'}`}
            role={error ? 'alert' : 'status'}
            aria-live={error ? 'assertive' : 'polite'}
          >
            <div className="contact__toast-content">
              <Icon
                icon={error ? 'mdi:alert-circle' : 'mdi:check-circle'}
                className="contact__toast-icon"
                aria-hidden="true"
              />
              <div className="contact__toast-text">
                <strong>{error ? contact.error.headerText : contact.success.headerText}</strong>
                <p>{error ? contact.error.bodyText : contact.success.bodyText}</p>
              </div>
              <button
                className="contact__toast-close"
                onClick={dismissToast}
                aria-label="Close notification"
                type="button"
              >
                <Icon icon="mdi:close" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
