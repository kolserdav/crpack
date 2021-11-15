// @ts-check
var os = require('os');
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
 *
 * @typedef {1 | 0 | string | undefined} ResultUndefined;
 *
 * @typedef {1 | 0 | boolean} NumberBoolean
 *
 * @typedef {string | null} StringNull
 *
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

  /**
   * @type {boolean}
   */
  err;

  constructor() {
    const ssh = '/root/.ssh';
    this.sshConfig = `${ssh}/config`;
    this.sshConfigDefault = path.resolve(__dirname, '../.crpack/templates/git/ssh/config');
    worker.setPackageJson(path.resolve(worker.pwd, 'package.json'));
    const { repository } = worker.packageJsonConfig;
    let origin = 'gitlab.com';
    this.err = false;
    if (repository) {
      if (!/^git@/.test(repository)) {
        this.err = true;
        console.error(
          worker.error,
          Red,
          "The repository url is not ssh. Restarting after changing Git won't work.",
          Reset
        );
      }
      const host = repository.match(/git@[a-zA-Z0-9\.\-_]+:/);
      origin = host ? host[0].replace(/git@/, '').replace(/:/g, '') : origin;
    }
    this.sshHost = origin;
    this.configExists = false;
    this.secretKeyPath = `${ssh}/${this.sshHost.replace(/\.\w+/, '')}`;
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
    console.warn(
      worker.warning,
      Yellow,
      Dim,
      "Don't forgot move secret key file to specified catalog with the same name",
      Reset
    );
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
   * @returns {Promise<Result>}
   */
  async create() {
    if (this.err) {
      return 1;
    }
    // set config
    worker.setPackageJson(worker.configPath);
    const config = this.changeConfig();
    if (!this.configExists) {
      worker.createDir([
        `${this.sshConfig.replace(/\/.ssh\/config$/, '')}`,
        `${this.sshConfig.replace(/\/config$/, '')}`,
      ]);
    }
    const writeRes = worker.writeFile(this.sshConfig, this.stringigyConfig(config));
    if (writeRes === 1) {
      return 1;
    }

    // get repository
    const { repository } = worker.packageJsonConfig;
    if (!repository) {
      console.error(worker.error, Red, 'Repository is not specified in package.json', Reset);
      return 1;
    }

    // cron
    const cron = await this.createCron();
    if (cron === 1) {
      return 1;
    }
    return 0;
  }

  /**
   * @returns {ResultString}
   */
  searchCronConfig() {
    const cronRoot = '/etc/cron.d/';
    const cronDir = worker.readDir(cronRoot);
    if (cronDir === 1) {
      return 1;
    }

    const { name } = worker.packageJsonConfig;
    worker.packageName = name;

    const theSame = cronDir
      .map((item) => {
        if (item === name) {
          return item;
        }
      })
      .filter((item) => (item ? item : undefined))[0];
    if (!theSame) {
      return path.resolve(cronRoot, name);
    }
    return path.resolve(cronRoot, theSame);
  }

  /**
   * @returns {Promise<Result>}
   */
  async createCron() {
    await worker.setNpmPath();
    const cronPath = this.searchCronConfig();
    if (cronPath === 1) {
      return 1;
    }

    if (!worker.fileExists(cronPath)) {
      const cronDirD = cronPath.replace(new RegExp(worker.packageJsonConfig.name), '');
      if (!worker.fileExists(cronDirD)) {
        console.error(
          worker.error,
          Red,
          'Cron config dir is not exists',
          Reset,
          Bright,
          cronDirD,
          Reset
        );
        return 1;
      }

      const defaultCron = path.resolve(__dirname, '../.crpack/templates/git/cron/package');
      const defData = worker.readFile(defaultCron);
      if (defData === 1) {
        return 1;
      }
      const readRes = worker.writeFile(cronPath, defData);
      if (readRes === 1) {
        return 1;
      }
    } else if (worker.traceWarnings) {
      console.warn(worker.warning, Yellow, Dim, 'Make sure that crond is running', Reset);
    }

    const lines = await worker.readByLines(cronPath, (data) => {
      let line = data.toString();
      let _line = line;
      if (/PATH/.test(line)) {
        _line = new RegExp(worker.npmPath).test(line) ? line : `${line}:${worker.npmPath}`;
      } else if (/PROJECT_ROOT/.test(line)) {
        _line = `PROJECT_ROOT=${worker.pwd}`;
      }
      return `${_line}\n`;
    });
    if (lines === 1) {
      return 1;
    }

    const writeRes = worker.writeFile(cronPath, lines);
    if (writeRes === 1) {
      return 1;
    }
    console.info(worker.info, 'Cron file saved', Blue, cronPath, Reset);

    return 0;
  }

  /**
   *
   * @param {string} repository
   * @returns {Promise<Result>}
   */
  async update(repository) {
    const npmPath = await worker.setNpmPath();
    if (npmPath === 1) {
      return 1;
    }

    /**
     * @type {NumberBoolean}
     */
    const compareRes = await this.compareCommits(repository);
    if (compareRes === 1) {
      return 1;
    }

    let diff = false;
    if (typeof compareRes === 'boolean') {
      diff = !compareRes;
    }
    if (diff) {
      const pullRes = await worker.pull(repository, 'master');
      if (pullRes === 1) {
        return 1;
      }

      const installRes = await worker.installDependencies();
      if (installRes === 1) {
        return 1;
      }

      await worker.wait(2000);

      const buildPackage = await worker.buildPackage();
      if (buildPackage === 1) {
        return;
      }

      await worker.wait(4000);

      const packageJsonConfig = worker.setPackageJson(path.resolve(worker.pwd, 'package.json'));
      if (packageJsonConfig === 1) {
        return 1;
      }

      const restartRes = await worker.restartService();
      if (restartRes === 1) {
        return 1;
      }
    }
    return 0;
  }

  /**
   * @param {string} repository
   * @returns {Promise<NumberBoolean>}
   */
  async compareCommits(repository) {
    const gitRes = await worker.getSpawn({
      command: 'git',
      args: ['ls-remote', repository],
    });
    if (gitRes === 1) {
      return 1;
    }
    /**
     * @type {StringNull}
     */
    let head = null;
    const headRegex = /^[a-zA-Z0-9]+/;
    if (gitRes) {
      const headReg = gitRes.match(headRegex);
      head = headReg[0] || null;
    }
    if (!head) {
      console.warn(worker.warning, Yellow, 'Cant get head of last commit', Reset);
      return 1;
    }

    const gitLocal = await worker.getSpawn({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      options: {
        cwd: worker.pwd,
      },
    });
    if (gitLocal === 1) {
      return 1;
    }
    let localHead = null;
    if (gitLocal) {
      const localHeadReg = gitLocal.match(headRegex);
      localHead = localHeadReg[0] || null;
    }
    if (!localHead) {
      console.warn(worker.warning, Yellow, 'Cant get head of last local commit', Reset);
      return 1;
    }
    return localHead === head;
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
