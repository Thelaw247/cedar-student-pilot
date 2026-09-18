import { SUPPORT_EMAIL } from './legal.js';

/**
 * The person behind Praelecta, in one place.
 *
 * Rendered on /about, in the landing footer and in the Organization JSON-LD.
 * A study app asking students to trust it with lecture audio should have a
 * name and a face on it; until now the only trace of a person on the site was
 * a GitHub username in the download links.
 *
 * `photo` is served from /public — drop the file in and the page picks it up
 * (until then the page shows initials, never a broken image). `linkedin` is
 * rendered only when set, so an empty string is a missing link, not a dead one.
 */
export const FOUNDER = {
  name: 'De Wet Luus',
  initials: 'DW',
  role: 'Founder',
  line: 'Engineering student at the University of Saskatchewan',
  location: 'Saskatoon, Canada',
  photo: '/founder.jpg',
  linkedin: '',
  email: SUPPORT_EMAIL,
};
