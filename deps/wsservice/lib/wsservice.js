// Generated by CoffeeScript 1.4.0
(function() {
  var WebSocket, WebSocketClient, WebSocketServer, events, http,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  events = require('events');

  http = require('http');

  WebSocket = require('ws');

  WebSocketServer = (function(_super) {
    var CLIENT_ID, REQUEST_ID, clients, requests;

    __extends(WebSocketServer, _super);

    REQUEST_ID = 0;

    CLIENT_ID = 0;

    clients = {};

    requests = {};

    function WebSocketServer() {}

    WebSocketServer.prototype.listen = function(port) {
      var app, server, wss,
        _this = this;
      app = function(req, res) {
        res.writeHead(200);
        return res.end('All glory to Websockets!');
      };
      server = http.createServer(app).listen(port);
      wss = new WebSocket.Server({
        server: server
      });
      return wss.on('connection', function(client) {
        client.id = ++CLIENT_ID;
        clients[client.id] = client;
        client.on('message', function(message) {
          var _name;
          message = JSON.parse(message);
          if (message.topic === 'response') {
            if (message.payload.requestId != null) {
              if (!requests[message.payload.requestId]) {
                return _this.emit('error', new Error("no request listener for response: " + message.payload.requestId));
              }
              if (typeof requests[_name = message.payload.requestId] === "function") {
                requests[_name](message.payload.err, message.payload.data);
              }
              return delete requests[message.payload.requestId];
            } else {
              return _this.emit('error', new Error("ignoring response without requestId: " + message.payload));
            }
          } else {
            message.payload.clientId = client.id;
            return _this.emit(message.topic, message.payload, client);
          }
        });
        client.on('close', function() {
          _this.emit('disconnect');
          return _this.emit('clientDisconnect', {
            clientId: client.id
          });
        });
        client.on('error', function(err) {
          _this.emit('error', err);
          return _this.emit('disconnect');
        });
        return _this.emit('clientConnect', {
          id: client.id
        });
      });
    };

    WebSocketServer.prototype.disconnectClient = function(clientId) {
      var client;
      client = clients[clientId];
      if (!client) {
        return this.emit('error', new Error("no such client: " + clientId));
      }
      return client.close();
    };

    WebSocketServer.prototype.request = function(clientId, request, callback) {
      var client;
      client = clients[clientId];
      if (!client) {
        return this.emit('error', new Error("no such client: " + clientId));
      }
      request.requestId = REQUEST_ID++;
      requests[request.requestId] = callback;
      return client.send(JSON.stringify({
        topic: 'request',
        payload: request
      }));
    };

    WebSocketServer.prototype.respond = function(clientId, requestId, err, data) {
      var client, response;
      client = clients[clientId];
      if (!client) {
        return this.emit('error', new Error("no such client: " + clientId));
      }
      response = {
        requestId: requestId,
        err: err,
        data: data
      };
      return client.send(JSON.stringify({
        topic: 'response',
        payload: response
      }));
    };

    WebSocketServer.prototype.send = function(clientId, topic, message) {
      var client;
      client = clients[clientId];
      if (!client) {
        return this.emit('error', new Error("no such client: " + clientId));
      }
      return client.send(JSON.stringify({
        topic: topic,
        payload: message
      }));
    };

    return WebSocketServer;

  })(events.EventEmitter);

  WebSocketClient = (function(_super) {
    var REQUEST_ID, client, requests;

    __extends(WebSocketClient, _super);

    REQUEST_ID = 0;

    client = null;

    requests = {};

    function WebSocketClient() {}

    WebSocketClient.prototype.connect = function(port, host) {
      var _this = this;
      client = new WebSocket("wss://" + host + ":" + port);
      client.on('open', function() {
        return _this.emit('connect');
      });
      client.on('message', function(message) {
        var _name;
        message = JSON.parse(message);
        if (message.topic === 'response') {
          if (message.payload.requestId != null) {
            if (!requests[message.payload.requestId]) {
              return _this.emit('error', new Error("no request listener for response: " + message.payload.requestId));
            }
            if (typeof requests[_name = message.payload.requestId] === "function") {
              requests[_name](message.payload.err, message.payload.data);
            }
            return delete requests[message.payload.requestId];
          } else {
            return _this.emit('error', new Error("ignoring response without requestId: " + message.payload));
          }
        } else {
          return _this.emit(message.topic, message.payload);
        }
      });
      client.on('close', function() {
        return _this.emit('disconnect');
      });
      return client.on('error', function(err) {
        _this.emit('error', err);
        return _this.emit('disconnect');
      });
    };

    WebSocketClient.prototype.request = function(request, callback) {
      if (!client) {
        return this.emit('error', new Error('no connection to server'));
      }
      request.requestId = REQUEST_ID++;
      requests[request.requestId] = callback;
      return client.send(JSON.stringify({
        topic: 'request',
        payload: request
      }));
    };

    WebSocketClient.prototype.respond = function(requestId, err, data) {
      var response;
      if (!client) {
        return this.emit('error', new Error('no connection to server'));
      }
      response = {
        requestId: requestId,
        err: err,
        data: data
      };
      return client.send(JSON.stringify({
        topic: 'response',
        payload: response
      }));
    };

    WebSocketClient.prototype.send = function(topic, payload) {
      if (!client) {
        return this.emit('error', new Error('no connection to server'));
      }
      return client.send(JSON.stringify({
        topic: topic,
        payload: payload
      }));
    };

    WebSocketClient.prototype.ping = function(payload) {
      if (!client) {
        return this.emit('error', new Error('no connection to server'));
      }
      return client.ping(JSON.stringify({
        payload: payload
      }), {}, true || 'dontFailWhenClosed');
    };

    return WebSocketClient;

  })(events.EventEmitter);

  module.exports = {
    WebSocketServer: WebSocketServer,
    WebSocketClient: WebSocketClient
  };

}).call(this);