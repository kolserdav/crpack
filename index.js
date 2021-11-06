// @ts-check

const spawn = require('child_process').spawn;

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Dim = '\x1b[2m';

/**
 *
 * @param {{ command: string, args: string[], options?: any }} props
 * @returns {Promise<any>}
 */
async function getSpawn(props) {
  const { command, args, options } = props;
  return await new Promise((resolve, reject) => {
    const sh = spawn.call('sh', command, args, options || {});
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
