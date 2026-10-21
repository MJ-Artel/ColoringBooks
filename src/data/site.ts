// Site-wide settings. Fill in the blanks as accounts get set up; each one switches a feature on.

export const SITE = {
  name: 'M.J. Artel',
  tagline: 'Story-led colouring books for curious kids',
  description:
    'Story-led colouring books for ages 4–10 by M.J. Artel: The Wildwood Games, Robots and Cars. Colour pages free online or print a free colouring pack.',
  ages: '4–10',
  agesNote: 'For ages 4–10, and any age can enjoy them.',

  // MailerLite → Forms → Embedded forms → your form → "HTML code". Copy the two numbers from the
  // form's action address: https://assets.mailerlite.com/jsonp/<accountId>/forms/<formId>/subscribe
  // Until both are set, the free pack is a plain download.
  mailerlite: { accountId: '2730927', formId: '201950724989388401' },

  // Shown on the Contact page (which stays hidden from menus and search until this is set).
  contactEmail: 'mjartel@proton.me',

  // Turn on after joining Amazon Associates: adds the required disclosure to every page.
  amazonAssociate: false,

  // Cloudflare Web Analytics token (cookie-free). Leave empty for no analytics.
  cloudflareBeacon: '',

  freePack: 'assets/mj-artel-free-colouring-pack.pdf',
  freePage: 'assets/free/wildwood-torch-page.pdf',
};

export const mailerliteAction = () =>
  SITE.mailerlite.accountId && SITE.mailerlite.formId
    ? `https://assets.mailerlite.com/jsonp/${SITE.mailerlite.accountId}/forms/${SITE.mailerlite.formId}/subscribe`
    : '';
