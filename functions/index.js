const functions = require('firebase-functions');
const fetch = require('node-fetch');
const csv = require('csvtojson');

const ENDPOINT = 'https://storage.googleapis.com/chromium-owners/component_map.json';
const SPREADSHEET_KEY = '19JEFMvsxD3eThyGiJRqAjcpx362LHUDdVzICAg7TYZA';


function unique(arr) {
  const set = new Set(arr);
  return [...set];
}

/**
 * @param {string} url
 */
function fetchMappingFile(url) {
  return fetch(url).then(resp => {
    if (!resp.ok) {
      throw new Error(`${resp.status} response from ${url}`);
    }
    return resp.json();
  });
}

function getBlinkComponents() {
  return fetchMappingFile(ENDPOINT).then(json => {
    const components = Object.keys(json['component-to-team']);
    // Note: Can't use Object.values() b/c Firebase doesn't Node > 6 :(
    for (const key in json['dir-to-component']) {
      components.push(json['dir-to-component'][key]);
    }
    return unique(components).sort();
  });
}

function getComponentsFromSpreadsheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/export?gid=0&format=csv`;

  const getSpreadsheet = fetch(url).then(resp => {
    if (!resp.ok) {
      throw new Error(`${resp.status} response from ${url}`);
    }
    return resp.text();
  });

  const processCSV = (csvStr) => {
    return new Promise((resolve, reject) => {
      const components = [];

      csv().fromString(csvStr)
        .on('csv', csvRow => components.push(csvRow[0]))
        .on('done', err => {
          if (err) {
            return reject(err);
          }
          resolve(components);
        });
    });
  }

  return getSpreadsheet.then(csvStr => processCSV(csvStr));
}

exports.blinkcomponents = functions.https.onRequest((req, res) => {
  let components;

  getBlinkComponents()
    .then(list => {
      components = list;
      return getComponentsFromSpreadsheet();
    })
    .then(list => unique([...components, ...list]).sort())
    .then(list => {
      list = list.filter(item => item); // Remove empty strings.
      res.set('Cache-Control', 'private, max-age=300');
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).send(list);
    }).catch(err => {
      res.status(500).send(err);
    })
});

// exports.bigben = functions.https.onRequest((req, res) => {
//   const hours = (new Date().getHours() % 12) + 1 // london is UTC + 1hr;
//   res.status(200).send(`<!doctype html>
//     <head>
//       <title>Time</title>
//     </head>
//     <body>
//       ${'BONG '.repeat(hours)}
//     </body>
//   </html>`);
// });
