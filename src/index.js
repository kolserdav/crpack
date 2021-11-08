// @ts-check

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

const { NPM_PACKAGE_VERSION, PWD } = process.env;
console.log(path.relative(PWD, __dirname));
const PROD = path.relative(PWD, __dirname) !== 'src';
const ROOT = PROD ? PWD : './';
const CONFIG_PATH = path.resolve(PWD, ROOT, 'package.json');

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blink = '\x1b[5m';

const ERROR = 'ERROR';
const INFO = 'INFO';

/**
 *
 * @param {{ command: string, args: string[], options?: any }} props
 * @returns {Promise<any>}
 */
async function getSpawn(props) {
  const { command, args, options } = props;
  console.info(Dim, `${command}${args.join(' ')}`, Reset);
  const sh = spawn.call('sh', command, args, options || {});
  return await new Promise((resolve, reject) => {
    sh.stdout?.on('data', (data) => {
      const str = data.toString();
      console.log(`\r\r${str}`);
    });
    sh.stderr?.on('data', (err) => {
      const str = err.toString();
      console.warn(`Error run command ${command}`, Red, str, Reset);
      reject(str);
    });
    sh.on('close', (code) => {
      resolve(code);
    });
  }).catch((e) => {
    console.error('error', e);
  });
}

/**
 *
 * @param {string} name
 */
function createPackage(name) {
  console.log(ROOT, PROD, PWD);
}

(async () => {
  console.info(INFO, Reset, 'Started create system package script...');
  const controller = new AbortController();
  const { signal } = controller;
  const arg2 = process.argv[2];
  const version = `CrPack version ${NPM_PACKAGE_VERSION}`;
  const help = `
    ${version}
> crpack [options]     
OPTIONS
--name - package name 
  `;
  let args;
  let pName;
  const cwd = PWD;
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
        console.error(ERROR, Red, `Package name is ${pName}, please use string`, Reset);
        break;
      }
      createPackage(pName);
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
})();
