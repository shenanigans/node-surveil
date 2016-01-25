surveil
=======
Watches a directory for new files and deletions, attempting to delay events until initial file
creation is complete. Watches files in the directory for changes. Separates events for child files
and directories. Also watches single files and doesn't require an alternate API to do so. Behaves
gracefully when the watched path does not exist yet, emitting `add` with no filename when it
appears.

Shares `stat` calls gathered during early setup so you don't have to duplicate any work `surveil` is
already doing. This sort of efficiency trick can pay big dividends when querying against spinning
rust.


Why
---
I tried a bunch of existing libs and they all exhibited blocking issues when faced with directories
containing lots of files. On source examination I found a lot of use of `fs.statSync` and other
`Sync` calls. This quickly made me disatisfied with the state of the art in Node.js file watching
at the time. Surveil is **much** more performant in adverse conditions. While most watcher libs are
designed to support task runners and other applications that can take their time starting up,
surveil **never** assumes the caller doesn't care how long something blocks. Finally, because
surveil was designed on windows and later tested for *nix it boasts (I am boasting, aren't I?)
superior cross-platform reliability.


Installation
------------
```shell
$ npm install surveil
```


Running Tests
-------------
```shell
$ npm test
```

Coming soon - run tests against your custom timeout settings.


Usage
-----
```javascript
var path = require ('path');
var surveil = require ('surveil');

var subjectDir = surveil (
  "super/secret/files/",
  { // options argument is optional - defaults shown
    /*
      `change` events closer together than
      this are grouped into one. Implies a
      minimum latency to `change` events
      being fired. (in milliseconds)
    */
    changeTimeout:          150,
    /*
      Number of times to retry establishing
      a file watch when receiving the
      `EPERM` event from the filesystem.
    */
    epermRetries:           5,
    /*
      Proper support for missing path
      features hasn't landed yet. For now a
      simple poll timeout is used to test
      the surveil'd path. (in milliseconds)
    */
    hack_missingPoll:       1000,
    /*
      Only accept files with names ending
      in one of the provided extensions.
      If the period is required you must
      specify it. Directories are not
      affected by filename filters.
      Default: undefined
    */
    extensions:             [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif"
    ],
    /*
      Only accept files with names
      matching at least one of the
      provided regular expressions. Does
      not apply when `extensions` is set.
      Directories are not affected by
      filename filters.
      Default: undefined
    */
    patterns:               [
      /report/,
      /sallary/,
      /\.xls$/
    ]
  }
);

subjectDir.on ('ready', function (spy, err) {
  // spy === subjectDir
  // if present, the `err` argument will also
  // trigger an `error` event
});

subjectDir.on ('child', function (filename, stats) {
  // shares the `stat` call used to discover files
  // filename must match any filters present
  // only emitted before the "ready" event has fired
});

subjectDir.on ('childDir', function (dirname, stats) {
  // shares the `stat` call used to discover directories
  // dirname may not match any filters present
  // only emitted before the "ready" event has fired
});

subjectDir.on ('add', function (filename, stats) {
  // a new file has been added and the initial
  // content write operation appears to have
  // concluded.
  // If filename filters are present, filename will
  // conform to them.
});

subjectDir.on ('addDir', function (dirname, stats) {
  // a new subdirectory has appeared
  // it may not conform to any filename filters present
});

subjectDir.on ('remove', function (filename) {
  // a file has been removed.
});

subjectDir.on ('change', function (filename) {
  // a file change event or rapid group of
  // such events has just occured.
  // no new stat call is made, therefor none is shared
});
```

If the provided path does not exist yet, you will receive an `add` event with no `filename` argument
each time it appears. `surveil` will then gracefully watch the path whenever it exists.


LICENSE
-------
The MIT License (MIT)

Copyright (c) 2015 Kevin "Schmidty" Smith

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
