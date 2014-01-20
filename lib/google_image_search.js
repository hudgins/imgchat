
var agent = require('superagent');

// request:
// 'https://www.googleapis.com/customsearch/v1?key=AIzaSyBGoNV9FM6BSn4do7uVvdCXrtbBrPIOYr4&cx=012723436201267046883:yr0c2b-dvmm&q=cats&num=1'
// response:
// res.body.items[0].pagemap.cse_thumbnail
// width, height, src
// res.body.items[0].pagemap.cse_image (a href for img)
// src

var CS_URL = 'https://www.googleapis.com/customsearch/v1';
var API_KEY = 'AIzaSyBGoNV9FM6BSn4do7uVvdCXrtbBrPIOYr4';
var CSE_ID = '012723436201267046883:yr0c2b-dvmm';

function query(terms, userIp, userId) {
  return {
    key: API_KEY
  , cx: CSE_ID
  , num: 10
  , safe: 'high'
  , userIp: userIp
  , quotaUser: userId
  , q: encodeURIComponent(terms).replace(/%20/g, '+')
  };
}

function getImage(terms, userIp, userId, done) {
  agent.get(CS_URL).type('json').query(query(terms, userIp, userId)).end(function(err, res) {
    if (err || !res.ok) return done(err || new Error('non-200 response: ' + res.status));
    if (!res.body || !res.body.items) return done(new Error('no results'));
    var result = null;
    res.body.items.forEach(function(item, index) {
      if (result === null &&
          item.pagemap &&
          item.pagemap.cse_thumbnail &&
          item.pagemap.cse_thumbnail.length &&
          item.pagemap.cse_image &&
          item.pagemap.cse_image.length) {
        console.log('using result number:', index);
        result = {
          // strip quotes and newlines from title
          title: item.title.replace(/[^0-9a-zA-Z :;?!@#$%^&*()\-_+=\[\],{}|\.]+/g, '')
        , link: item.link
        , snippet: item.snippet
        , thumbnail: {
            width:  item.pagemap.cse_thumbnail[0].width
          , height: item.pagemap.cse_thumbnail[0].height
          , url:    item.pagemap.cse_thumbnail[0].src
          }
        , original: {
            url: item.pagemap.cse_image[0].src
          }
        };
      }
    });
    console.log('result for:', query(terms).q);
    if (result) return done(null, result);
    console.warn('no image result for search:', terms, res.body.items);
    done(null, '');
  });
}

module.exports = {
  getImage: getImage
};

