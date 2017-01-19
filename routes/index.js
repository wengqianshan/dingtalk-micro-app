var url = require('url');
var express = require('express');
var router = express.Router();
var _ = require('lodash');
var service = require('./service');


/**
 * 接收服务端推送
 **/
router.all('/isvreceive', function(req, res) {
    if (req.method === 'GET') {
        return res.send('aloha');
    }
    var result = service.receive(req.body);
    res.json(result.result)
});


/**
 * 微应用首页
 **/
router.get('/', function(req, res, next) {
    var cid = req.query.corpid;
    var appid = req.query.appid;

    if (!cid) {
        return res.send('没有企业id');
    }
    var _url = url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: req.originalUrl
    }).replace(/%3F/g, '?');
    
    service.signTicket(cid, {
        url: _url
    }, function(err, json) {
        if (err || !json) {
            return res.render('index', {
                msg: '获取jsticket出错'
            });
        }
        service.getAuthInfo(cid, function(err, json2) {
            if (err || !json2) {
                res.render('index', {
                    msg: '成功',
                    data: json
                })
                return;
            }
            var agent = json2.auth_info.agent;
            var agentId = '';
            for (var i = 0, len = agent.length; i < len; i++) {
                if ((appid + '') === (agent[i]['appid'] + '')) {
                    agentId = agent[i]['agentid'] + '';
                    break;
                }
            }
            res.render('index', {
                msg: '成功',
                data: _.assign(json, {
                    agentId: agentId,
                    corpId: cid
                }),
                auth: json2
            })
        })
    })

});

router.get('/userinfo', function(req, res) {
    var cid = req.query.corpId
    var code = req.query.code;
    service.getUserInfo(cid, code, function(err, json) {
        if (err || !json) {
            return res.json({
                success: false,
                data: null,
                error_msg: err
            })
        }
        res.json({
            success: true,
            data: json
        });
    })
})

module.exports = router;