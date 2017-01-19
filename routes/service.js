var url = require('url');
var API = require('dingtalk-node');
var api = new API();

var storage = require('./storage');


//ISV通信
var ISV = require('../libs/sdk');
var config = require('../config');
config.isv.suiteTicket = storage.getTicket();

var isv = new ISV(config.isv);

/**
 * 处理钉钉服务器的请求
 * @param {obj} 参数名 描述
 * @returns {返回值类型} 描述
 **/
function receive(obj) {
    var result = isv.receive(obj);
    //console.log(result);
    var json = result.json;
    switch (json.EventType) {
        case 'tmp_auth_code':
            getPermanentCode(json.AuthCode)
            break;
        //变更授权
        case 'change_auth':
            console.log('授权变更，查询应用信息', json)
            getAuthInfo(json.AuthCorpId, function(err, json) {
                console.log(err, json)
            });
            break;
        case 'suite_relieve':
            console.log('解除授权', json);
            //使该企业的access_token、jsticket todo立刻失效
            storage.setCorp({
                id: json.AuthCorpId,
                token_expires: Date.now(),
                ticket_expires: Date.now()
            })
            break;
        case 'suite_ticket':
            // 需要持久化保存ticket，因为ticket不能主动获取，当node服务重启或者服务挂掉的时候就惨了
            storage.setTicket(json.SuiteTicket);
            break;
    }
    return result;
}

exports.receive = receive;

/**
 * 换取企业永久授权码, 需要自行维护
 * @param {string} code 临时授权码
 * @returns {undefined} 描述
 **/
function getPermanentCode(code) {
    console.log('======开始请求永久授权码======')
    isv.getPermanentCode({
        tmp_auth_code: code
    }, function(err, json) {
        console.log(err, json, 'get permanent code')
        if (err || !json || !json.permanent_code) {
            return
        }
        if (!json.permanent_code) {
            console.log('获取永久授权码失败');
            return;
        }

        //激活套件
        activateSuite(json.auth_corp_info.corpid, json.permanent_code);

        //保存永久授权码
        storage.setCorp({
            id: json.auth_corp_info.corpid,
            name: json.auth_corp_info.corp_name,
            code: json.permanent_code
        })

    })
}

exports.getPermanentCode = getPermanentCode;

/**
 * 激活套件
 * @param {string} cid 企业id auth_corpid
 * @param {string} code 永久授权码permanent_code
 * @returns {undefined} 描述
 **/
function activateSuite(cid, code) {
    console.log('=========激活套件=======')
    isv.activateSuite({
        suite_key: isv.config.suiteKey,
        auth_corpid: cid,
        permanent_code: code
    }, function(err, json) {
        if (err) {

        }
        console.log(err, json)
    })
}

exports.activateSuite = activateSuite;



/**
 * 获取企业access_token
 * @param {string} cid 企业id
 * @returns {返回值类型} 描述
 **/
/* {
    cid: 'xxxx',
    token: 'xxx',
    token_expires: 13333344333
 }*/


function getCorpToken(cid, callback) {
    console.log('=======获取企业access_token=======')
    //先从存储中读取，如果有并且没过期，直接使用，否则重新获取
    var now = Date.now();
    var corpInfo = storage.getCorp(cid) || {
        id: cid
    };
    var code = corpInfo.code;
    if (!code) {
        console.log('没有找到该企业的永久授权码');
        callback && callback('没有找到该企业的永久授权码');
        return;
    }

    if (corpInfo.token && corpInfo.token_expires > now) {
        callback && callback(null, corpInfo.token);
        return corpInfo.token;
    }

    isv.getCorpToken({
        auth_corpid: cid,
        permanent_code: code
    }, function(err, json) {
        console.log(err, json)
        if (err || !json || !json.access_token) {
            return callback && callback('获取企业access_token失败');
        }
        callback && callback(err, json.access_token);
        /*{
            "access_token": "xxxxxx",
            "expires_in": 7200
        }*/
        if (err || !json.access_token) {
            console.log('获取corp_token失败')
            return;
        }
        //更新token和过期时间
        corpInfo.token = json.access_token;
        corpInfo.token_expires = now + json.expires_in * 1000 - 200;
        storage.setCorp(corpInfo);

    })
}


/**
 * 获取jsticket
 * @param {string} cid 企业id
 * @returns {undefined} 描述
 **/
/* {
    cid: 'xxxx',
    ticket: 'xxx',
    ticket_expires: 13333344333
 }*/
function getJsTicket(cid, callback) {
    console.log('=======获取企业js_api_ticket=======')
    var now = Date.now();
    var corpInfo = storage.getCorp(cid) || {
        id: cid
    };

    if (corpInfo.ticket && corpInfo.ticket_expires > now) {
        callback && callback(null, corpInfo.ticket);
        return corpInfo.ticket;
    }

    getCorpToken(cid, function(err, token) {
        if (err) {
            callback && callback(err);
            return;
        }
        //通过企业api接口获取企业js_api_ticket  https://oapi.dingtalk.com/get_jsapi_ticket
        api.getJsapiTicket({
            access_token: token
        }, function(err, json) {
            console.log(json)

            if (err || !json.ticket) {
                console.log('获取js_api_ticket失败', json);
                callback && callback('获取js_api_ticket失败', json);
                return;
            }
            callback && callback(err, json.ticket);
            //更新ticket和过期时间
            corpInfo.ticket = json.ticket;
            corpInfo.ticket_expires = now + json.expires_in * 1000;
            storage.setCorp(corpInfo);
        })
    })
}

exports.getJsTicket = getJsTicket;


/**
 * 签名jsticket输出给前端
 * @param {string} cid 企业id
 * @param {obj} params jsapiticket签名参数
 * @returns {返回值类型} 描述
 **/

function signTicket(cid, params, callback) {
    //获取当前企业的js_api_ticket
    getJsTicket(cid, function(err, ticket) {
        //console.log('///', err, ticket)
        if (err || !ticket) {
            return callback && callback('获取jsticket出错');
        }
        var result = {
            nonceStr: params.nonceStr || Math.random().toString(36).substring(2),
            ticket: ticket,
            timeStamp: params.timeStamp || Date.now(),
            url: params.url
        }
        result.sign = isv.signTicket(result);
        delete result.ticket;

        callback && callback(null, result)
    })
}

exports.signTicket = signTicket;


/**
 * 获取用户信息
 * @param {strin} cid 企业id
 * @param {string} code 用户code
 * @returns {返回值类型} 描述
 **/

function getUserInfo(cid, code, callback) {
    var corpInfo = storage.getCorp(cid) || {};
    // 获取企业access_token
    getCorpToken(cid, function(err, token) {
        if (err) {
            callback && callback(err);
            return;
        }
        // 获取用户信息
        api.userGetuserinfo({
            access_token: token,
            code: code
        }, function(err, json) {
            console.log(err, json);
            if (err) {
                callback && callback(err)
                return;
            }
            // 获取用户详情
            api.userGet({
                access_token: token,
                userid: json.userid
            }, function(err, json) {
                callback && callback(err, json);    
            })
        })
    })

}

exports.getUserInfo = getUserInfo;


/**
 * 获取企业授权信息
 * @param {string} cid 企业id auth_corpid
 * @param {string} code 永久授权码permanent_code
 * @returns {undefined} 描述
 **/
function getAuthInfo(cid, callback) {
    console.log('=======获取企业授权信息=======')
    var corpInfo = storage.getCorp(cid) || {};
    var code = corpInfo.code;

    isv.getAuthInfo({
        suite_key: isv.config.suiteKey,
        auth_corpid: cid,
        permanent_code: code
    }, function(err, json) {
        if (err) {
            console.log('获取授权信息出错', cid, err, json);
            callback && callback(err);
            return;
        }
        console.log(err, json)
        callback && callback(err, json);
    })
}

exports.getAuthInfo = getAuthInfo;

/**
 * 获取企业的应用信息
 * @param {string} cid 企业id auth_corpid
 * @param {string} code 永久授权码permanent_code
 * @returns {undefined} 描述
 **/
function getAgentInfo(cid, agentid, callback) {
    console.log('=======获取企业应用信息========')
    var corpInfo = storage.getCorp(cid) || {};
    var code = corpInfo.code;

    isv.getAgent({
        suite_key: isv.config.suiteKey,
        auth_corpid: cid,
        permanent_code: code,
        agentid: agentid
    }, function(err, json) {
        if (err) {
            callback && callback(err);
            return;
        }
        cosnole.log(err, json);
        callback && callback(err, json);

        var close = json.close; // 0 禁用 1 正常 2待激活
        if (close === 2) {
            //activateSuite(cid);
        }

    })
}

exports.getAgentInfo = getAgentInfo

/**
 * 设置白名单
 * @param {string} cid 企业id auth_corpid
 * @param {array} ips 白名单ip列表 格式["1.2.3.4","5.6.*.*"]
 * @returns {返回值类型} 描述
 **/

function setCorpIpwhitelist(cid, ips) {
    isv.setCorpIpwhitelist({
        auth_corpid: cid,
        ip_whitelist: ips
    }, function(err, json) {
        cosnole.log(err, json);
    })
}

exports.setCorpIpwhitelist = setCorpIpwhitelist;