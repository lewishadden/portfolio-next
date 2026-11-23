export const projectStories: Record<
  string,
  {
    problem: string;
    contribution: string;
    result: string;
    steps: { title: string; text: string }[];
    demonstration?: 'citations' | 'modules' | 'pipeline' | 'architecture';
  }
> = {
  'zgs-carpentry': {
    problem:
      'A local carpenter needed a website to explain his services, show completed work and receive quote enquiries.',
    contribution:
      'I designed and built the entire site, including service and area pages, an interactive coverage map and a Three.js tool showcase.',
    result:
      'Thirteen service pages, a filtered project gallery and direct email enquiries bring the business together in one website.',
    steps: [
      {
        title: 'Find a service',
        text: 'Individual pages explain the carpentry, joinery, tiling and other services available.',
      },
      {
        title: 'Explore local work',
        text: 'The coverage map links to area pages, while the gallery filters completed jobs by category.',
      },
      {
        title: 'Request a quote',
        text: 'The quote form sends enquiries directly to Zak by email through Resend.',
      },
    ],
  },
  sidenote: {
    problem:
      'Dense articles, research papers and documents need explanations that readers can trace back to the source.',
    contribution:
      'I designed and built the Chrome extension and backend, combining document summaries, chat, explanations and citation retrieval.',
    result:
      'Readers can choose three summary depths and follow numbered citations back to highlighted source passages, with a free tier available.',
    demonstration: 'citations',
    steps: [
      {
        title: 'Read a document',
        text: 'Read an article, PDF, research paper or uploaded document with the assistant in the browser side panel.',
      },
      {
        title: 'Retrieve supporting text',
        text: 'The backend pairs Supabase (Postgres with pgvector) with Voyage AI embeddings for citation retrieval.',
      },
      {
        title: 'Read a cited answer',
        text: 'Claude generates document answers backed by numbered citations. The extension also offers three summary depths and explanations at a chosen reading level.',
      },
      {
        title: 'Follow the citation',
        text: 'Click a numbered citation to scroll to and highlight the exact passage supporting an answer.',
      },
    ],
  },
  'drive-king': {
    problem:
      'A local driving instructor needed a website to explain lessons, show coverage and help prospective learners get in touch.',
    contribution:
      'I designed and built the site, including local area pages, a Leaflet map, live Google reviews and TinaCMS editing.',
    result:
      'Learners can explore local routes, test centres and lesson prices, while the instructor can edit the website content.',
    steps: [
      {
        title: 'Meet the instructor',
        text: 'The site introduces Janine and her car, alongside student passes and live Google reviews.',
      },
      {
        title: 'Explore the area',
        text: 'An interactive map and dedicated area pages show coverage, local routes and nearby test centres.',
      },
      {
        title: 'Enquire about lessons',
        text: 'Visitors can review pricing and learner guides, then send an enquiry by email through the contact form.',
      },
    ],
  },
  'smiley-pets': {
    problem:
      'An established local pet care business needed a website to present its services, credentials and booking information.',
    contribution:
      'I designed and built the Next.js site from scratch, bringing together service information, testimonials and pet photography.',
    result:
      'The deployed site showcases dog walking and pet sitting with a gallery, contact and booking section, and social links.',
    steps: [
      {
        title: 'Explore pet care',
        text: 'Service information introduces the business and its dog walking and pet sitting work.',
      },
      {
        title: 'Meet the pets',
        text: 'A photo film strip, full gallery and client testimonials show pets in the team’s care.',
      },
      {
        title: 'Arrange a booking',
        text: 'The contact and booking section gives visitors a way to enquire about care for their pets.',
      },
    ],
  },
  'sip-happens': {
    problem:
      'Espresso martini enthusiasts needed a dedicated place to discover reviewed bars and explore the drink’s culture.',
    contribution:
      'I designed and built the review platform, global map and recommendation submissions, backed by PostgreSQL.',
    result:
      'The live site brings together international bar reviews, blog posts and visitor recommendations.',
    steps: [
      {
        title: 'Explore the map',
        text: 'An interactive global map lets visitors discover reviewed bars by location.',
      },
      {
        title: 'Read the review',
        text: 'Detailed bar reviews and blog posts cover espresso martinis and the culture around them.',
      },
      {
        title: 'Recommend a bar',
        text: 'Visitors can submit bar recommendations to help expand the platform’s coverage.',
      },
    ],
  },
  'adp-run': {
    problem:
      'ADP RUN required customisable platform enhancements with a responsive experience for mobile users.',
    contribution:
      'I develop features with React, Tailwind CSS and feature flags, and write unit and end-to-end tests.',
    result:
      'Platform enhancements pair responsive interfaces with Jest, React Testing Library and Cypress coverage.',
    steps: [
      {
        title: 'Build the interface',
        text: 'React and Tailwind CSS support responsive features designed for mobile users.',
      },
      {
        title: 'Configure the experience',
        text: 'Feature flags enable a customisable experience across the platform.',
      },
      {
        title: 'Check the behaviour',
        text: 'Unit tests and Cypress end-to-end tests support the reliability of new features and enhancements.',
      },
    ],
  },
  'sanctions-checker': {
    problem:
      'An insurance MGA needed to check names against public sanctions data when assessing travel insurance eligibility.',
    contribution:
      'I built the daily data import, Cosmos DB search API and Next.js interface, combining queries for aliases and abbreviated names.',
    result:
      'The tool returns matching sanctions records and their public details, with the source dataset refreshed daily.',
    demonstration: 'pipeline',
    steps: [
      {
        title: 'Refresh the dataset',
        text: 'A daily job retrieves the latest public sanctions dataset and stores it in Cosmos DB.',
      },
      {
        title: 'Search across names',
        text: 'The API combines SQL queries across search vectors, including aliases and abbreviated first names.',
      },
      {
        title: 'Review the records',
        text: 'The Next.js interface submits a name and displays the matching records and publicly available details.',
      },
    ],
  },
  oralieve: {
    problem:
      'Oralieve needed updates to its Shopify store, including patient sample requests and free shipping above a minimum spend.',
    contribution:
      'I implemented the patient samples form, minimum-spend shipping feature and further store features and bug fixes.',
    result:
      'Dental professionals can request free patient samples, and the store supports a minimum-spend free shipping offer.',
    steps: [
      {
        title: 'Request patient samples',
        text: 'A dedicated form lets dental professionals request free Oralieve samples for their patients.',
      },
      {
        title: 'Qualify for free shipping',
        text: 'The store offers free shipping when an order reaches the minimum spend.',
      },
      {
        title: 'Maintain the store',
        text: 'Additional features and bug fixes improve the existing Shopify storefront.',
      },
    ],
  },
  'airdoctor-webhook': {
    problem:
      'ERGO needed to ingest and process insurance claims from AirDoctor as part of its partner insurance offering.',
    contribution:
      'As the sole developer, I architected, built and deployed the webhook and created a Docker stack with local Azure emulators.',
    result:
      'The production integration enabled new partner insurance business through AirDoctor, with a reusable setup for local development.',
    steps: [
      {
        title: 'Receive claims',
        text: 'The webhook ingests insurance claims from the AirDoctor platform.',
      },
      {
        title: 'Process the integration',
        text: 'The deployed solution processes those claims for ERGO’s AirDoctor integration.',
      },
      {
        title: 'Develop locally',
        text: 'Docker and local Azure emulators support offline development and reduce the risk of unwanted actions in a hosted environment.',
      },
    ],
  },
  'audi-form-builder': {
    problem: 'Audi content editors needed to create custom website forms without writing new code.',
    contribution:
      'I designed and implemented the form-building solution while leading the development team.',
    result:
      'Editors can assemble forms from React micro-frontends; four Audi website forms were created with the builder.',
    demonstration: 'modules',
    steps: [
      {
        title: 'Choose the modules',
        text: 'Content editors use the available React micro-frontends as the building blocks for a custom form.',
      },
      {
        title: 'Assemble the page',
        text: 'Editors drag and drop the modules onto a new Audi website page.',
      },
      {
        title: 'Create the form',
        text: 'The assembled modules work together without requiring new code for each form.',
      },
    ],
  },
  'cookie-control': {
    problem:
      'Audi UK needed cookie settings to control third-party tracking and analytics as part of its GDPR requirements.',
    contribution:
      'I independently designed and implemented the Cookie Control system using Adobe Launch rules and JavaScript tags.',
    result:
      'Tracking tags and custom analytics are triggered according to the visitor’s cookie settings.',
    steps: [
      {
        title: 'Choose cookie settings',
        text: 'The visitor’s cookie settings determine which tracking behaviour is permitted.',
      },
      {
        title: 'Apply the rules',
        text: 'Custom Adobe Launch rule sets and JavaScript tags use those settings.',
      },
      {
        title: 'Control tracking',
        text: 'Third-party tags and custom analytics trigger according to the selected settings.',
      },
    ],
  },
  'audi-digital-transformation': {
    problem: 'Audi UK was modernising its legacy technology stack and overhauling its website.',
    contribution:
      'I led front-end development of web applications and SPAs, contributed to the new infrastructure and moved into full-stack work.',
    result:
      'Over five years, my work contributed to the AWS migration, website overhaul and delivery of new applications.',
    steps: [
      {
        title: 'Modernise the platform',
        text: 'The programme migrated the legacy technology stack onto AWS.',
      },
      {
        title: 'Build new applications',
        text: 'The front-end team developed and implemented web applications and single-page applications.',
      },
      {
        title: 'Extend across the stack',
        text: 'I contributed to infrastructure decisions and expanded my role into full-stack development.',
      },
    ],
  },
  'traffic-management-portal': {
    problem:
      'Singapore’s LTA needed live road traffic information for monitoring, reporting and traffic management.',
    contribution:
      'I developed complex Angular dashboard components, migrated legacy code, and reviewed and deployed changes across environments.',
    result:
      'The portal presents live incidents, congestion maps, custom automated alerts and statistical charts.',
    steps: [
      {
        title: 'Monitor live conditions',
        text: 'Dashboards display current road traffic data, incidents and congestion maps.',
      },
      {
        title: 'Set custom alerts',
        text: 'LTA users can create automated alerts as part of their traffic monitoring workflow.',
      },
      {
        title: 'Explore the reports',
        text: 'Statistical charts and graphs support traffic reporting and management.',
      },
    ],
  },
  audex: {
    problem:
      'The Audex Analyse module needed front-end foundations for displaying live PowerBI analysis in React.',
    contribution:
      'I independently built the proof of concept, then created the official repository and the module’s underlying boilerplate.',
    result:
      'The proof of concept demonstrated live PowerBI data in React, and the module’s front-end foundations were delivered.',
    steps: [
      {
        title: 'Connect the data',
        text: 'The React proof of concept subscribes to a PowerBI data source.',
      },
      {
        title: 'Display live analysis',
        text: 'A PowerBI graph renders real-time analysis data inside the React application.',
      },
      {
        title: 'Establish the foundations',
        text: 'The official Analyse repository and boilerplate provide the starting point for the module.',
      },
    ],
  },
  'home-greening-microsite': {
    problem:
      'A proposed UK Power Networks microsite needed an Azure architecture that met functional and security requirements.',
    contribution:
      'I owned the cloud design, led planning with the cloud and front-end teams, and worked with the client’s security team.',
    result:
      'I delivered the proposed architecture, Cosmos DB schema, diagrams and technical design with implementation and configuration guidance.',
    demonstration: 'architecture',
    steps: [
      {
        title: 'Define the requirements',
        text: 'Microsite functionality informed the data requirements, while the client’s security team guided the security constraints.',
      },
      {
        title: 'Design Azure and Cosmos DB',
        text: 'The proposed cloud architecture uses the client’s preferred Azure platform, with a Cosmos DB schema derived from the data needs.',
      },
      {
        title: 'Document the proposal',
        text: 'Architecture diagrams and a technical design record service decisions, justifications and implementation steps.',
      },
    ],
  },
};
