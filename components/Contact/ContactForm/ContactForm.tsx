'use client';

import { useState } from 'react';
import { Formik } from 'formik';
import { object, string } from 'yup';
import { Icon } from '@iconify/react';

import { Contact as ContactProps } from '@/types';

import './ContactForm.scss';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

interface ContactFormProps {
  contact: ContactProps;
  onSuccess: () => void;
  onFail: (response: Response) => void;
}

const ContactForm = ({ contact, onSuccess, onFail }: ContactFormProps) => {
  const { submitting, send } = contact;

  const [loading, setLoading] = useState(false);

  const formSchema = object().shape({
    firstName: string().required('Enter your first name'),
    lastName: string().required('Enter your last name'),
    email: string().email().required('Enter your email'),
    message: string().required('Please write a message'),
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
      const response = await fetch(`${apiUrl}/sendmail`, {
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
        initialValues={{
          firstName: '',
          lastName: '',
          email: '',
          message: '',
        }}
      >
        {({ handleSubmit: formikSubmit, handleChange, values, errors }) => (
          <form noValidate onSubmit={formikSubmit} className="contact-form">
            <div className="contact-form__row">
              <div className="contact-form__field">
                <label htmlFor="formFirstName" className="contact-form__label">
                  First Name
                </label>
                <input
                  type="text"
                  id="formFirstName"
                  className={`contact-form__input${errors.firstName ? ' contact-form__input--invalid' : ''}`}
                  placeholder="First Name *"
                  name="firstName"
                  value={values.firstName}
                  onChange={handleChange}
                  autoComplete="given-name"
                />
                {errors.firstName && (
                  <span className="contact-form__error">{errors.firstName}</span>
                )}
              </div>
              <div className="contact-form__field">
                <label htmlFor="formLastName" className="contact-form__label">
                  Last Name
                </label>
                <input
                  type="text"
                  id="formLastName"
                  className={`contact-form__input${errors.lastName ? ' contact-form__input--invalid' : ''}`}
                  placeholder="Last Name *"
                  name="lastName"
                  value={values.lastName}
                  onChange={handleChange}
                  autoComplete="family-name"
                />
                {errors.lastName && <span className="contact-form__error">{errors.lastName}</span>}
              </div>
            </div>

            <div className="contact-form__field">
              <label htmlFor="formEmail" className="contact-form__label">
                Email address
              </label>
              <input
                type="email"
                id="formEmail"
                className={`contact-form__input${errors.email ? ' contact-form__input--invalid' : ''}`}
                placeholder="Email *"
                name="email"
                value={values.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className="contact-form__error">{errors.email}</span>}
            </div>

            <div className="contact-form__field">
              <label htmlFor="formMessage" className="contact-form__label">
                Message
              </label>
              <textarea
                id="formMessage"
                className={`contact-form__input contact-form__textarea${errors.message ? ' contact-form__input--invalid' : ''}`}
                rows={4}
                placeholder="Your message *"
                name="message"
                value={values.message}
                onChange={handleChange}
              />
              {errors.message && <span className="contact-form__error">{errors.message}</span>}
            </div>

            <button type="submit" disabled={loading} className="contact-form__submit">
              {loading ? (
                <>
                  <span className="contact-form__spinner" aria-hidden="true" />
                  <span>{submitting.text}</span>
                </>
              ) : (
                <>
                  <Icon icon={send.icon} className="contact-form__submit-icon" aria-hidden="true" />
                  <span>{send.text}</span>
                </>
              )}
            </button>
          </form>
        )}
      </Formik>
    </div>
  );
};

export default ContactForm;
