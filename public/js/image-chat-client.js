/*global Backbone, jQuery, _, FastClick, d3*/
'use strict';

var app = app || {};

function main() {
  var AppView = (function($) {
    return Backbone.View.extend({
      el: '#app',
      events: {
      },
      initialize: function() {
        this.messageListView = new MessageListView({ collection: new MessageCollection() });
        this.messageComposeView = new MessageComposeView();
      },
      render: function() {
        this.messageListView.setElement(this.$el.find('#message-list'));
        this.messageListView.render();
        this.messageComposeView.setElement(this.$el.find('#message-compose'));
        this.messageComposeView.render();
        var self = this;
        this.messageListView.listenTo(this.messageComposeView, 'keyboardDismissed', this.messageListView.expand);
        this.messageListView.listenTo(this.messageComposeView, 'keyboardSummoned', this.messageListView.shrink);
        return this;
      },
      refreshPage: function() {
        document.location.reload();
      }
    });
  })(jQuery);

  var MessageListView = (function($) {
    return Backbone.View.extend({
      template: compileTemplate('#message-list-template'),
      events: {
      },
      initialize: function() {
        this.listenTo(this.collection, 'reset', this.collectionReset);
        this.listenTo(this.collection, 'add', this.addView);
        // TODO: drop old views off the end by listening to remove
        this.createViews();
      },
      collectionReset: function() {
        this.createViews();
        this.renderViews();
      },
      addView: function(model) {
        var view;
        if (model.get('action')) {
          view = new UserActivityView({ model: model });
        } else {
          view = new MessageView({ model: model });
          this.listenTo(view, 'refocus', this.refocus.bind(this));
        }
        this.views.push(view);
        var $list = this.$el.find('.list');
        var el = view.render().el;
        view.$el.find('.content').addClass('hidden').addClass('animate');
        $list.append(el);
        el.scrollIntoView();
        setTimeout(function() {
          view.$el.find('.content').removeClass('hidden');
        }, 10);
      },
      createViews: function() {
        var self = this;
        self.views = [];
        self.collection.forEach(function(model) {
          var view = new MessageView({ model: model });
          self.views.push(view);
          self.listenTo(view, 'refocus', self.refocus.bind(self));
        });
      },
      renderViews: function() {
        var $list = this.$el.find('.list').empty();
        var el;
        this.views.forEach(function(view, index, views) {
          el = view.render().el;
          $list.append(el);
        });
        if (el) el.scrollIntoView();
      },
      expand: function() {
        this.$el.find('.list').addClass('expanded');
        if (this.views.length) {
          this.views[this.views.length - 1].el.scrollIntoView();
        }
      },
      shrink: function() {
        this.$el.find('.list').removeClass('expanded');
        if (this.views.length) {
          this.views[this.views.length - 1].el.scrollIntoView();
        }
      },
      refocus: function() {
        $('#content').focus();
      },
      render: function() {
        this.$el.html(this.template({}));
        this.renderViews();
        return this;
      }
    });
  })(jQuery);

  var MessageModel = Backbone.Model.extend({
    defaults: {
      username: ''
    , content: ''
    , timestamp: 0
    , image: {
        title: ''
      , link: ''
      , snippet: ''
      , thumbnail: {
          width: 0
        , height: 0
        , url: ''
        }
      , original: {
          url: ''
        }
      }
    },
    initialize: function() { }
  });

  var MessageCollection = Backbone.Collection.extend({
    model: MessageModel,
    initialize: function(models, options) {
      var self = this;
      app.socket.on('messages', function(messages) {
        messages.forEach(function(message) {
          if (message.username === app.username) {
            message.mine = true;
          }
        });
        self.reset(messages);
      });
      app.socket.on('message', function(message) {
        if (message.username === app.username) {
          message.mine = true;
        }
        self.add(message);
      });
      app.socket.on('update', function(update) {
        var message = self.get(update.id);
        message.set(update);
      });
      app.socket.on('user', function(message) {
        self.add(message);
      });
    }
  });

  var MessageView = (function($) {
    return Backbone.View.extend({
      tagName: 'div',
      className: 'message',
      template: compileTemplate('#message-template'),
      events: {
        'click .image': 'showDetail'
      },
      initialize: function() {
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model, 'change image', this.animate);
      },
      animate: function() {
        var img = this.$el.find('.image');
        img.addClass('hidden');
        var self = this;
        img.one('load', function() {
          self.el.scrollIntoView();
          img.addClass('animate');
        });
      },
      showDetail: function() {
        console.log('show detail');
        var detailView = new ImageDetailView({ model: this.model });
        var self = this;
        this.listenTo(detailView, 'closed', function() {
          self.trigger('refocus');
        });
        $('#app').append(detailView.render().el);
        $('#main').addClass('covered');
      },
      render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        if (this.model.get('mine')) {
          this.$el.addClass('mine');
        }
        return this;
      },
    });
  })(jQuery);

  var ImageDetailView = (function($) {
    return Backbone.View.extend({
      tagName: 'div',
      className: 'image-detail',
      template: compileTemplate('#image-detail-template'),
      events: {
        'click #close': 'close'
      },
      initialize: function() {
      },
      close: function() {
        $('#main').removeClass('covered');
        this.$el.addClass('drop');
        var self = this;
        this.$el.one('webkitAnimationEnd', function() {
          self.$el.remove();
          self.trigger('closed');
        });
      },
      render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
      },
    });
  })(jQuery);

  var UserActivityView = (function($) {
    return Backbone.View.extend({
      tagName: 'div',
      className: 'user-activity',
      template: compileTemplate('#user-activity-template'),
      events: {
      },
      initialize: function() {
      },
      render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
      },
    });
  })(jQuery);

  var MessageComposeView = (function($) {
    return Backbone.View.extend({
      template: compileTemplate('#message-compose-template'),
      events: {
        'click #btn-send': 'send'
      , 'keyup': 'processKey'
      },
      processKey: function(e) {
        // TODO: fix accidental sending when hitting return to reload the page in Chrome
        if (e.which === 13 && document.activeElement && document.activeElement.id === 'content') { // enter key
          this.send();
        }
      },
      initialize: function() {
      },
      send: function() {
        var $content = this.$el.find('#content');
        var content = $content.val();
        if (!content) return;
        var message = {
          username: app.username
        , timestamp: new Date().getTime()
        , content: content
        };
        app.socket.send('message', message);
        $content.val('');
      },
      render: function() {
        this.$el.html(this.template({}));
        var self = this;
        this.$el.find('#content').on('blur', function() {
          self.trigger('keyboardDismissed');
          // self.send();
          // TODO can't send here because user may have just tapped on an image
        });
        this.$el.find('#content').on('focus', function() {
          self.trigger('keyboardSummoned');
        });
        return this;
      },
    });
  })(jQuery);

  jQuery(document).ready(function() {
    FastClick.attach(document.body);
    if (/iPhone/.test(window.navigator.userAgent) && window.navigator.standalone) {
      // jQuery(document).on('touchmove', function(event) {
      //   event.preventDefault();
      //   if (false) { // not using this
      //     // prevent bounce everywhere, but allow lists to scroll
      //     var scrollable = jQuery(event.target).parents('.scrollable');
      //     if (!scrollable.length) {
      //       event.preventDefault();
      //     } else if (scrollable.scrollTop() === 0) {
      //       console.log('stop the scroll');
      //     }
      //   }
      // });
    }
    app.appView = new AppView().render();

    app.username = document.cookie.replace(/(?:(?:^|.*;\s*)imgchat-username\s*\=\s*([^;]*).*$)|^.*$/, '$1').replace(/%20/, ' ');

    // app.socket.on('connect', function()    {console.log(Date.now(), 'socket open.');});
    // app.socket.on('disconnect', function() {console.log(Date.now(), 'socket closed.');});
    // app.socket.on('error', function(err) {
    //   console.log(Date.now(), 'socket error.', err.message);
    // });
    // app.socket.on('ping', function()    {console.log(Date.now(), 'pinged.');});
    if (/localhost/.test(document.location.hostname)) {
      app.socket.connect(3737, 'localhost');
    } else if (/hudg/.test(document.location.hostname)) {
      app.socket.connect(80, 'ws' + document.location.hostname);
    } else {
      app.socket.connect(3737, document.location.hostname);
    }
    app.socket.on('connect', function() {
      app.username = app.username || 'User ' + Math.floor(Math.random() * 10000);
      app.socket.send('user', { action: 'join', username: app.username });
    });
  });

  function compileTemplate(templateId) {
    return _.template(jQuery(templateId).html(), null, { variable: 'data' });
  }
}

(function() {
  if (!app.abort) {
    main();
  }
})();

