
var fs = require ('graceful-fs');
var path = require ('path');
var surveil = require ('./index');

var YEPNOPE_TIMEOUT = 100;
function yepnope (callback) {
    this.callback = callback;
}
yepnope.prototype.yep = function(){
    var self = this;
    this.timeout = setTimeout (function(){
        if (!self.callback)
            return;
        self.callback();
        self.callback = undefined;
    }, YEPNOPE_TIMEOUT);
};
yepnope.prototype.nope = function (err) {
    if (!this.callback)
        return;
    clearTimeout (this.timeout);
    this.callback (err || new Error ('nope'));
    this.callback = undefined;
};

try {
    fs.mkdirSync ('test');
} catch (err) {
    if (err.code != 'EEXIST')
        throw err;
}
fs.readdirSync ('test').forEach (function (fname) { fs.unlinkSync ('test/'+fname); });

describe ('existing directory', function(){

    it ('watches and emits "ready" event', function (callback) {

        try {
            var test = surveil ('test');
            test.on ('ready', function (err) {
                try {
                    test.close();
                } catch (closeErr) {
                    return callback (err || closeErr);
                }
                callback();
            });
        } catch (err) {
            callback (err);
        }

    });

    it ('emits the "add" event', function (callback) {

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        test.on ('add', function (newName) {
            if (newName != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+newName));
            yip.yep();
        });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });
        test.on ('change', function (fname) { yip.nope (new Error (
            'unwanted event change: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.writeFileSync ('test/foo.txt', 'double triple quadruple quintuple sextuple septuple octuple');
        });

    });

    it ('emits the "remove" event', function (callback) {

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        test.on ('remove', function (fname) {
            if (fname != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            yip.yep();
        });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('change', function (fname) { yip.nope (new Error (
            'unwanted event change: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.unlinkSync ('test/foo.txt');
        });

    });

    it ('emits the "change" event only once when writing several chunks', function (callback) {

        fs.writeFileSync ('test/foo.txt', 'double triple quadruple quintuple sextuple septuple octuple');

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var changed = false;
        test.on ('change', function (fname) {
            if (fname != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (changed)
                return yip.nope (new Error ('repeat event change: '+fname));
            changed = true;
            yip.yep();
        });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.createWriteStream ('test/foo.txt', function (err, stream) {
                if (err)
                    return yip.nope (err);

                var blocks = [
                    'double',
                    'triple',
                    'quadruple',
                    'quintuple',
                    'sextuple',
                    'septuple',
                    'octuple'
                ];
                function writeToStream(){
                    var data = blocks.shift();
                    if (!data)
                        return;
                    for (var i=5; i; i--)
                        data += data;
                    stream.write (data);
                    setTimeout (writeToStream, 30);
                }
                writeToStream();
            });
        });

    });

    it ('does not emit "change" events during early file creation', function (callback) {

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var added = false;
        test.on ('add', function (fname) {
            if (fname != 'bar.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (added)
                return yip.nope (new Error ('repeat event add: '+fname));
            added = true;
            yip.yep();
        });
        test.on ('change', function (fname) { yip.nope (new Error (
            'unwanted event change: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.createWriteStream ('test/bar.txt', function (err, stream) {
                if (err)
                    return yip.nope (err);

                var blocks = [
                    'double',
                    'triple',
                    'quadruple',
                    'quintuple',
                    'sextuple',
                    'septuple',
                    'octuple'
                ];
                function writeToStream(){
                    var data = blocks.shift();
                    if (!data)
                        return;
                    for (var i=5; i; i--)
                        data += data;
                    stream.write (data);
                    setTimeout (writeToStream, 30);
                }
                writeToStream();
            });
        });

    });

    it ('emits "change" events for a new file', function (callback) {

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var changed = false;
        test.on ('change', function (fname) {
            if (fname != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (changed)
                return yip.nope (new Error ('repeat event change: '+fname));
            changed = true;
            yip.yep();
        });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.createWriteStream ('test/foo.txt', function (err, stream) {
                if (err)
                    return yip.nope (err);

                var blocks = [
                    'double',
                    'triple',
                    'quadruple',
                    'quintuple',
                    'sextuple',
                    'septuple',
                    'octuple'
                ];
                function writeToStream(){
                    var data = blocks.shift();
                    if (!data)
                        return;
                    for (var i=5; i; i--)
                        data += data;
                    stream.write (data);
                    setTimeout (writeToStream, 30);
                }

                fs.writeFileSync ('test/foo.txt', 'double triple quadruple quintuple sextuple septuple octuple');
                setTimeout (writeToStream, 300);
            });
        });

    });

    it ('emits "change" events for a file that disappeared and reappeared', function (callback) {

        fs.writeFileSync ('test/foo.txt', 'double triple quadruple quintuple sextuple septuple octuple');

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var changed = false;
        test.on ('change', function (fname) {
            if (fname != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (changed)
                return yip.nope (new Error ('repeat event change: '+fname));
            changed = true;
            yip.yep();
        });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.createWriteStream ('test/foo.txt', function (err, stream) {
                if (err)
                    return yip.nope (err);

                fs.writeFileSync ('test/foo.txt', 'able baker charlie dog easy');
                setTimeout (function(){
                    fs.unlinkSync ('test/foo.txt');
                    setTimeout (function(){
                        fs.writeFileSync ('test/foo.txt', 'able baker charlie dog easy');
                    }, 350);
                }, 350);
            });
        });

    });

    it ('emits "add" and "remove" when a file is renamed within the local directory', function (callback) {

        fs.writeFileSync ('test/foo.txt', 'double triple quadruple quintuple sextuple septuple octuple');

        try {
            var test = surveil ('test');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var added = false, removed = false;
        test.on ('add', function (fname) {
            if (fname != 'baz.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (added)
                return yip.nope (new Error ('repeat event add: '+fname));
            added = true;
            if (removed)
                yip.yep();
        });
        test.on ('remove', function (fname) {
            if (fname != 'foo.txt')
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (removed)
                return yip.nope (new Error ('repeat event remove: '+fname));
            removed = true;
            if (added)
                yip.yep();
        });
        test.on ('change', function (fname) { yip.nope (new Error (
            'unwanted event change: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.renameSync ('test/foo.txt', 'test/baz.txt');
        });

    });

});

describe ('existing file', function(){

    it ('watches and emits "ready" event', function (callback) {

        fs.writeFileSync ('test.txt', 'double triple quadruple quintuple sextuple septuple octuple');

        try {
            var test = surveil ('test.txt');
            test.on ('ready', function (err) {
                try {
                    test.close();
                } catch (closeErr) {
                    return callback (err || closeErr);
                }
                callback();
            });
        } catch (err) {
            callback (err);
        }

    });

    it ('emits one "change" event for a batch of chunk writes', function (callback) {

        try {
            var test = surveil ('test.txt');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        var changed = false;
        test.on ('change', function (fname) {
            if (fname !== undefined)
                return yip.nope (new Error ('incorrect filename: '+fname));
            if (changed)
                return yip.nope (new Error ('repeat event change: '+fname));
            changed = true;
            yip.yep();
        });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        test.on ('ready', function (err) {
            if (err)
                return yip.nope (err);
            fs.createWriteStream ('test.txt', function (err, stream) {
                if (err)
                    return yip.nope (err);

                var blocks = [
                    'double',
                    'triple',
                    'quadruple',
                    'quintuple',
                    'sextuple',
                    'septuple',
                    'octuple'
                ];
                function writeToStream(){
                    var data = blocks.shift();
                    if (!data)
                        return;
                    for (var i=5; i; i--)
                        data += data;
                    stream.write (data);
                    setTimeout (writeToStream, 30);
                }
                writeToStream();
            });
        });

    });

    it ('does not emit "remove" when the watched file is being removed', function (callback) {

        try {
            var test = surveil ('test.txt');
        } catch (err) {
            return callback (err);
        }
        var yip = new yepnope (function (err) {
            try {
                test.close();
            } catch (closeErr) {
                return callback (err || closeErr);
            }
            if (err)
                return callback (err);
            callback()
        });

        test.on ('change', function (fname) { yip.nope (new Error (
            'unwanted event change: '+fname
        )); });
        test.on ('add', function (fname) { yip.nope (new Error (
            'unwanted event add: '+fname
        )); });
        test.on ('remove', function (fname) { yip.nope (new Error (
            'unwanted event remove: '+fname
        )); });

        setTimeout (function(){
            yip.yep();
        }, 500);
        fs.unlinkSync ('test.txt');

    });

});

// describe ('missing directory', function(){

//     it ('does not emit "error" or pass an Error to "ready"', function (callback) {

//     });

//     it ('emits "add" events after appearing', function (callback) {

//     });

//     it ('emits "remove" events after appearing', function (callback) {

//     });

//     it ('emits "change" events after appearing', function (callback) {

//     });

//     it ('emits "rename" events after appearing', function (callback) {

//     });

// });

// describe ('missing file appears later', function(){

//     it ('emits "change" on file events after appearing', function (callback) {

//     });

//     it ('does not emit "remove" when being removed or renamed', function (callback) {

//     });

// });

// describe ('file or directory disappears and reappears as directory or file', function(){

//     describe ('directory reappears as a file', function(){

//         it ('does not emit an "error" event', function (callback) {

//         });

//         it ('emits "change" events as a file', function (callback) {

//         });

//         it ('does not emit an "remove" event when being removed or renamed as a file', function (callback) {

//         });

//     });

//     describe ('file reappears as a directory', function(){

//         it ('does not emit an "error" event', function (callback) {

//         });

//         it ('emits "add" events as a directory', function (callback) {

//         });

//         it ('emits "remove" events as a directory', function (callback) {

//         });

//         it ('emits "change" events as a directory', function (callback) {

//         });

//         it ('emits "rename" events as a directory', function (callback) {

//         });

//         it ('does not emit an "remove" event when being removed or renamed as a directory', function (callback) {

//         });

//     });

//     it ('survives multiple toggles in each direction', function (callback) {

//     });

// });
