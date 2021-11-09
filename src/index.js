/******************************************************************************************
 * Repository: https://github.com/kolserdav/crpack.git
 * Author: Sergey Kolmiller
 * Email: <serega12101983@gmail.com>
 * License: MIT
 * License Text: The code is distributed as is. There are no guarantees regarding the functionality of the code or parts of it.
 * Copyright: kolserdav, All rights reserved (c)
 * Create date: Wed Nov 10 2021 03:03:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
// @ts-check

const Worker = require('./lib');

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blink = '\x1b[5m';

class Factory extends Worker {
  constructor() {
    super();
    const { argv } = process;
    if (process.argv.indexOf('--trace-warnings') !== -1) {
      this.traceWarnings = true;
    }
    if (process.argv.indexOf('--renew-default') !== -1) {
      this.renewDefault = true;
    }
  }

  /**
   * Commands map
   */
  async run() {
    console.info(this.info, Reset, 'Started create system package script...');
    const controller = new AbortController();
    const { signal } = controller;
    const arg2 = process.argv[2];
    const version = `CrPack version ${this.npmPackageVersion}`;
    const help = `
    ${version}
> crpack [options]     
OPTIONS
--name: package name 
--trace-warnings: show all warnings
--renew-default: rewrite default cache nginx file
  `;
    let args;
    let pName;
    switch (arg2) {
      case '-h':
        console.info(help);
        break;
      case '--help':
        console.info(help);
        break;
      case '--name':
        pName = process.argv[3];
        if (!pName) {
          console.error(this.error, Red, `Package name is ${pName}, please use string`, Reset);
          break;
        }
        await this.createPackage(pName);
        console.info(this.info, `Package ${pName} created successfully!`);
        process.exit(0);
        break;
      case '-v':
        console.info(version);
        break;
      case '--version':
        console.info(version);
        break;
      default:
        console.info(
          `
error Unknown command ${arg2}
Try run "crpack --help" 
        ${help}
      `,
          Reset
        );
    }
  }
}

const r = new Factory();

(async () => {
  await r.run();
})();
