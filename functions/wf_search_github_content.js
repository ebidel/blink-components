/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const fetch = require('node-fetch');
const parseLinkHeader = require('parse-link-header');

async function fetchAllPages(url) {
  const items = [];

  const _fetchPage = async function(url) {
    // const resp = await fetch(url, {
    //   method: 'GET',
    //   headers: {Authorization: `token ${OAUTH_TOKEN}`}
    // });
    const resp = await fetch(url);
    const json = await resp.json();

    const limit = resp.headers.get('X-RateLimit-Limit');
    const remaining = resp.headers.get('X-RateLimit-Remaining');
    console.info(`${remaining}/${limit} Github API queries remaining.`);

    items.push(...json.items);

    const linkHeader = parseLinkHeader(resp.headers.get('Link'));
    if (linkHeader && linkHeader.next) {
      return _fetchPage(linkHeader.next.url);
    }

    if (json.total_count !== items.length) {
      console.warn('Fewer results than expected in total results.');
    }

    return items;
  };

  return _fetchPage(url);
}

async function fetchFileContent(url) {
  console.info(`Fetching file: ${url}`);
  const resp = await fetch(url);
  const text = await resp.text();
  return {url, text};
}

function parseFile(text) {
  const RE_BLINK_COMPONENTS = /{#\s?wf_blink_components:\s?(.*?)\s?#}\s?\n/m;
  const RE_UPDATED_ON = /{#\s?wf_updated_on:\s?(.*?)\s?#}\s?\n/m;
  const RE_PUBLISHED_ON = /{#\s?wf_published_on:\s?(.*?)\s?#}\s?\n/m;

  const obj = {};

  let matched = RE_BLINK_COMPONENTS.exec(text);
  obj.components = matched ? matched[1].split(',').map(item => item.trim()) : [];

  matched = RE_PUBLISHED_ON.exec(text);
  obj.publishedOn = matched ? matched[1] : null;

  matched = RE_UPDATED_ON.exec(text);
  obj.updatedOn = matched ? matched[1] : null;

  return obj;
}

module.exports = {
  fetchAllPages,
  fetchFileContent,
  parseFile,
};
