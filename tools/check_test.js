/* Copyright 2016-present Samsung Electronics Co., Ltd. and other contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require('fs');
var Runner = require('test_runner').Runner;
var Logger = require('common_js/logger').Logger;
var OptionParser = require('common_js/option_parser').OptionParser;
var util = require('common_js/util');
var EventEmitter = require('events').EventEmitter;

var root = 'test';
var parent = '..';
var watch = new util.Watch();

function Driver() {
  this.results = {
    pass: 0,
    fail: 0,
    skip: 0,
    timeout: 0,
    json: {
      bin: { text:0, total:0, data:0, bss:0, rodata:0 },
      date: new Date().toISOString(),
      tests: [],
      submodules: [],
    },
  };

  this.emitter = new EventEmitter();
  this.emitter.addListener('nextTest', function(driver, status, test) {
    var elapsedTime = ' (' + watch.delta().toFixed(2) + 's) ';

    if (driver.runner) {
      driver.runner.cleanup();
    }
    var filename = test['name'];

    driver.addTestResult(filename, status, test.reason);
    if (status == 'pass') {
      driver.results.pass++;
      driver.logger.message('PASS : ' + filename + elapsedTime, status);
    } else if (status == 'fail') {
      driver.results.fail++;
      driver.logger.message('FAIL : ' + filename + elapsedTime, status);
    } else if (status == 'skip') {
      driver.results.skip++;
      driver.logger.message('SKIP : ' + filename +
                   '   (reason : ' + test.reason + ")", status);
    } else if (status == 'timeout') {
      driver.results.timeout++;
      driver.logger.message('TIMEOUT : ' + filename + elapsedTime, status);
    }
    driver.fIdx++;
    driver.runNextTest();
  });

  this.os = process.platform ? process.platform : 'unknown-platform';
  this.board = process.iotjs ? process.iotjs.board : 'unknown-board';
  this.arch = process.arch ? process.arch : 'unknown-arch';
  this.env = 'unknown-environment';
  if (process.iotjs) {
    this.env = 'iotjs';
  } else if (process.versions && process.versions.node) {
    this.env = 'nodejs';
  }
  this.dependecies = [this.os, this.board, this.arch, this.env];

  this.root = util.absolutePath(root);
  process.chdir(this.root);

  return this;
}

Driver.prototype.addTestResult = function(name, result, output) {
  var item = {
    name: name,
    result: result
  }
  if (result !== 'pass') {
    item.output = output;
  }
  this.results.json.tests.push(item);
}

Driver.prototype.config = function() {
  var parser = new OptionParser();

  parser.addOption('start-from', "", "",
    "a test case file name where the driver starts.");
  parser.addOption('quiet', "yes|no", "yes",
    "a flag that indicates if the driver suppresses " +
    "console outputs of test case");
  parser.addOption('output-file', "", "",
    "a file name where the driver leaves output");
  parser.addOption('output-json', "", "",
    "a file name where the driver leaves JSON test results");
  parser.addOption('skip-module', "", "",
    "a module list to skip test of specific modules");
  parser.addOption('output-coverage', "yes|no", "no",
    "output coverage information");
  parser.addOption('experimental', "yes|no", "no",
    "a flag that indicates if tests for experimental are needed");
  parser.addOption('default-timeout', "", 240,
    "the default timeout in seconds");
  parser.addOption('dependencies', "dep1,dep2,dep3...", "",
    "list of dependecies which are met in this test run");

  var options = parser.parse();

  if (options == null) {
    parser.printHelp();
    return false;
  }

  var output = options['output-file'];
  if (output) {
    if (this.os == 'nuttx') {
      var path = util.join('/mnt/sdcard', output);
    } else if (this.os == 'tizenrt') {
      var path = util.join('/mnt', output);
    } else {
      var path = util.join(this.root, '..', output);
    }
    console.log('Storing test results in:', path);
    fs.writeFileSync(path, new Buffer(''));
  }
  var skipModule = options['skip-module'];
  if (skipModule) {
    this.skipModule = skipModule.split(',');
  }

  var experimental = options['experimental'];
  if (experimental == 'no') {
    this.stability = 'stable';
  } else {
    this.stability = 'experimental';
  }

  var dependecies = options['dependencies'];
  if (dependecies) {
    this.dependecies = this.dependecies.concat(dependecies.split(','));
  }

  this.logger = new Logger(path);

  this.options = options;

  var testfile = util.join(this.root, 'testsets.json');
  var testsets = fs.readFileSync(testfile).toString();

  this.tests = JSON.parse(testsets);

  this.dIdx = 0;
  this.dLength = Object.keys(this.tests).length;

  var skipped = this.skipTestSet(options['start-from']);

  this.nextTestSet(skipped);
  return true;
};

Driver.prototype.runNextTest = function() {
  if (this.dIdx == this.dLength) {
    this.finish();
  } else {
    if (this.fIdx == this.fLength) {
      this.dIdx++;
      if (this.dIdx == this.dLength) {
        this.finish();
      } else {
        this.nextTestSet();
        this.runNextTest();
      }
    } else {
      this.runner = new Runner(this);
      this.runner.run();
    }
  }
};

Driver.prototype.skipTestSet = function(filename) {
  if (!filename)
    return false;

  var dLength = this.dLength;
  for (var dIdx = 0; dIdx < dLength; dIdx++) {
    var dirname = Object.keys(this.tests)[dIdx];
    var dir = this.tests[dirname];
    var fLength = dir.length;
    for (var fIdx = 0; fIdx < fLength; fIdx++) {
      if (dir[fIdx]['name'] == filename) {
        this.fIdx = fIdx;
        this.dIdx = dIdx;
        return true;
      }
    }
  }

  return false;
};

Driver.prototype.nextTestSet = function(skipped) {
  if (!skipped) {
    this.fIdx = 0;
  }

  var dirname = this.dirname();
  this.fLength = this.tests[dirname].length;
  this.logger.message("\n");
  this.logger.message(">>>> " + dirname, "summary");
};

Driver.prototype.dirname = function() {
  return Object.keys(this.tests)[this.dIdx]
};

Driver.prototype.currentTest = function() {
  var dirname = this.dirname();
  return this.tests[dirname][this.fIdx];
};

Driver.prototype.test = function() {
  var test = this.currentTest();
  var dirname = this.dirname();
  var testfile = util.absolutePath(util.join(dirname, test['name']));

  return fs.readFileSync(testfile).toString();
};

Driver.prototype.finish = function() {

  if (this.options['output-json'] !== '') {
    console.log('storing test result to', this.options['output-json'])
    fs.writeFileSync(this.options['output-json'],
                     Buffer(JSON.stringify(this.results.json)));
  }

  this.logger.message('\n\nfinish all tests', this.logger.status.summary);

  this.logger.message('PASS : ' + this.results.pass, this.logger.status.pass);
  this.logger.message('FAIL : ' + this.results.fail, this.logger.status.fail);
  this.logger.message('TIMEOUT : ' +
    this.results.timeout, this.logger.status.timeout);
  this.logger.message('SKIP : ' + this.results.skip, this.logger.status.skip);

  if (this.options["output-coverage"] == "yes"
      && typeof __coverage__ !== "undefined") {
    data = JSON.stringify(__coverage__);

    if (!fs.existsSync("../.coverage_output/")) {
        fs.mkdirSync("../.coverage_output/");
    }

    fs.writeFileSync("../.coverage_output/js_coverage.data", Buffer(data));
  }
  else if (this.results.fail > 0 || this.results.timeout > 0) {
    originalExit(1);
  }

  originalExit(0);
};

var driver = new Driver();

var originalExit = process.exit;
process.exit = function(code) {
  // this function is called when the following happens.
  // 1. the test case is finished normally.
  // 2. assertion inside the callback function is failed.
  var should_fail = driver.runner.test['expected-failure'];
  try {
    process.emitExit(code);
  } catch(e) {
    // when assertion inside the process.on('exit', function { ... }) is failed,
    // this procedure is executed.
    process.removeAllListeners('exit');

    if (should_fail) {
      driver.runner.finish('pass');
    } else {
      console.error(e);

      driver.test.reason = '' + e;
      driver.runner.finish('fail');
    }
  } finally {
    process.removeAllListeners('exit');

    if (code != 0 && !should_fail) {
      driver.runner.finish('fail');
    } else if (code == 0 && should_fail) {
      driver.runner.finish('fail');
    } else {
      driver.runner.finish('pass');
    }
  }
};

var conf = driver.config();
if (conf) {
  watch.delta();
  driver.runNextTest();
}
