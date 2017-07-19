/* Copyright 2015-present Samsung Electronics Co., Ltd. and other contributors
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


var assert = require('assert');
var SPI = require('spi');
var spi = new SPI();
var inStr = 'hi';
var outStr = '';
var i = 0;
var inArray = [0, 0, 0];
var outArray = [0, 0, 0];

for (i = 0; i < inArray.length; ++i) {
    if (inStr[i] && inArray[i] !== undefined) {
        inArray[i] = inStr.charCodeAt(i);
    }
}

var dev = spi.open({
    bus: 1
}, function (err) {
    assert(!err, 'SPI opened');
    if (!err) {
        dev.transfer(inArray, outArray, function (err) {
            assert(!err, 'SPI transfer succeeded');
            for (i = 0; i < outArray.length; ++i) {
                if (outArray[i]) {
                    outStr += String.fromCharCode(outArray[i]);
                }
            }
            assert(outStr.indexOf(inStr) > -1, 'input returned by echo device');
            dev.close();
        });
    }
});
