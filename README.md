## 钉钉微应用开发大赛

### 目录和文件介绍
- db/ 持久存储目录，因为开发阶段不想使用数据库，就暂时用文件做持久化存储，便于数据迁移
- libs/ 功能库目录
  - sdk.js 封装的isv sdk，用来调用isv api、处理服务端推送的消息、签名jsapi_ticket
- public/ 静态文件目录，如css js文件
- routes/ 路由目录，主功能代码也在这个目录，后面会提出来
  - admin.js 预留的后台管理路由
  - index.js 微应用路由
  - service.js isv功能调用、授权码生命周期管理等服务
  - storage.js 数据存取
- views/ 模板目录
- ./config.default.js 配置文件模板，需要改为config.js才可使用
- ./app.js nodejs配置目录

### 使用方法

> 使用前请先注册钉钉ISV开发者 http://g.alicdn.com/dingding/opendoc/docs/_isvguide/tab2.html?t=1467087383585

1. ``config.defaults.js`` 改为``config.js``并配置 token、encodingAESKey
2. 在根目录下执行 ``npm start`` 启动服务
3. 创建套件并确保``token``、``加密秘钥``和``config.js``中配置一致；IP白名单即服务器IP；回调URL为 ``http://服务器IP:8808/app/isvreceive``
4. 点击验证
5. 验证通过后可以拿到``suiteKey``和``suiteSecret``，更新``config.js``中的这两个配置，重启服务
6. 创建微应用，微应用地址 ``http://服务器IP:8808/app``
