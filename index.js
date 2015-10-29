
var EventEmitter = require ('events').EventEmitter;
var path = require ('path');
var fs = require ('graceful-fs');
var util = require ('util');

/**     @module/Function surveil

*/

function mergeOptions (able, baker) {
    var ableKeys = Object.keys (able);
    for (var i=0,j=ableKeys.length; i<j; i++) {
        var key = ableKeys[i];
        baker[key] = able[key];
    }
    return baker;
}

var DEFAULT_OPTIONS = {
    changeTimeout:          150,
    epermRetries:           5,
    maxStatsInFlight:       64,
    epermEasing:            300,
    hack_missingPoll:       1000
};

module.exports = function (path, options) {
    return new Spy (path, options);
};

/**     @module/class spy

*/
function Spy (dir, options) {
    EventEmitter.call (this);
    this.dir = dir;
    var opts = mergeOptions (DEFAULT_OPTIONS, {});
    if (options)
        mergeOptions (options, opts);
    this.options = opts;
    this.watches = {};
    this.timeouts = {};
    this.children = {};
    this.renameCandidates = [];
    this.ready = false;
    this.exists = false;
    this.isFile = false;

    this.update();
}
util.inherits (Spy, EventEmitter);

Spy.prototype.update = function(){
    // only one concurrent call to update need exist
    if (this.isUpdating) {
        this.doUpdateAgain = true;
        return;
    }
    this.isUpdating = true;

    if (!this.mainWatcher) try {
        this.mainWatcher = fs.watch (this.dir, function (event, filename) {
            if (event == 'rename' || (filename && !Object.hasOwnProperty.call (self.children, filename)))
                self.update();
            if (!self.isFile)
                return;
            if (event == 'rename')
                return;
            // when the main target is a file, emit change events as a file
            if (Object.hasOwnProperty.call (self.timeouts, '')) {
                var oldJob = self.timeouts[self.dir];
                clearTimeout (oldJob[0]);
                oldJob[0] = setTimeout (oldJob[1], self.options.changeTimeout);
                return;
            }
            function emitChangeEvent(){
                self.emit ('change', undefined);
                delete self.timeouts[''];
            }
            self.timeouts[''] = [
                setTimeout (emitChangeEvent, self.options.changeTimeout),
                emitChangeEvent
            ];
        });
        this.exists = true;
    } catch (err) {
        this.isUpdating = false;
        if (err.code != 'ENOENT')
            throw err;
        // path doesn't exist right now - wait for it.
        if (Object.hasOwnProperty.call (self.timeouts, '')) {
            clearTimeout (self.timeouts[''][0]);
            delete self.timeouts[''];
        }
        this.setupParentWatcher();
        if (!this.ready) {
            this.ready = true;
            this.emit ('ready');
        }
        if (this.doUpdateAgain) {
            this.doUpdateAgain = false;
            this.update();
        }
        return;
    }

    var self = this;
    fs.readdir (this.dir, function (err, fnames) {
        if (err) {
            self.isUpdating = false;
            if (err.code == 'ENOENT') {
                self.exists = false;
                if (self.mainWatcher)
                    self.mainWatcher.close();
                if (Object.hasOwnProperty.call (self.timeouts, '')) {
                    clearTimeout (self.timeouts[''][0]);
                    delete self.timeouts[''];
                }
            } else if (err.code == 'ENOTDIR') {
                // not a directory
                self.isFile = true;
                self.exists = true;
            } else {
                // unknown error
                self.emit ('error', err);
                self.exists = false;
                if (!self.ready) {
                    self.ready = true;
                    self.emit ('ready', err);
                }
            }
            if (!self.ready) {
                self.ready = true;
                self.emit ('ready');
            }
            if (self.doUpdateAgain) {
                self.doUpdateAgain = false;
                self.update();
            }
            return;
        }

        self.isFile = false;
        var added, dropped;
        var childMap = {};
        for (var i=0,j=fnames.length; i<j; i++)
            childMap[fnames[i]] = true;
        if (!self.ready) {
            added = fnames;
            dropped = [];
        } else {
            added = [];
            dropped = [];
            for (var key in childMap)
                if (!Object.hasOwnProperty.call (self.children, key))
                    added.push (key);
            for (var key in self.children)
                if (!Object.hasOwnProperty.call (childMap, key))
                    dropped.push (key);
        }
        self.children = childMap;

        for (var i=0,j=dropped.length; i<j; i++) {
            var fname = dropped[i];
            self.emit ('remove', fname);
            if (Object.hasOwnProperty.call (self.timeouts, fname)) {
                clearTimeout (self.timeouts[fname][0]);
                delete self.timeouts[fname];
            }
        }


        if (!added.length) {
            if (!self.ready) {
                self.ready = true;
                self.emit ('ready');
            }
            self.isUpdating = false;
            if (self.doUpdateAgain) {
                self.doUpdateAgain = false;
                self.update();
            }
            return;
        }

        if (self.ready)
            added.forEach (function (fname) {
                function emitAddEvent(){
                    self.emit ('add', fname);
                    delete self.timeouts[fname];
                }
                self.timeouts[fname] = [
                    setTimeout (emitAddEvent, self.options.changeTimeout),
                    emitAddEvent
                ];
            });
        var fileI = 0, fileJ=added.length;
        var epermRetries = self.options.epermRetries;
        ( function watchNextNewFile(){
            if (self.closed)
                return;
            var fname = added[fileI];

            try {
                self.watches[fname] = fs.watch (path.join (self.dir, fname), function (event, eventFname) {
                    if (event == 'rename') {
                        self.update();
                        return;
                    }

                    if (Object.hasOwnProperty.call (self.timeouts, fname)) {
                        var oldJob = self.timeouts[fname];
                        clearTimeout (oldJob[0]);
                        oldJob[0] = setTimeout (oldJob[1], self.options.changeTimeout);
                        return;
                    }
                    function emitChangeEvent(){
                        self.emit ('change', fname);
                        delete self.timeouts[fname];
                    }
                    self.timeouts[fname] = [
                        setTimeout (emitChangeEvent, self.options.changeTimeout),
                        emitChangeEvent
                    ];
                });
            } catch (err) {
                if (err.code == 'EPERM') {
                    // eperm retry time...
                    if (epermRetries--)
                        return setTimeout (watchNextNewFile, self.options.epermEasing);

                    // eperm retries failed
                    self.isUpdating = false;
                    return self.update();
                }
            }

            if (fileI<fileJ) {
                fileI++;
                epermRetries = self.options.epermRetries;
                setImmediate (watchNextNewFile);
                return;
            }

            self.isUpdating = false;
            if (!self.ready) {
                self.ready = true;
                self.emit ('ready');
            }
            if (self.doUpdateAgain) {
                self.doUpdateAgain = false;
                self.update();
            }
        } )();
    });
};

Spy.prototype.setupParentWatcher = function(){
    // we're assuming this.dir is missing
    // drill toward root until we find solid ground


    // TODO write this part properly
    // tempfix just polls

    var self = this;
    setTimeout (function(){ self.update(); }, self.options.hack_missingPoll);
};

Spy.prototype.close = function(){
    this.closed = true;
    if (this.mainWatcher) {
        this.mainWatcher.close();
        this.mainWatcher = undefined;
    }
    if (this.parentWatcher) {
        parentWatcher.close();
        this.parentWatcher = undefined;
    }
    for (var key in this.watches)
        this.watches[key].close();
    this.watches = {};
};
