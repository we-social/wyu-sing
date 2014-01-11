
var http = require('http'),
	querystring = require('querystring'),
	_ = require('underscore'),
	BufferHelper = require('bufferhelper');

function Client(host, path) {
	if (! /:\d+$/.test(host)) {
		this.host = host;
		this.port = 80;
	} else {
		this.host = host.match(/(.+):(\d+)$/)[1];
		this.port = host.match(/(.+):(\d+)$/)[2];
	}
	this.path = path || '';
	this.cookie = {};
}
module.exports = Client;

Client.prototype.get = function(path, data, headers, callback) {
	return this.request(path, data, headers, callback, 'get');
}
Client.prototype.post = function(path, data, headers, callback) {
	return this.request(path, data, headers, callback, 'post');
}
Client.prototype.request = function(path, data, headers, callback, method) {
	var client = this;
	method = method.toLowerCase();
	if (! _.isString(data)) {
		data = querystring.stringify(data || {});
	}
	if (method === 'get') {
		path += '?' + data;
		data = '';
	}
	
	var req = http.request({
		host: client.host,
		port: client.port,
		path: client.path + path,
		method: method,
		headers: _.extend({}, {
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Encoding': 'gzip,deflate,sdch',
			'Accept-Language': 'zh-CN,zh;q=0.8',
			'Cache-Control': 'max-age=0',
			'Connection': 'keep-alive',
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length,
			'Cookie': (function() {
				var str = '';
				_.each(client.cookie, function(val, key) {
					str += key + '=' + val + '; ';
				});
				return str;
			})(),
			'Host': client.host,
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.11 Safari/537.36'
		}, headers)
	}, function(res) {
		if (! callback) return;
		var bufhelper = new BufferHelper();
		res.on('data', function(chunk) {
			bufhelper.concat(chunk);
		}).on('end', function() {
			var buf = bufhelper.toBuffer();
			var cookieArr = res.headers['set-cookie'];
			if (cookieArr) {
				client.setCookie(cookieArr);
			}
			callback.apply(client, [null, res, buf]);
		});
	}).on('error', function(err) {
		callback && callback.apply(client, [err]);
	});

	data && req.write(data);
	req.end();
	return this;
}
Client.prototype.setCookie = function(cookie) {
	if (_.isString(cookie)) {
		cookie = cookie.split(/\s*;\s*/);
	}
	if (_.isArray(cookie)) {
		var tmp = {};
		_.each(cookie, function(row) {
			var seg = row.split(/\s*;\s*/)[0];
			seg.match(/^([^=]+)=(.*)/);
			tmp[RegExp.$1] = RegExp.$2;
		});
		cookie = tmp;
	}
	_.extend(this.cookie, cookie);
	return this;
}
