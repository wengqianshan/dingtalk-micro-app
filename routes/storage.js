//持续存储临时方案
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var dbFile = path.resolve(__dirname, '../db/db.json');
var ticketFile = path.resolve(__dirname, '../db/ticket.json');


function fsExistsSync(path) {
    try{
        fs.readFileSync(path, 'utf8');
    }catch(e){
        return false;
    }

    return true;
}

if (!fsExistsSync(ticketFile)) {
    console.log('ticketFile不存在', ticketFile)
    fs.writeFileSync(ticketFile, '', 'utf8');
}

if (!fsExistsSync(dbFile)) {
    console.log('dbFile不存在', dbFile)
    fs.writeFileSync(dbFile, '', 'utf8')
}

//存储企业信息：永久授权码、ticket
exports.setCorp = function (json) {
    console.log('准备写入企业信息', json)

    var data = getCorp();

    var loaded = false;

    var savedList = data.map(function(item) {
        if (item.id === json.id) {
            loaded = true;
            return _.assign(item, json);
        } else {
            return item;
        }
    });

    var result;

    if (loaded) {
        result = savedList;
    } else {
        result = data.concat(json);
    }
    fs.writeFileSync(dbFile, JSON.stringify(result, null, 4), 'utf8')
}

//读取企业信息
function getCorp (cid) {
    var result = [];
    var text = fs.readFileSync(dbFile, 'utf8');
    result = text ? JSON.parse(text) : [];
    if (cid) {
        result = result.filter(function(item) {
            return item.id === cid
        })[0];
    }

    return result;
}

exports.getCorp = getCorp;

//保存suiteTicket，即20分钟推送一次的tickt
exports.setTicket = function (ticket) {
    fs.writeFileSync(ticketFile, ticket, 'utf8')
}

//读取suiteTicket
exports.getTicket = function () {
    return fs.readFileSync(ticketFile, 'utf8');
}