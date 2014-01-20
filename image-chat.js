
var http = require('http');
var path = require('path');

var express = require('express');
var replify = require('replify');

var WebSocketServer = require('./deps/wsservice').WebSocketServer;
var websocketServer = new WebSocketServer();

var google = require('./lib/google_image_search');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.cookieParser('funwithfractions'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', function(request, response, next) {
  if (request.cookies['imgchat-username']) {
    next();
  } else {
    response.sendfile('./public/login.html');
  }
});

app.get('/login/:username', function(request, response) {
  response.cookie('imgchat-username', request.params.username, { maxAge: 31536000000 || 'one year' });
  response.redirect('/');
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

(function(server) {
  var users = {};
  var clients = [];
  var messageHistory = [];
  var messageId = 0;

  function userAction(user) {
    console.log('client action:', user);
    if (user.username) users[user.clientId] = user.username;
    clients.forEach(function(id) {
      if (id !== user.clientId) {
        server.send(id, 'user', { action: user.action, content: user.username + ' joined.' });
      }
    });
    server.send(user.clientId, 'messages', messageHistory);
  }
  function incomingMessage(message, client) {
    message.content = message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    message.id = ++messageId;
    messageHistory.push(message);
    clients.forEach(function(id) {
      server.send(id, 'message', message);
    });
    var userIp = client.upgradeReq.headers['x-forwarded-for'];
    userIp = userIp || client.upgradeReq.connection.remoteAddress;
    console.log('performing search with userIp, username:', userIp, message.username);
    // TODO: keep message history, maybe in Mongo to demonstrate use of that
    //       or just redis because we don't need persistence
    google.getImage(message.content, userIp, message.username, function(err, image) {
      if (err) console.warn(err);
      if (image) {
        var update = {
          id: message.id
        , image: image
        };
        clients.forEach(function(id) {
          server.send(id, 'update', update);
        });
        message.image = image;
      }
    });
  }
  function clientConnect(client) {
    console.log('client connected:', client.id);
    clients.push(client.id);
  }
  function clientDisconnect(data) {
    console.log('client disconnected:', data.clientId);
    clients = clients.filter(function(id) {
      return id !== data.clientId;
    });
    if (users[data.clientId]) {
      clients.forEach(function(id) {
        server.send(id, 'user', { action: 'leave', content: users[data.clientId] + ' left.' });
      });
    }
  }
  function handleError(err) {
    console.log('WS ERROR: ', err);
  }
  function keepAlive() {
    clients.forEach(function(id) {
      server.send(id, 'ping', { timestamp: Date.now() });
    });
  }

  server.on('user', userAction);
  server.on('message', incomingMessage);
  server.on('clientConnect', clientConnect);
  server.on('clientDisconnect', clientDisconnect);
  server.on('error', handleError);

  server.listen(process.env.WS_PORT || 3737);

  setInterval(keepAlive, 25000);

})(websocketServer);

