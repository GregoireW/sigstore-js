#!/usr/bin/env node

const fs = require('fs');

process.stdin.setEncoding('utf8');

let input = '';

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const firstParam = process.argv[2];

    if (firstParam === 'get' && input === 'my-registry') {
      const credentials = {
        Username: 'username',
        Secret: 'password'
      };
      console.log(JSON.stringify(credentials));
    } else {
      process.exit(-1);
    }
  } catch (err) {
    console.error('Failed to parse input:', err);
    process.exit(-1);
  }
});
