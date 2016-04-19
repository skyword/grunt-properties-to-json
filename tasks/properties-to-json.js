/*
 * grunt-properties-to-json
 * http://gruntjs.com/
 * 
 * Copyright (c) 2014-2015 Jacob van Mourik, contributors
 * Licensed under the MIT license.
 * 
 * Updated by Michael Shaheen 4.20.2016 to not allow defined parents
 */

module.exports = function(grunt) {
    var parser = require('properties-parser'),
        _ = require('lodash');

    var badKeys = [];


    var isRequested = function(key, options) {
        for (var n=0; n<options.include.length; ++n) {
            if (key.indexOf(options.include[n]+options.splitKeysBy) == 0) {
                return true;
            }
        }
        return false;

    };

    var splitKeysBy = function(obj, options, src) {
        var keys, parent, result = {};
         var ary_keys = _.keys(obj);
         var okKeys = [];

        _.forEach(obj, function(val, key) {
            keys = key.split(options.splitKeysBy);
            parent = result;
            var isOK = isRequested(key, options);
               if (_.indexOf(okKeys, key) > -1) {
                    if (_.indexOf(options.suppress, key) == -1) {
                        badKeys.push({'src' : src, 'key' : key, 'msg' : 'Duplicate Key'});
                    }
               } else if (isOK && _.indexOf(okKeys, key.substring(0, key.lastIndexOf(options.splitKeysBy))) > -1) {
                    if (_.indexOf(options.suppress, key) == -1) {
                        badKeys.push({'src' : src, 'key' : key, 'msg' : 'Has defined parent'});
                    }

               } else if (isOK) {
                   okKeys.push(key);
                   keys.forEach(function(k, i) {
                         if (i === keys.length-1) {
                             parent[k] = val;
                         } else {
                             parent = parent[k] = parent[k] || {};
                         }
                    });
               }

        });
//        grunt.log.writeln(JSON.stringify(okKeys,null,2));
        if (badKeys.length > 0) {
            return null;
        }
        return result;
   };

    var filter = function(obj, regexps, include, deep) {
        return _.transform(obj, function(result, val, key) {
            var hasMatch = hasRegMatch(regexps, key);
            if ((hasMatch && include) || (!hasMatch && !include)) {
                result[key] = deep && _.isPlainObject(val) ? filter(val,regexps,include,deep) : val;
            }
        },{});
    };

    var fireErrorLog = function() {
        if (badKeys.length > 0) {
            grunt.log.error('There was an error so no properties json files were written.');
            grunt.log.error('Error list:');
            var prevSrc = '';
            badKeys.forEach(function(b) {
                if (b.src != prevSrc) {
                    grunt.log.writeln('');
                }
                prevSrc = b.src;
                grunt.log.error(b.src + ' - ' + b.key + ' - ' + b.msg);
            });
            grunt.fail.fatal('BAD PROP KEYS \nSee above list. ^^');
        }
    };

    var sortKeysBy = function (obj, comparator) {
        var keys = _.sortBy(_.keys(obj), function (key) {
            return comparator ? comparator(obj[key], key) : key;
        });

        return _.object(keys, _.map(keys, function (key) {
            return obj[key];
        }));
    };

    var toRegExps = function(value) {
        value = [].concat(value);
        return value.map(function(val) {
            return _.isRegExp(val) ? val : new RegExp(val);
        });
    };

    var hasRegMatch = function(regexps, value) {
        return regexps.some(function(regexp) {
            return regexp.test(value);
        });
    };

    var writeFile = function(data, dest) {
        grunt.file.write(dest, JSON.stringify(data), { encoding: 'utf8' });
        grunt.log.writeln('File "' + dest + '" created.');
    };

    var propertiesToJSON = function() {
        var dest, data, dataList, options = this.options();

        this.files.forEach(function(f) {
            if (options.merge) {
                if (!f.dest) {
                    return grunt.log.warn('Task skipped, no destination file is defined.');
                } else if (grunt.file.isDir(f.dest)) {
                    return grunt.log.warn('Task skipped, destination "' + f.dest + '" should be a file but is a directory.');
                }
            } else if (grunt.file.isFile(f.dest)) {
                return grunt.log.warn('Task skipped, destination "' + f.dest + '" should be a directory but is a file.');
            }

            dataList = [];

            f.src.forEach(function(src) {
                if (src.substr(-11) !== '.properties') {
                    return;
                }
                if (!grunt.file.exists(src)) {
                    return grunt.log.warn('Source file "' + src + '" not found.');
                }
                data = sortKeysBy(parser.read(src));


                if (src.indexOf('package.') > -1) {

/*
                    grunt.log.writeln('======== begin AMERICAN ENGLISH PROPS data ========');
                    //grunt.log.writeln(JSON.stringify(data,null,2));
                    grunt.log.writeln(JSON.stringify(parser.read(src),null,2));
                    grunt.log.writeln('======== end AMERICAN ENGLISH PROPS data ========');
*/

               }

                if (options.splitKeysBy) {
                    data = splitKeysBy(data, options, src);
                }
                if (options.exclude) {
                    data = filter(data, toRegExps(options.exclude), false, !!options.deepExclude);
                }
/*
                if (options.include) {
                    data = filter(data, toRegExps(options.include), true, !!options.deepInclude);
                }
*/

                if (badKeys.length <= 0) {
                    if (options.merge) {
                        dataList.push(data);
                    } else {
                        dest = f.dest ? f.dest + (_.endsWith(f.dest,'/') ? '' : '/') + src.replace(/.*\//,'') : src;
                        dest = dest.replace('.properties','.json');
                        writeFile(data, dest);
                    }
                }
            });
            fireErrorLog();
            if (options.merge) {
                writeFile(_.merge.apply(null,dataList), f.dest);
            }
        });
    };

    grunt.registerMultiTask('propertiesToJSON', 'Converts java property files to JSON files.', propertiesToJSON);

    // Deprecate old task name
    grunt.registerMultiTask('properties_to_json', 'Converts java property files to JSON files.', function() {
        grunt.log.warn('The "properties_to_json" task name is deprecated. Please use "propertiesToJSON" instead.');
        propertiesToJSON.apply(this, arguments);
    });
};
