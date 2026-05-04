'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { Contact as ContactProps } from '@/types';
import ContactForm from './ContactForm/ContactForm';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';

const LocationMap = dynamic(
  () => import('components/LocationMap/LocationMap').then((m) => m.LocationMap),
  { ssr: false }
);

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
    <section id="contact" className="section contact" aria-labelledby="contact-heading">
      <span className="section__slug" aria-hidden="true">
        {'// contact'}
      </span>
      <ScrollReveal className="section__head section__head--centered">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="contact-heading" className="section__title">
          {title} <span className="section__title-accent">Me</span>
        </h2>
        <p className="section__sub">{tagline}</p>
      </ScrollReveal>

      <div className="contact__grid">
        <ScrollReveal
          as="aside"
          className="contact__side"
          onMouseMove={(e: React.MouseEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
          }}
        >
          <div className="contact__intro">
            <h3>{contactInfo.title}</h3>
            <p>{contactInfo.description}</p>
          </div>
          <address>
            <ul className="contact__list">
              {contactInfo.items.map((info) =>
                info.link ? (
                  <li className="contact__list-item" key={info.name}>
                    <Link
                      href={info.link}
                      prefetch={false}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact__list-link"
                      aria-label={`Contact me via ${info.value}`}
                    >
                      <span className="contact__list-ic">
                        <Icon icon={info.class} width={20} height={20} aria-hidden="true" />
                      </span>
                      <span className="contact__list-text">
                        <b>{info.name}</b>
                        <span>{info.value}</span>
                      </span>
                    </Link>
                  </li>
                ) : (
                  <li className="contact__list-item contact__list-item--static" key={info.name}>
                    <div className="contact__list-link">
                      <span className="contact__list-ic">
                        <Icon icon={info.class} width={20} height={20} aria-hidden="true" />
                      </span>
                      <span className="contact__list-text">
                        <b>{info.name}</b>
                        <span>{info.value}</span>
                      </span>
                    </div>
                  </li>
                )
              )}
            </ul>
          </address>
        </ScrollReveal>

        <ScrollReveal
          className={`contact__panel${submitted ? ' contact__panel--submitted' : ''}`}
          style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
          onMouseMove={(e: React.MouseEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
          }}
        >
          {submitted ? (
            <div className="contact__success">
              <Icon icon={success.icon} className="contact__success-icon" aria-hidden="true" />
              <h3 className="contact__success-title">{success.headerText}</h3>
              <p className="contact__success-text">{success.bodyText}</p>
              <button type="button" className="btn btn--secondary" onClick={handleSendAnother}>
                <Icon icon={sendAgain.icon} width={18} height={18} aria-hidden="true" />
                <span>{sendAgain.text}</span>
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
        </ScrollReveal>
      </div>

      <ScrollReveal className="contact__location">
        <LocationMap />
        <span className="contact__location-pulse" aria-hidden="true" />
        <div className="contact__location-pin" aria-hidden="true">
          <Icon icon="mdi:map-marker" width={56} height={56} />
        </div>
        <span className="contact__location-label">Peterborough, UK</span>
      </ScrollReveal>

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
    </section>
  );
};

export default Contact;
