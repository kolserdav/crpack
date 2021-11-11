// @ts-check
const path = require('path');
const SSHConfig = require('ssh-config');
const Worker = require('./lib');
const readline = require('readline');

const worker = new Worker();

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Cyan = '\x1b[36m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blue = '\x1b[34m';
const Blink = '\x1b[5m';

const { stdin, stdout, env } = process;
const { USER } = env;

/**
 * @typedef {1 | 0} Result
 *
 * @typedef {1 | string} ResultString
 *
 * @typedef {1 | void} ResultVoid
 *
 * @typedef {{
 *  type: number;
 *  param: 'Host' | 'Hostname' | 'IdentityFile' | 'IdentitiesOnly';
 *  separator: ' ';
 *  value: string;
 *  before: '' | '    ';
 *  after: '\n' | '';
 *  config?: SSHConfigType[]
 * }} SSHConfigType
 *
 * @typedef {{
 *  parse: () => SSHConfigType[];
 * }} SSHConfigInterface
 *
 *
 * Git logic class
 */
module.exports = class Employer {
  /**
   * @type {string}
   */
  sshConfig;

  /**
   * @type {string}
   */
  sshHost;

  /**
   * @type {string}
   */
  secretKeyPath;

  /**
   * @type {string}
   */
  sshConfigDefault;

  /**
   * @type {boolean}
   */
  configExists;

  constructor() {
    this.sshConfig = `/home/${USER}/.ssh/config`;
    this.sshConfigDefault = path.resolve(__dirname, '../.crpack/templates/git/ssh/config');
    this.sshHost = 'gitlab.com';
    this.configExists = false;
    this.secretKeyPath = `/home/${USER}/.ssh/gitlab`;
  }

  /**
   *
   * @returns {SSHConfigType}
   */
  createConfigFromDefault() {
    return {
      type: 1,
      param: 'Host',
      separator: ' ',
      value: this.sshHost,
      before: '',
      after: '\n',
      config: [
        {
          type: 1,
          param: 'Hostname',
          separator: ' ',
          value: this.sshHost,
          before: '    ',
          after: '\n',
        },
        {
          type: 1,
          param: 'IdentityFile',
          separator: ' ',
          value: this.secretKeyPath,
          before: '    ',
          after: '\n',
        },
        {
          type: 1,
          param: 'IdentitiesOnly',
          separator: ' ',
          value: 'yes',
          before: '    ',
          after: '',
        },
      ],
    };
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async setSshHost() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    return new Promise((resolve) => {
      rl.question(`Git host: ${Dim} ${this.sshHost} ${Reset}> `, (value) => {
        this.sshHost = value || this.sshHost;
        rl.close();
        resolve(0);
      });
    });
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async setSecretKeyPath() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    return new Promise((resolve) => {
      rl.question(`SSH secret key file path: ${Dim} ${this.secretKeyPath} ${Reset}> `, (value) => {
        this.secretKeyPath = value || this.secretKeyPath;
        rl.close();
        resolve(0);
      });
    });
  }

  /**
   *
   * @param {SSHConfigType[]} config
   * @returns {string}
   */
  stringigyConfig(config) {
    /**
     * @type {any}
     */
    const _config = config;
    return SSHConfig.stringify(_config);
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async create() {
    const config = this.changeConfig();
    if (this.configExists) {
      const writeRes = worker.writeFile(this.sshConfig, this.stringigyConfig(config));
      if (writeRes === 1) {
        return 1;
      }
      console.info(worker.info, 'File changed:', Cyan, this.sshConfig, Reset);
    } else {
      ///
    }

    console.log(11, 1);
    return 0;
  }

  /**
   * if config with the same name exists in /home/root/.ssh/config
   * @returns {SSHConfigType[]}
   */
  changeConfig() {
    this.configExists = worker.fileExists(this.sshConfig);
    let configData;
    let isDefault = false;
    if (this.configExists) {
      configData = worker.readFile(this.sshConfig);
    } else {
      configData = worker.readFile(this.sshConfigDefault);
      isDefault = true;
    }
    /**
     * @type {any}
     */
    const config = SSHConfig.parse(configData);

    let savedConfig = false;
    const _config = config.map((item) => {
      const _item = { ...item };
      if (item.config) {
        if (item.param === 'Host') {
          _item.type = item.type;
          _item.param = item.param;
          _item.separator = item.separator;
          _item.value = item.value;
          _item.before = item.before;
          _item.after = item.after;

          let givenConfig = false;
          _item.config = item.config.map((__item) => {
            const ___item = { ...__item };
            if (__item.param === 'Hostname' && __item.value === this.sshHost) {
              givenConfig = true;
              savedConfig = true;
              ___item.value = __item.value;
            } else if (isDefault) {
              givenConfig = true;
              ___item.value = this.sshHost;
            }
            if (givenConfig) {
              if (__item.param === 'IdentityFile') {
                ___item.value = this.secretKeyPath;
              }
              if (__item.param === 'IdentitiesOnly') {
                ___item.value = 'yes';
              }
            }
            return ___item;
          });
        }
      }
      return _item;
    });
    if (!savedConfig) {
      _config.push(this.createConfigFromDefault());
    }
    return _config;
  }
};
