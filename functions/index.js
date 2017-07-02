const {URL} = (typeof self !== 'undefined' && self.URL) || require('whatwg-url');
const csv = require('csvtojson');
const fetch = require('node-fetch');
const functions = require('firebase-functions');
const searcher = require('./wf_search_github_content');

const ENDPOINT = 'https://storage.googleapis.com/chromium-owners/component_map.json';
const SPREADSHEET_KEY = '19JEFMvsxD3eThyGiJRqAjcpx362LHUDdVzICAg7TYZA';


/**
 * Returns the list of unique values in an array.
 * @param {!Array} arr
 * @return {!Array}
 */
function unique(arr) {
  const set = new Set(arr);
  return [...set];
}

/**
 * Converts a Map into an Object.
 * @param {!Map} map
 * @return {!Object<string, *>}
 */
function mapToObj(map) {
  const obj = {};
  for (const [k,v] of map) {
    obj[k] = v;
  }
  return obj;
}

/**
 * @param {string} url
 * @return {string} JSON response.
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

// GET /blinkcomponents
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

// GET /wfcomponents
exports.wfcomponents = functions.https.onRequest(async (req, res) => {
  const REPO = 'Google/WebFundamentals';
  const SEARCH_TERM = 'wf_blink_components';

  const url = new URL('https://api.github.com/search/code');
  url.searchParams.append(
      'q', `${SEARCH_TERM} in:file language:markdown repo:${REPO}`);
  url.searchParams.append('per_page', 100); // get max results per page.
  url.searchParams.append('access_token', functions.config().github.oauth_token);

  const blinkComponentsToMetadata = new Map();
  const urlsToMetadata = new Map();

  const files = await searcher.fetchAllPages(url.href);
  for (const file of files) { // fetch files sequentially.
  // await Promise.all(files.map(async file => { // fetch files  in parallel.
    const srcPath = `https://github.com/${REPO}/blob/master/${file.path}`;
    const result = await searcher.fetchFileContent(file.html_url);
    const metadata = searcher.parseFile(result.text);

    // Map found blink component names to the content URLs that used them.
    metadata.components.forEach(component => {
      const obj = Object.assign({url: srcPath}, metadata);
      if (blinkComponentsToMetadata.has(component)) {
        blinkComponentsToMetadata.get(component).push(obj);
      } else {
        blinkComponentsToMetadata.set(component, [obj]);
      }
    });

    // Also map content URLs to metadata.
    if (urlsToMetadata.has(srcPath)) {
      urlsToMetadata.get(srcPath).push();
    } else {
      urlsToMetadata.set(srcPath, [metadata]);
    }
  // }));
  }

  res.set('Cache-Control', 'private, max-age=300');
  res.set('Access-Control-Allow-Origin', '*');
  res.status(200).send(mapToObj(blinkComponentsToMetadata));
});
