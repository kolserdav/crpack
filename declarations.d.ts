declare class Parser {
  constructor() {}
  /**
   * Read and parse a file from the filesystem
   *
   * @param {string} fileName the path to the file
   * @param {function} [cb] a callback function. invoked with an error or a parsed config
   * @param {Object} [options] optional parse options
   * @param {boolean} [options.parseIncludes] If `true`, will resolve and include
   * referenced files' contents in the output
   * @returns {object} a parsed config if no callback is provided
   */
  readConfigFile(fileName, cb, options) {
    return {};
  }
}

module '@webantic/nginx-config-parser' {
  export default Parser;
}
