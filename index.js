/**
 * Wood Plugin Module.
 * 数据模型字段类
 * by jlego on 2018-11-18
 */
const Fields = require('./src/fields');

module.exports = (app = {}, config = {}) => {
  app.Fields = Fields;
  if(app.addAppProp) app.addAppProp('Fields', app.Fields);
  return app;
}
