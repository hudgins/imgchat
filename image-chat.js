
var path = require('path');

var express = require('express');
// var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var WebSocketServer = require('./deps/wsservice').WebSocketServer;
var websocketServer = new WebSocketServer();

var db = require('./lib/database');
var google = require('./lib/google_image_search');

var app = express();

app.set('port', process.env.PORT || 3000);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

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

var MAX_RECENT = 20;
var recentMessages = [];

db.init(function(err) {
  if (err) return console.error(err);
  db.messages.find().sort({ timestamp: 1 }).limit(MAX_RECENT).toArray(function(err, messages) {
    if (err) return console.error(err);
    recentMessages = messages;
    var server = app.listen(app.get('port'), function(){
      console.log('Express server listening on port ' + server.address().port);
    });
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        // res.render('error', {
        //     message: err.message,
        //     error: err
        // });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    // res.render('error', {
    //     message: err.message,
    //     error: {}
    // });
});

(function(server) {
  var users = {};
  var clients = [];

  function userAction(user) {
    console.log('client action:', user);
    if (user.username) users[user.clientId] = user.username;
    clients.forEach(function(id) {
      if (id !== user.clientId) {
        server.send(id, 'user', { action: user.action, content: user.username + ' joined.' });
      }
    });
    server.send(user.clientId, 'messages', recentMessages);
  }
  function incomingMessage(message, client) {
    message.content = message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    message.timestamp = Date.now();
    recentMessages.push(message);
    // only keep X recent messages
    if (recentMessages.length > MAX_RECENT) {
      recentMessages = recentMessages.slice(1);
    }
    db.messages.save(message, function(err, message) {
      if (err) return console.error(err);

      message.id = message._id;
      clients.forEach(function(id) {
        server.send(id, 'message', message);
      });
      var userIp = client.upgradeReq.headers['x-forwarded-for'];
      userIp = userIp || client.upgradeReq.connection.remoteAddress;
      console.log('performing search with userIp, username:', userIp, message.username);
      google.getImage(message.content, userIp, message.username, function(err, image) {
        if (err) console.warn(err);
        if (image) {
          var update = {
            messageId: message.id
          , image: image
          };
          clients.forEach(function(id) {
            server.send(id, 'update', update);
          });
          message.image = image;
          db.messages.save(message, function(err) {
            if (err) console.error(err);
          });
        }
      });
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

