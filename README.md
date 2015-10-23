surveil
=======
Watches a directory for new files and deletions, attempting to delay events until initial file creation is complete. 
Watches files in the directory for changes. Ignores subdirectories entirely.

Installation
------------
```shell
$ npm install surveil
```

Usage
-----
```javascript
var path = require ('path');
var surveil = require ('surveil');
var subjectDir = surveil (
  path.resolve (
    process.cwd(),
    "super/secret/files/"
  ),
  // options argument is optional
  {
    /*
      `change` events closer together than
      this are grouped into one. Implies a 
      minimum latency to `change` events
      being fired.
    */
    changeTimeout:  150
  }
);
subjectDir.on ('ready', function (spy, err) {
  // spy === subjectDir
  // if present, the `err` argument will also 
  // trigger an `error` event
});
subjectDir.on ('add', function (filename) {
  // a new file has been added and the initial 
  // content write operation appears to have 
  // concluded.
});
subjectDir.on ('remove', function (filename) {
  // a file has been removed.
});
subjectDir.on ('rename', function (oldFName, newFName) {
  // a file has been renamed.
});
subjectDir.on ('change', function (filename) {
  // a file change event or rapid group of 
  // such events has just occured.
});
```

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
