/*global ReconnectingWebSocket*/

var app = app || {};

app.socket = (function() {
  var REQUEST_ID = 0;

  var socket = null;
  var requests = {};

  var eventListeners = {};
  var onceEventListeners = {};

  var client = {
    connect: function(port, host) {
      // socket = new WebSocket('ws://' + host + ':' + port);
      socket = new ReconnectingWebSocket('ws://' + host + ':' + port);
      socket.onopen = function() {
        client.emit('connect');
      };
      socket.onmessage = function(message) {
        message = JSON.parse(message.data);
        if (message.topic === 'response') {
          var requestId = message.payload.requestId;
          if (typeof requestId === 'undefined') {
            return client.emit('error',
                new Error('ignoring response without requestId: ' +
                  message.payload));
          }
          if (typeof requests[requestId] === 'undefined') {
            return client.emit('error',
              new Error('no request listener for response: ' + requestId));
          }
          requests[requestId](message.payload.err, message.payload.data);
          delete requests[requestId];
        } else {
          client.emit(message.topic, message.payload);
        }
      };
      socket.onclose = function() {
        client.emit('disconnect');
      };
      socket.onerror = function(err) {
        client.emit('error', err);
        client.emit('disconnect');
      };
    },
    request: function(request, callback) {
      if (!socket) {
        return client.emit('error', new Error('no connection to server'));
      }

      request.requestId = REQUEST_ID++;
      requests[request.requestId] = callback;

      if (socket.readyState !== 1) {
        client.once('connect', function() {
          socket.send(JSON.stringify({ topic: 'request', payload: request }));
        });
      } else {
        socket.send(JSON.stringify({ topic: 'request', payload: request }));
      }
    },
    respond: function(requestId, err, data) {
      if (!socket) {
        return client.emit('error', new Error('no connection to server'));
      }
      var response = { requestId: requestId, err: err, data: data };
      socket.send(JSON.stringify({ topic: 'response', payload: response}));
    },
    send: function(topic, payload) {
      if (!socket) {
        return client.emit('error', new Error('no connection to server'));
      }
      socket.send(JSON.stringify({ topic: topic, payload: payload }));
    },
    // ping: function(payload) {
    //   if (!socket) {
    //     return client.emit('error', new Error('no connection to server'));
    //   }
    //   socket.ping(JSON.stringify({ payload: payload }), {},
    //       true || 'dontFailWhenClosed');
    // },

    // eventListeners
    emit: function(eventType, eventData) {
      var listeners = eventListeners[eventType];
      if (typeof listeners === 'undefined') {
        return;
      }
      listeners.forEach(function(listener) {
        listener(eventData);
      });

      listeners = onceEventListeners[eventType];
      if (typeof listeners === 'undefined') {
        return;
      }
      listeners.forEach(function(listener) {
        listener(eventData);
      });
      onceEventListeners[eventType] = [];
    },
    on: function(eventType, listener) {
      var listeners = eventListeners[eventType];
      if (typeof listeners === 'undefined') {
        eventListeners[eventType] = listeners = [];
      }
      listeners.push(listener);
    },
    once: function(eventType, listener) {
      var listeners = onceEventListeners[eventType];
      if (typeof listeners === 'undefined') {
        onceEventListeners[eventType] = listeners = [];
      }
      listeners.push(listener);
    },
    off: function(eventType, listener) {
      var listeners = eventListeners[eventType];
      if (typeof listeners === 'undefined') {
        return;
      }
      listeners = listeners.filter(function(l) {
        return (l !== listener);
      });

      listeners = onceEventListeners[eventType];
      if (typeof listeners === 'undefined') {
        return;
      }
      listeners = listeners.filter(function(l) {
        return (l !== listener);
      });
    }
  };

  return client;
})();

