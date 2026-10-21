// The books and the pages offered in the studio. Page ids match files in pages/ and thumbs/.

export const BOOKS = {
  wildwood: {
    title: 'The Wildwood Games',
    blurb: 'Foxes, Bears, Wolves and Eagles compete for forest fame. Every picture comes with a page of story.',
    cover: '../assets/wildwood-cover.jpg',
    stores: { us: 'https://www.amazon.com/dp/B0GMQHKPHF', ca: 'https://www.amazon.ca/dp/B0GNZSL2VB' },
    anchor: '../#inside',
  },
  robot: {
    title: 'Robot Coloring Book',
    blurb: 'Scribbles the tiny robot loses his favourite colouring book, and finds a friend.',
    cover: '../assets/robot-cover.jpg',
    stores: {
      us: 'https://www.amazon.com/dp/B0BMSVSS66',
      ca: 'https://www.amazon.ca/dp/B0BMSVSS66',
      uk: 'https://www.amazon.co.uk/dp/B0BMSVSS66',
    },
    anchor: '../#robots',
  },
  cars: {
    title: 'Cars Coloring Book',
    blurb: 'Classics, minis, muscle cars and race cars: 40 bold designs, one per page.',
    cover: '../assets/cars-cover.jpg',
    stores: {
      us: 'https://www.amazon.com/dp/B0BRQ644RV',
      ca: 'https://www.amazon.ca/dp/B0BRQ644RV',
      uk: 'https://www.amazon.co.uk/dp/B0BRQ644RV',
    },
    anchor: '../#cars',
  },
};

export const PAGES = [
  { id: 'wildwood-29', book: 'wildwood', title: 'Fox soccer' },
  { id: 'wildwood-5', book: 'wildwood', title: 'Snappy lights the torch' },
  { id: 'wildwood-23', book: 'wildwood', title: 'Eagle sky-basketball' },
  { id: 'wildwood-33', book: 'wildwood', title: 'The steeplechase' },
  { id: 'wildwood-45', book: 'wildwood', title: 'Bear wrestling' },
  { id: 'wildwood-3', book: 'wildwood', title: 'Make a team symbol' },
  { id: 'wildwood-71', book: 'wildwood', title: 'Closing ceremony' },
  { id: 'wildwood-73', book: 'wildwood', title: 'A trophy for you' },
  { id: 'robot-3', book: 'robot', title: 'Meet Scribbles' },
  { id: 'robot-5', book: 'robot', title: 'Flower friend' },
  { id: 'robot-21', book: 'robot', title: 'A day at the fair' },
  { id: 'robot-37', book: 'robot', title: 'Overjoyed!' },
  { id: 'cars-3', book: 'cars', title: 'Little classic' },
  { id: 'cars-5', book: 'cars', title: 'Striped beetle' },
  { id: 'cars-7', book: 'cars', title: 'Smiley sedan' },
  { id: 'cars-35', book: 'cars', title: 'Sunset cruiser' },
];

// Sends each visitor to their own Amazon: Canada and the UK by browser language, amazon.com for everyone else.
export function storeRegion(lang = '') {
  if (/-(gb|uk|ie)$/i.test(lang)) return 'uk';
  if (/-ca$/i.test(lang)) return 'ca';
  return 'us';
}

export function storeLink(book, lang = '') {
  return book.stores[storeRegion(lang)] || book.stores.us || book.stores.ca;
}
