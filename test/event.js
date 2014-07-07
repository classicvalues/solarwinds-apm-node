var Emitter = require('events').EventEmitter
var should = require('should')
var dgram = require('dgram')

var oboe = require('..')
var addon = oboe.addon
var Event = oboe.Event

describe('event', function () {
  var server = dgram.createSocket('udp4')
  var emitter = new Emitter
  var event

  before(function (done) {
    emitter.on('error', server.close.bind(server))

    server.on('message', emitter.emit.bind(emitter, 'message'))
    server.on('error', emitter.emit.bind(emitter, 'error'))
    server.on('listening', done)

    server.bind(5432)

    // Connect to test server
    oboe.reporter = new addon.UdpReporter('127.0.0.1', 5432)
  })

  after(function (done) {
    server.on('close', done)
    server.close()
  })

  it('should construct valid event', function () {
    event = new Event('test', 'entry')
    event.should.have.property('Layer', 'test')
    event.should.have.property('Label', 'entry')
    event.should.have.property('taskId').and.not.match(/^0*$/)
    event.should.have.property('opId').and.not.match(/^0*$/)
  })

  it('should enter the event context', function () {
    var context = addon.Context.toString()
    event.enter()
    addon.Context.toString().should.not.equal(context)
  })

  it('should send the event', function (done) {
    var event2 = new Event('test', 'exit', event.event)

    emitter.on('message', function (msg) {
      msg = msg.toString()
      msg.should.match(new RegExp('X-Trace\\W*' + event2))
      msg.should.match(new RegExp('Edge\\W*' + event.opId))
      msg.should.match(/Layer\W*test/)
      msg.should.match(/Label\W*exit/)
      done()
    })

    // NOTE: events must be sent within a request store context
    oboe.requestStore.run(function () {
      event2.send()
    })
  })
})
