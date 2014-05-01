var util = require('util'),
  path = require('path'),
  fs = require('fs'),
  _ = require('underscore'),
  Activity = require('./activity'),
  config, presongDir,
  logoUrl, songListUrl, songDownUrl,
  loginAccount, minSeconds, voiceFormat,
  userColl, presongColl,
  wxVoiceThief = require('../wx-voice-thief');

var RootActivity = module.exports = function () {
  Activity.call(this);
}
util.inherits(RootActivity, Activity);

RootActivity.prototype.watch = function (app, hash) {
  this.activityHash = hash;
  config = app.get('config');
  presongDir = config.dirs.presongs;
  logoUrl = config.urls.logo;
  songListUrl = config.urls.songList;
  songDownUrl = config.urls.songDown;
  loginAccount = config.wx.loginAccount;
  minSeconds = config.wx.minSeconds;
  voiceFormat = config.wx.voiceFormat;
  userColl = app.get('userColl');
  presongColl = app.get('presongColl');
  songColl = app.get('songColl');
  if (loginAccount) {
    wxVoiceThief.init(config.wx.account);    // thief
  }
}
RootActivity.prototype.act = function (req, res) {
  var reqMsg = req.wxMsg,
    msgType = reqMsg.msgType;
  switch (msgType) {
    case 'text':
      this.actText(req, res);
      break;
    case 'voice':
      this.actVoice(req, res);
      break;
    default:
      this.welcome(req, res);
  }
}
RootActivity.prototype.actText = function (req, res) {
  var self = this,
    txt = req.wxMsg.content;
  if (txt === '1') {
    songColl.count({}, function (err, count) {
      songColl.find({}, {
        limit: 1,
        skip: Math.floor(Math.random() * count)
      }).toArray(function (err, songs) {
          var song = songs[0];
          self.sendSong(res, song);
        });
    });
  } else if (txt === '2') {
    self.sendSongList(res);
  } else {
    this.welcome(req, res);
  }
}
RootActivity.prototype.sendSongList = function (res) {
  res.sendWxMsg({
    msgType: 'news',
    articles: [
      {
        title: '【邑大唱吧】歌曲列表',
        description: '提供你的歌声 也听听别人的歌声',
        // needing a new pic
        picUrl: logoUrl,
        url: songListUrl
      }
    ]
  });
}
RootActivity.prototype.sendSong = function (res, song) {
  var msgid = song.msgid;
  res.sendWxMsg({
    msgType: 'music',
    music: {
      title: '随机听: ' + msgid,
      description: song.name,
      musicUrl: songDownUrl + msgid,
      hqMusicUrl: songDownUrl + msgid
    }
  });
}
RootActivity.prototype.actVoice = function (req, res) {
  var self = this,
    reqMsg = req.wxMsg,
    user = req.wxUser;
  // 抓取voice
  _.delay(function () {
    wxVoiceThief.steal(reqMsg.createTime, function (err, msg, data) {
      if (err) {
        console.error(err);
        return self.sorry(req, res);
      }
      var msgId = msg['id'],
        fakeId = msg['fakeid'],
        nickname = msg['nick_name'],
        playLength = msg['play_length'];
      // 更新用户nickname和fakeid
      var userExt = {
        fakeid: fakeId,
        nickname: nickname
      }
      _.extend(user, userExt);
      userColl.update({
        username: user.username
      }, {
        $set: userExt
      }, function (err, num) {
        console.info('User profile expanded: ' + user.username);
      });
      if (playLength / 1000 < minSeconds) {   // 时间不够长
        return res.sendWxMsg({
          msgType: 'text',
          content: '你的歌声好像不够' + minSeconds + '秒哦'
        });
      }
      // 保存presong
      var filepath = path.join(presongDir, msgId + '.' + voiceFormat);
      fs.writeFile(filepath, data, function (err) {
        console.log(filepath);
        if (err) return console.error(err);
        console.info('New presong file saved: ' + msgId);
      });
      var presong = {
        msgid: msgId,
        username: user.username,
        createtime: reqMsg.createTime,  // 单位 s
        playlength: Math.max(1, Math.round(playLength / 1000))  // 单位 s
      }
      presongColl.insert(presong, function (err, docs) {
        console.info('New presong added: ' + msgId);
      });
      // 跳转activity
      self.activityHash['submit'].welcome(req, res);
    });
  }, 1000);
}
RootActivity.prototype.welcome = function (req, res) {
  var user = req.wxUser;
  // activity记录更新
  userColl.update({
    username: user.username
  }, {
    $set: {
      activity: this.name
    }
  }, {w: 0});
  res.sendWxMsg({
    msgType: 'text',
    content: [
      '欢迎来到【邑大唱吧】',
      '回复数字1 - 随机听',
      '回复数字2 - 歌曲列表网页',
      '回复' + minSeconds + '秒以上语音 - 送上你的歌声'
    ].join('\n')
  });
}
RootActivity.prototype.sorry = function (req, res) {
  res.sendWxMsg({
    msgType: 'text',
    content: [
      'Sorry~ 歌声未入列',
      '请向我们反应以将其入列',
      '私信新浪微博 @邑点通_ETips'
    ].join('\n')
  });
}
