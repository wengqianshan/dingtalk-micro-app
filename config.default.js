module.exports = {
    isv: {
        token: 'xxx', //创建套件时自定义的token
        encodingAESKey: 'xxxxx', //创建套件时填写的加密秘钥
        suiteKey: 'xxxxxx', //套件key，当还没有创建套件时，请留空
        suiteSecret: 'xxxxx', //套件secret，创建套件后才有，当还没有创建套件时可留空，创建成功后需要更新该值
        suiteTicket: '' // 获取套件token的时候是需要ticket的，请务必在调用接口前先拿到ticket，如果是首次使用，该值为空，需要在拿到推送ticket后保存该值，后续访问需要自行维护ticket
    }
}



