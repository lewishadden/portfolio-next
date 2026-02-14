'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { Contact as ContactProps } from '@/types';
import ContactForm from './ContactForm/ContactForm';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './Contact.scss';

const toastAutoDismissMs = 8000;

export const Contact = ({ contact }: { contact: ContactProps }) => {
  const {
    title,
    label,
    tagline,
    contactInfo,
    sendAgain,
    error: errorContent,
    success,
    close,
  } = contact;

  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState(false);

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
          <ScrollReveal animation="slideUp">
            <span className="contact__label">{label}</span>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.1}>
            <h2 id="contact-heading" className="contact__heading">
              {title}
            </h2>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.2}>
            <p className="contact__tagline">{tagline}</p>
          </ScrollReveal>
        </div>

        <div className={`contact__body${submitted ? ' contact__body--submitted' : ''}`}>
          <div className="contact__info">
            <div className="contact__info-card">
              <h3 className="contact__info-title">{contactInfo.title}</h3>
              <p className="contact__info-description">{contactInfo.description}</p>
              <address className="contact__info-list">
                <ul className="contact__info-items">
                  {contactInfo.items.map((info, i) => (
                    <li className="contact__info-item" key={i}>
                      <Link
                        href={info.link}
                        target="_blank"
                        rel="noopener noreferrer"
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
              <Icon icon={success.icon} className="contact__success-icon" aria-hidden="true" />
              <h3 className="contact__success-title">{success.headerText}</h3>
              <p className="contact__success-text">{success.bodyText}</p>
              <button type="button" className="contact__send-another" onClick={handleSendAnother}>
                <Icon icon={sendAgain.icon} aria-hidden="true" />
                {sendAgain.text}
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
                icon={error ? errorContent.icon : success.icon}
                className="contact__toast-icon"
                aria-hidden="true"
              />
              <div className="contact__toast-text">
                <strong>{error ? errorContent.headerText : success.headerText}</strong>
                <p>{error ? errorContent.bodyText : success.bodyText}</p>
              </div>
              <button
                className="contact__toast-close"
                onClick={dismissToast}
                aria-label={close.ariaLabel}
                type="button"
              >
                <Icon icon={close.icon} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
