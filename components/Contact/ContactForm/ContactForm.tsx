'use client';

import { useState } from 'react';
import { Formik } from 'formik';
import { object, string } from 'yup';
import { Icon } from '@iconify/react';

import { Contact as ContactProps } from '@/types';

import './ContactForm.scss';

interface ContactFormProps {
  contact: ContactProps;
  onSuccess: () => void;
  onFail: (response: Response) => void;
}

const ContactForm = ({ contact, onSuccess, onFail }: ContactFormProps) => {
  const { submitting, send } = contact;

  const [loading, setLoading] = useState(false);

  const maxMessageLength = 1000;

  const formSchema = object().shape({
    firstName: string().required('Enter your first name'),
    lastName: string().required('Enter your last name'),
    email: string().email('Enter a valid email address').required('Enter your email'),
    message: string()
      .required('Please write a message')
      .max(maxMessageLength, `Message must be ${maxMessageLength} characters or fewer`),
  });

  const handleSubmit = async ({
    firstName,
    lastName,
    email,
    message,
  }: {
    firstName: string;
    lastName: string;
    email: string;
    message: string;
  }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/sendmail', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, message }),
        headers: { 'Content-Type': 'application/json' },
      });
      setLoading(false);
      if (response.status === 200) onSuccess();
      else onFail(response);
    } catch {
      setLoading(false);
      onFail(new Response(null, { status: 0, statusText: 'Network Error' }));
    }
  };

  return (
    <div className="contact__form-wrapper">
      <Formik
        validationSchema={formSchema}
        onSubmit={handleSubmit}
        validateOnBlur
        validateOnChange={false}
        initialValues={{
          firstName: '',
          lastName: '',
          email: '',
          message: '',
        }}
      >
        {({ handleSubmit: formikSubmit, handleChange, handleBlur, values, errors, touched }) => {
          const showError = (field: keyof typeof errors) => touched[field] && errors[field];

          return (
            <form
              noValidate
              onSubmit={formikSubmit}
              className="contact-form"
              aria-busy={loading}
              aria-live="polite"
            >
              <div className="contact-form__row">
                <div className="contact-form__field">
                  <label htmlFor="formFirstName" className="contact-form__label">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="formFirstName"
                    className={`contact-form__input${showError('firstName') ? ' contact-form__input--invalid' : ''}`}
                    placeholder="First Name *"
                    name="firstName"
                    value={values.firstName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="given-name"
                    aria-required="true"
                    aria-invalid={!!showError('firstName')}
                    aria-describedby={showError('firstName') ? 'formFirstName-error' : undefined}
                  />
                  {showError('firstName') && (
                    <span id="formFirstName-error" className="contact-form__error" role="alert">
                      {errors.firstName}
                    </span>
                  )}
                </div>
                <div className="contact-form__field">
                  <label htmlFor="formLastName" className="contact-form__label">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="formLastName"
                    className={`contact-form__input${showError('lastName') ? ' contact-form__input--invalid' : ''}`}
                    placeholder="Last Name *"
                    name="lastName"
                    value={values.lastName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="family-name"
                    aria-required="true"
                    aria-invalid={!!showError('lastName')}
                    aria-describedby={showError('lastName') ? 'formLastName-error' : undefined}
                  />
                  {showError('lastName') && (
                    <span id="formLastName-error" className="contact-form__error" role="alert">
                      {errors.lastName}
                    </span>
                  )}
                </div>
              </div>

              <div className="contact-form__field">
                <label htmlFor="formEmail" className="contact-form__label">
                  Email address
                </label>
                <input
                  type="email"
                  id="formEmail"
                  className={`contact-form__input${showError('email') ? ' contact-form__input--invalid' : ''}`}
                  placeholder="Email *"
                  name="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={!!showError('email')}
                  aria-describedby={showError('email') ? 'formEmail-error' : undefined}
                />
                {showError('email') && (
                  <span id="formEmail-error" className="contact-form__error" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="contact-form__field">
                <label htmlFor="formMessage" className="contact-form__label">
                  Message
                </label>
                <textarea
                  id="formMessage"
                  className={`contact-form__input contact-form__textarea${showError('message') ? ' contact-form__input--invalid' : ''}`}
                  rows={4}
                  placeholder="Your message *"
                  name="message"
                  value={values.message}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={maxMessageLength}
                  aria-required="true"
                  aria-invalid={!!showError('message')}
                  aria-describedby={`formMessage-counter${showError('message') ? ' formMessage-error' : ''}`}
                />
                <div className="contact-form__field-footer">
                  {showError('message') ? (
                    <span id="formMessage-error" className="contact-form__error" role="alert">
                      {errors.message}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span
                    id="formMessage-counter"
                    className={`contact-form__counter${values.message.length > maxMessageLength * 0.9 ? ' contact-form__counter--warn' : ''}`}
                    aria-live="polite"
                  >
                    {values.message.length}/{maxMessageLength}
                  </span>
                </div>
              </div>

              <button type="submit" disabled={loading} className="contact-form__submit">
                {loading ? (
                  <>
                    <span className="contact-form__spinner" aria-hidden="true" />
                    <span>{submitting.text}</span>
                  </>
                ) : (
                  <>
                    <Icon
                      icon={send.icon}
                      className="contact-form__submit-icon"
                      aria-hidden="true"
                    />
                    <span>{send.text}</span>
                  </>
                )}
              </button>
            </form>
          );
        }}
      </Formik>
    </div>
  );
};

export default ContactForm;
