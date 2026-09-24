'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { AnimatePresence, m } from 'framer-motion';

import ContactForm from './ContactForm/ContactForm';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';
import { requestLaunch } from 'components/World/worldStore';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import { Contact as ContactProps, ContactInfo } from '@/types';

import './Contact.scss';

const toastAutoDismissMs = 8000;

const ContactCard = ({ info }: { info: ContactInfo }) => {
  const ref = usePointerGlow<HTMLDivElement>();
  const [copied, setCopied] = useState(false);
  const external = info.link?.startsWith('http');
  const copyable = info.name === 'Email';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — the link still works
    }
  };

  const body = (
    <>
      <span className="contact__card-icon" aria-hidden="true">
        <Icon icon={info.class} width={20} height={20} />
      </span>
      <span className="contact__card-text">
        <span className="contact__card-label">{info.name}</span>
        <span className="contact__card-value">{info.value}</span>
      </span>
      {info.link && (
        <Icon
          icon="ph:arrow-up-right-bold"
          className="contact__card-arrow"
          width={16}
          height={16}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <RevealItem as="li" className="contact__card-cell">
      <div className="contact__card glass spotlight" ref={ref}>
        {info.link ? (
          <Link
            href={info.link}
            prefetch={false}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="contact__card-link"
            aria-label={`${info.name}: ${info.value}${external ? ' (opens in a new tab)' : ''}`}
          >
            {body}
          </Link>
        ) : (
          <div className="contact__card-link">{body}</div>
        )}
        {copyable && (
          <button
            type="button"
            className={`contact__copy${copied ? ' contact__copy--done' : ''}`}
            onClick={copy}
            aria-label={copied ? 'Email address copied' : 'Copy email address'}
          >
            <Icon icon={copied ? 'ph:check-bold' : 'ph:copy-bold'} width={16} height={16} />
          </button>
        )}
      </div>
    </RevealItem>
  );
};

export const Contact = ({ contact }: { contact: ContactProps }) => {
  const { label, tagline, contactInfo, sendAgain, error: errorContent, success, close } = contact;

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
    <section id="contact" className="page contact" aria-labelledby="contact-heading">
      <PageHead
        id="contact-heading"
        index="05"
        label={label}
        title="Let’s"
        accent="connect"
        sub={tagline}
      />

      <div className="contact__grid">
        <aside className="contact__side">
          <Reveal className="contact__intro">
            <h2 className="contact__intro-title">{contactInfo.title}</h2>
            <p className="contact__intro-text">{contactInfo.description}</p>
            <p className="contact__sla">
              <span className="contact__sla-dot" aria-hidden="true" />
              Usually replies within a working day
            </p>
          </Reveal>

          <address>
            <RevealGroup as="ul" className="contact__list" stagger={0.08}>
              {contactInfo.items.map((info) => (
                <ContactCard key={info.name} info={info} />
              ))}
            </RevealGroup>
          </address>

          <Reveal className="contact__beacon" delay={0.2}>
            <span className="contact__beacon-icon" aria-hidden="true">
              <Icon icon="ph:broadcast-bold" width={18} height={18} />
            </span>
            <span>
              Transmitting from <b>52.57°N · 0.24°W</b> — Peterborough, UK. Remote across the UK
              &amp; EU.
            </span>
          </Reveal>
        </aside>

        <Reveal
          className={`contact__panel glass${submitted ? ' contact__panel--submitted' : ''}`}
          delay={0.12}
          y={50}
        >
          <span className="contact__panel-glow" aria-hidden="true" />
          <AnimatePresence mode="wait" initial={false}>
            {submitted ? (
              <m.div
                key="success"
                className="contact__success"
                initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <svg className="contact__success-mark" viewBox="0 0 80 80" aria-hidden="true">
                  <circle cx="40" cy="40" r="36" />
                  <path d="M25 41 l10 10 l20 -22" />
                </svg>
                <p className="contact__success-eyebrow">Transmission received</p>
                <h2 className="contact__success-title">{success.headerText}</h2>
                <p className="contact__success-text">{success.bodyText}</p>
                <button type="button" className="btn btn--ghost" onClick={handleSendAnother}>
                  <Icon icon={sendAgain.icon} width={18} height={18} aria-hidden="true" />
                  <span>{sendAgain.text}</span>
                </button>
              </m.div>
            ) : (
              <m.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="contact__panel-head">
                  <h2 className="contact__panel-title">Send a message</h2>
                  <span className="contact__panel-status" aria-hidden="true">
                    <span /> channel open
                  </span>
                </div>
                <ContactForm
                  contact={contact}
                  onSuccess={() => {
                    setError(false);
                    setSubmitted(true);
                    setShowToast(true);
                    requestLaunch();
                  }}
                  onFail={() => {
                    setError(true);
                    setShowToast(true);
                  }}
                />
              </m.div>
            )}
          </AnimatePresence>
        </Reveal>
      </div>

      <AnimatePresence>
        {showToast && (
          <m.div
            className={`contact__toast contact__toast--${error ? 'error' : 'success'}`}
            role={error ? 'alert' : 'status'}
            aria-live={error ? 'assertive' : 'polite'}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
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
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Contact;
