var url = require('url');
var crypto = require('crypto');
var request = require('request');
var _ = require('lodash');

//isv签名库
var WechatCrypto = require('wechat-crypto');

var apis = [
    {
        path: 'get_permanent_code',
        alias: '',
        method: 'POST'
    },{
        path: 'get_auth_info',
        method: 'POST'
    },{
        path: 'get_agent',
        method: 'POST'
    },{
        path: 'activate_suite',
        method: 'POST'
    },{
        path: 'get_corp_token',
        method: 'POST'
    },{
        path: 'set_corp_ipwhitelist',
        method: 'POST'
    }
]

// 记录suite_access_token
var token;
// 记录suite_access_token过期时间
var tokenExpireTime;

function App(config) {

    var defaults = {
        domain: 'https://oapi.dingtalk.com/service'
    };
    this.config = _.assign(defaults, config);

    this.cipher = new WechatCrypto(config.token, config.encodingAESKey, config.suiteKey || 'suite4xxxxxxxxxxxxxxx');

}
/**
 * 获取套件访问Token（suite_access_token）
 * @param {fun} callback 回调
 * @returns {object} 主体
 **/
App.prototype.getToken = function(callback) {
    //log('获取token')
    var key = this.config.suiteKey;
    var secret = this.config.suiteSecret;
    var ticket = this.config.suiteTicket;
    request({
        method: 'POST',
        url: this.config.domain + '/get_suite_token',
        json: true,
        body: {
            suite_key: key,
            suite_secret: secret,
            suite_ticket: ticket
        }
    }, function(err, response, body) {
        if (err || !body || !body.suite_access_token) {
            //log('出错了', err);
            return callback && callback(err);
        }
        console.log('token', body);

        token = body.suite_access_token;
        tokenExpireTime = Date.now() + body.expires_in * 1000 - 200;

        console.log('记录token和过期时间', token, tokenExpireTime)

        callback && callback(err, body);
    })
}

/**
 * 统一请求接口
 * @param {string} path 请求路径，bui自动拼接成完整的url
 * @param {object} params 请求参数集合
 * @param {function} callback  回调，请求成功与否都会触发回调，成功回调会回传数据
 * @returns {null} 
 **/
 App.prototype.doRequest = function(path, params, callback) {
    var _this = this;
    var action = function(t) {
        var url = _this.config.domain + '/' + path;
        if (t) {
            url += '?suite_access_token=' + t;
        }
        var method = 'GET';
        if (params.method === 'POST') {
            delete params.method;
            method = 'POST';
        }
        var obj = {
            method: method,
            url: url,
            json: true
        };

        if (method === 'POST') {
            obj.body = params;
        } else {
            obj.qs = params;
        }
        console.log('request ===> ', url, JSON.stringify(obj, null, 4), '<===');
        //log('请求参数：', obj)
        request(obj, function(err, response, body) {
            callback && callback(err, body);
        })
    };
    //判断是否有token，是否过期，过期的话重新获取
    if (token && tokenExpireTime && Date.now() < tokenExpireTime) {
        action(token);
    } else {
        //log('token过期或者未设置')
        this.getToken(function(err, json) {
            if (err || !json || !json.suite_access_token) {
                return callback && callback(err);
            }
            //
            action(json.suite_access_token);
        });
    }
}


/**
 * 批量生成接口
 **/
apis.forEach(function(item) {
    var p = item.path;
    var method = item.method;
    var alias = item.alias;
    var functionName = _.camelCase(alias || p);
    App.prototype[functionName] = function(params, callback) {
        if (_.isFunction(params)) {
            callback = params;
            params = {};
        }
        var params = params || {};
        var callback = callback || function() {};
        if (method === 'POST') {
            params.method = 'POST';
        }
        this.doRequest(p, params, function(err, json) {
            if (err) {
                //log('获取数据失败');
            }
            callback(err, json);
        });
    }
});



/**
 * 处理钉钉服务推送的信息
 * @param {obj} data post data
 * @returns {obj} 加密后的信息
 **/
App.prototype.receive = function(body) {
    console.log('收到推送内容', body);
    if (!body || !body.encrypt) {
        return;
    }
    var encrypt = body.encrypt;

    //解密推送信息
    var data = this.cipher.decrypt(encrypt);
    console.log('解析后的推送内容', data);
    //解析数据结构
    var json = JSON.parse(data.message) || {};
    var msg = '';
    //处理不同类型的推送数据
    switch (json.EventType) {
        case 'check_create_suite_url':
            msg = json['Random'];
            break;
        case 'suite_ticket':
            this.cipher.id = json['SuiteKey'];
            this.config.suiteKey = json['SuiteKey'];
            this.config.suiteTicket = json['SuiteTicket'];
            console.log('拿到suiteTicket', this.config.suiteTicket)
            msg = 'success';
            break;
        case 'tmp_auth_code':
            msg = 'success';
            break;
        case 'change_auth':
            msg = 'success';
            break;
        case 'check_update_suite_url':
            msg = json['Random'];
            break;
        case 'suite_relieve':
            msg = 'success';
        case 'check_suite_license_code':
            msg = 'success';
            break;
    }
    //加密文本
    var text = this.cipher.encrypt(msg);
    //生成随机串
    var stmp = Date.now();
    //生成随机数
    var nonce = Math.random().toString(36).substring(2);

    //console.log(stmp, nonce, text)
    //签名文本
    var sign = this.cipher.getSignature(stmp, nonce, text);

    //返回给推送服务器的信息
    var result = {
        msg_signature: sign,
        timeStamp: stmp,
        nonce: nonce,
        encrypt: text
    };
    
    console.log('回复内容', result);
    return {
        json: json,
        result: result
    };
}

App.prototype.signTicket = function(params) {
    var origUrl = params.url;
    var origUrlObj =  url.parse(origUrl);
    delete origUrlObj['hash'];
    var newUrl = url.format(origUrlObj);
    var plain = 'jsapi_ticket=' + params.ticket +
        '&noncestr=' + params.nonceStr +
        '&timestamp=' + params.timeStamp +
        '&url=' + newUrl;

    console.log('jsapiticket 签名', plain);
    var sha1 = crypto.createHash('sha1');
    sha1.update(plain, 'utf8');
    var signature = sha1.digest('hex');
    console.log('signature: ' + signature);
    return signature;
}

module.exports = App;
