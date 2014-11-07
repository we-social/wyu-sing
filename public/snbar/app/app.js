var app = {};

app.init = function () {
  app.$window = $(window);
  app.$document = $(document);
  app.$body = $('body');
  app.$frame = $('#frame');
  app.hash = window.location.hash;
  app.lastHash = undefined;
  app.params = getHashParams();
  app.lastParams = undefined;

  app.$window.on('hashchange', function (ev) {
    ev.preventDefault();
    if (window.location.hash === app.hash) return;
    app.loadPage(window.location.hash);
  });

  app.$body.delegate('[href]', 'tap click', function (ev) {
    var href = $(this).attr('href');
    if (!$(this).is('.external') && href && href !== '#') {
      ev.preventDefault();
      app.loadPage(href)
    }
  });
}

app.reloadPage = function (success) {
  loadPage(app.hash, success);
}
app.loadPage = function (hash, success) {
  var mat = hash.substr(1).match(/^([^\?]*)(\?[^\?]*)?$/);
  var href = 'frames/' + (mat[1] || '') + '.html' + (mat[2] || '');
  $.ajax({
    type: 'get',
    url: href,
    success: function (html) {
      if (app.lastHash !== app.hash) app.lastHash = app.hash;
      window.location.hash = app.hash = hash;
      app.lastParams = app.params;
      app.params = getHashParams();
      app.$frame.html(html);
      window.scrollTo(0); // 窗口返回最顶
      success && success();
    },
    error: function () {
      throw new Error('页面 ' + hash + ' 加载失败');
      if (app.hash === hash) window.history.go(-1);
    }
  });
}

app.notify = function (msg) {
  // 有消息则提示
  msg && alert(msg);
}

app.showMeta = function () {
  var $meta = $('[data-bind="meta"]');
  $.get('/meta/get', function (data) {
    // 如果是字符串则parseJSON
    if (!_.isObject(data)) data = $.parseJSON(data);
    var meta = data['meta'];
    if (!meta) throw new Error('Meta信息加载失败');
    // 信息部署
    _.each(meta, function (val, key) {
      $meta.filter('[data-name="' + key + '"]').text(val);
    });
  });
}

app.gotoRandomSong = function () {
  $.get('/song/sample', { 'limit': 1 }, function (data) {
    // 如果是字符串则parseJSON
    if (!_.isObject(data)) data = $.parseJSON(data);
    var songs = data['songs'];
    if (!songs) throw new Error('歌曲加载失败');
    if (!songs.length) return app.notify('一首歌都没有..');
    app.loadPage('#song?id=' + songs[0].msgid);
  });
}
