
events = require('events')
http   = require('http')

WebSocket = require('ws')

class WebSocketServer extends events.EventEmitter

    REQUEST_ID = 0

    CLIENT_ID = 0

    clients = {}
    requests = {}

    constructor: ->

    listen: (port) ->
        app = (req, res) -> res.writeHead(200); res.end('All glory to Websockets!')
        server = http.createServer(app).listen(port)
        wss = new WebSocket.Server(server: server)
        wss.on('connection', (client) =>
            client.id = ++CLIENT_ID
            clients[client.id] = client
            client.on('message', (message) =>
                message = JSON.parse(message)
                if message.topic is 'response'
                    if message.payload.requestId?
                        return @emit('error', new Error("no request listener for response: #{message.payload.requestId}")) unless requests[message.payload.requestId]
                        requests[message.payload.requestId]?(message.payload.err, message.payload.data)
                        delete requests[message.payload.requestId]
                    else
                        @emit('error', new Error("ignoring response without requestId: #{message.payload}"))
                else
                    message.payload.clientId = client.id # TODO: fix this hack
                    @emit(message.topic, message.payload, client)
            )
            client.on('close', =>
                @emit('disconnect')
                @emit('clientDisconnect', clientId: client.id)
            )
            client.on('error', (err) =>
                @emit('error', err)
                @emit('disconnect')
            )
            @emit('clientConnect', id: client.id)
        )

    disconnectClient: (clientId) ->
        client = clients[clientId]
        return @emit('error', new Error("no such client: #{clientId}")) unless client
        client.close()

    request: (clientId, request, callback) ->
        client = clients[clientId]
        return @emit('error', new Error("no such client: #{clientId}")) unless client
        request.requestId = REQUEST_ID++
        requests[request.requestId] = callback
        # TODO incorporate puback here for err-only callbacks?
        client.send(JSON.stringify(topic: 'request', payload: request))

    respond: (clientId, requestId, err, data) ->
        client = clients[clientId]
        return @emit('error', new Error("no such client: #{clientId}")) unless client
        response = { requestId, err, data }
        client.send(JSON.stringify(topic: 'response', payload: response))

    send: (clientId, topic, message) ->
        client = clients[clientId]
        return @emit('error', new Error("no such client: #{clientId}")) unless client
        client.send(JSON.stringify(topic: topic, payload: message))

class WebSocketClient extends events.EventEmitter

    REQUEST_ID = 0

    client = null
    requests = {}

    constructor: ->

    connect: (port, host) ->
        client = new WebSocket("wss://#{host}:#{port}")
        client.on('open', =>
            @emit('connect')
        )
        client.on('message', (message) =>
            message = JSON.parse(message)
            if message.topic is 'response'
                if message.payload.requestId?
                    return @emit('error', new Error("no request listener for response: #{message.payload.requestId}")) unless requests[message.payload.requestId]
                    requests[message.payload.requestId]?(message.payload.err, message.payload.data)
                    delete requests[message.payload.requestId]
                else
                    @emit('error', new Error("ignoring response without requestId: #{message.payload}"))
            else
                @emit(message.topic, message.payload)
        )
        client.on('close', =>
            @emit('disconnect')
        )
        client.on('error', (err) =>
            @emit('error', err)
            @emit('disconnect')
        )

    request: (request, callback) ->
        return @emit('error', new Error('no connection to server')) unless client
        request.requestId = REQUEST_ID++
        requests[request.requestId] = callback
        client.send(JSON.stringify(topic: 'request', payload: request))

    respond: (requestId, err, data) ->
        return @emit('error', new Error('no connection to server')) unless client
        response = { requestId, err, data }
        client.send(JSON.stringify(topic: 'response', payload: response))

    send: (topic, payload) ->
        return @emit('error', new Error('no connection to server')) unless client
        client.send(JSON.stringify(topic: topic, payload: payload))

    ping: (payload) ->
        return @emit('error', new Error('no connection to server')) unless client
        client.ping(JSON.stringify(payload: payload), {}, true || 'dontFailWhenClosed')

module.exports = {
    WebSocketServer
    WebSocketClient
}

