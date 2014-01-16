
var http = require('http');
var path = require('path');

var express = require('express');
var replify = require('replify');
var agent   = require('superagent');

var WebSocketServer = require('./deps/wsservice').WebSocketServer;
var websocketServer = new WebSocketServer();

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

// request:
// 'https://www.googleapis.com/customsearch/v1?key=AIzaSyBGoNV9FM6BSn4do7uVvdCXrtbBrPIOYr4&cx=012723436201267046883:yr0c2b-dvmm&q=cats&num=1'
// response:
// res.body.items[0].pagemap.cse_thumbnail
// width, height, src
// res.body.items[0].pagemap.cse_image (a href for img)
// src

var CS_URL = 'https://www.googleapis.com/customsearch/v1';
var API_KEY = 'AIzaSyBGoNV9FM6BSn4do7uVvdCXrtbBrPIOYr4';
var CSE_ID = '012723436201267046883:yr0c2b-dvmm';

function query(terms, userIp, userId) {
  return {
    key: API_KEY
  , cx: CSE_ID
  , num: 10
  , safe: 'high'
  , userIp: userIp
  , quotaUser: userId
  , q: encodeURIComponent(terms).replace(/%20/g, '+')
  };
}

function googleTopImageResult(terms, userIp, userId, done) {
  agent.get(CS_URL).type('json').query(query(terms, userIp, userId)).end(function(err, res) {
    if (err || !res.ok) return done(err || new Error('non-200 response: ' + res.status));
    if (!res.body || !res.body.items) return done(new Error('no results'));
    var result = null;
    res.body.items.forEach(function(item, index) {
      if (result === null &&
          item.pagemap &&
          item.pagemap.cse_thumbnail &&
          item.pagemap.cse_thumbnail.length &&
          item.pagemap.cse_image &&
          item.pagemap.cse_image.length) {
        console.log('using result number:', index);
        result = {
          // strip quotes and newlines from title
          title: item.title.replace(/[^0-9a-zA-Z :;?!@#$%^&*()\-_+=\[\],{}|\.]+/g, '')
        , link: item.link
        , snippet: item.snippet
        , thumbnail: {
            width:  item.pagemap.cse_thumbnail[0].width
          , height: item.pagemap.cse_thumbnail[0].height
          , url:    item.pagemap.cse_thumbnail[0].src
          }
        , original: {
            url: item.pagemap.cse_image[0].src
          }
        };
      }
    });
    console.log('result for:', query(terms).q);
    if (result) return done(null, result);
    console.warn('no image result for search:', terms, res.body.items);
    done(null, '');
  });
}

var connectedClients = [];

var messageHistory = [];
var messageId = 0;

websocketServer.on('message', function(message, client) {
  message.content = message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  message.id = ++messageId;
  messageHistory.push(message);
  connectedClients.forEach(function(id) {
    websocketServer.send(id, 'message', message);
  });
  var userIp = client.upgradeReq.headers['x-forwarded-for'];
  userIp = userIp || client.upgradeReq.connection.remoteAddress;
  console.log('performing search with userIp, username:', userIp, message.username);
  // TODO: keep message history, maybe in Mongo to demonstrate use of that
  //       or just redis because we don't need persistence
  googleTopImageResult(message.content, userIp, message.username, function(err, image) {
    if (err) console.warn(err);
    if (image) {
      var update = {
        id: message.id
      , image: image
      };
      connectedClients.forEach(function(id) {
        websocketServer.send(id, 'update', update);
      });
      message.image = image;
    }
  });
});

var users = {};

websocketServer.on('user', function(user) {
  console.log('client action:', user);
  if (user.username) users[user.clientId] = user.username;
  connectedClients.forEach(function(id) {
    if (id !== user.clientId) {
      websocketServer.send(id, 'user', { action: user.action, content: user.username + ' joined.' });
    }
  });
  websocketServer.send(user.clientId, 'messages', messageHistory);
});

websocketServer.on('clientConnect', function(client) {
  console.log('client connected:', client.id);
  connectedClients.push(client.id);
});

websocketServer.on('error', function(err) {
  console.log('WS ERROR: ', err);
});

websocketServer.on('clientDisconnect', function(data) {
  console.log('client disconnected:', data.clientId);
  connectedClients = connectedClients.filter(function(id) {
    return id !== data.clientId;
  });
  if (users[data.clientId]) {
    connectedClients.forEach(function(id) {
      websocketServer.send(id, 'user', { action: 'leave', content: users[data.clientId] + ' left.' });
    });
  }
});

websocketServer.listen(process.env.WS_PORT || 3737);

