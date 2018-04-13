'use strict'

const debug = require('debug')
const tty = require('tty')
const util = require('util')
require('./log-formatters')

// allow different handling if this is not a tty
let isatty = tty.isatty(process.stdout.fd || tty.isatty(process.stderr.fd))
exports.isatty = isatty

let toMemory = false

exports.logToMemory = function (onOff) {
  if (onOff === 'on' && !toMemory) {
    var logbuf = Buffer.alloc(1000000, 0, 'utf8')
    var bufpos = 0

    // tell debug to use this function, not the default console function
    debug.log = function (...args) {
      args.forEach(arg => {
        if (arg === undefined) return
        let text = arg.toString() + '\n'
        bufpos += logbuf.write(text, bufpos)

      })
    }

    exports._buffer = {
      getString: function () {
        return logbuf.toString('utf8', 0, bufpos)
      },
      clear: function () {
        bufpos = 0
      },
      write: function (text) {
        if (!text) return
        bufpos += logbuf.write(text + '\n', bufpos)
      },
      status: function () {
        return { count: bufpos, buffer: logbuf }
      },
      getPosition: function () {
        return bufpos
      },
      setPosition: function (position) {
        bufpos = position
      }
    }
    toMemory = true
    // return previous value
    return 'off'
  } else if (onOff === 'off' && toMemory) {
    exports._buffer = {
      getString: function () { },
      clear: function () { },
      write: function () { },
      status: function () { return {} },
      getPosition: function () { return 0 },
      setPosition: function () { }
    }
    toMemory = false
    // return previous state
    return 'on'
  } else {
    // invalid setting or already at setting; return current state
    return toMemory ? 'on' : 'off'
  }

}

// all output can be disabled, except for forced logging
var enabled = true

Object.defineProperty(exports, 'enabled', {
  get () {return enabled},
  set (value) {
    enabled = !!value
  }
})

//
// forced output is logged whether enabled or not (but
// the environment still must be set for it).
//
exports.force = {
  flow: debug('appoptics:flow'),
  state: debug('appoptics:state'),
  oboe: debug('appoptics:oboe'),
  metadata: debug('appoptics:metadata'),
  span: debug('appoptics:span'),
  info: debug('appoptics:info'),
  status: debug('appoptics:status'),
  settings: debug('appoptics:settings')
}
//
// Expose the forced loggers at the top level where they are wrapped so
// enabled must be true for them to be output.
//
var wrap = function (fn) {return function () {enabled && fn.apply(fn, arguments)}}

Object.keys(exports.force).forEach(function (key) {
  exports[key] = wrap(exports.force[key])
})

//
// always log errors and info when set, no need to force
//
exports.error = debug('appoptics:error')        // used for unexpected errors
exports.force.error = exports.error
exports.warn = debug('appoptics:warn')          // warning level
exports.force.warn = exports.warn
exports.debug = debug('appoptics:debug')        // no need to force.
exports.force.debug = exports.debug

//
// always log, even if no 'appoptics:' settings at all.
//
var always = function () {console.log('appoptics:always', ...arguments)}
exports.always = always                               // log whether enabled or not (using console.log)
var ifNotTTY = function () {!isatty && console.log(...arguments)}
exports.ifNotTTY = ifNotTTY

var added = {}
/**
 * Add a group for logging.
 *
 * @method addGroup
 * @param {object} def - definition of group to add.
 *
 * @return {Object} exports or undefined if an error
 *
 * def is {
 *   groupName: 'event',            // the name of the group to be added
 *   subNames: ['send', 'enter', 'change', ...]
 * }
 * 'appoptics' will be used as a prefix and loggers will be constructed for
 * each subName in the form 'appoptics:event:send', 'appoptics:event:enter', etc.
 */
exports.addGroup = function (def) {
  if (exports[def.groupName]) {
    return undefined
  }
  let g = {}
  let p = 'appoptics:' + def.groupName + ':'
  let env = process.env.DEBUG || ''

  def.subNames.forEach(function (name) {
    g[name] = wrap(debug(p + name))
    if (~env.indexOf(p + name)) {
      ao.logLevel = p + name
    }
  })
  exports[def.groupName] = g
  added[def.groupName] = true

  return exports
}

/**
 * Delete a group for logging
 */
exports.deleteGroup = function (groupName) {
  if (added[groupName]) {
    delete exports[groupName]
    delete added[groupName]
    return true
  }
  return undefined
}