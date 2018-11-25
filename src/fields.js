const { Util } = require('wood-util')();
const fieldType = ['Number', 'String', 'Boolean', 'Array', 'Object', 'Date', 'Virtual'];

class Fields {
  constructor(opts = {}){
    this.fieldMap = {};
    this.data = opts;
    this._init();
  }

  _init() {
    let that = this;
    function loopData(fields, parentKey) {
      for (let key in fields) {
        let field = fields[key],
          alias = parentKey ? `${parentKey}.${key}` : key;
        if (field == undefined) continue;
        if (typeof field === 'object') {
          if (!fieldType.includes(field.type)) {
            if(field instanceof Fields){
              fields[key] = loopData(field.data, alias);
            }else{
              loopData(fields[key], alias);
            }
          } else {
            fields[key] = that._defaultValue(field);
            fields[key].alias = alias;
          }
        } else {
          fields[key] = that._defaultValue(field);
          fields[key].alias = alias;
        }
        if (fields[key].alias) that.fieldMap[fields[key].alias] = fields[key];
      }
      return fields;
    }
    loopData(this.data);
  }

  //默认值
  _defaultValue(value) {
    let newValue = { type: Array.isArray(value) ? 'Array' : Util.firstUpperCase(typeof value) },
      defaultValue = '';
    if (typeof value === 'function') {
      newValue.type = Util.firstUpperCase(value.name.toString());
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      defaultValue = value.default;
      Object.assign(newValue, value);
    }
    switch (newValue.type) {
      case 'Number':
        newValue.default = defaultValue || (value.required ? NaN : 0);
        break;
      case 'String':
        newValue.default = defaultValue || '';
        break;
      case 'Boolean':
        newValue.default = defaultValue || false;
        break;
      case 'Array':
        newValue.default = defaultValue || [];
        break;
      case 'Object':
        newValue.default = defaultValue || {};
        break;
      case 'Date':
        newValue.default = defaultValue || new Date();
        break;
      case 'Virtual':
        newValue.default = defaultValue || '';
        break;
    }
    return newValue;
  }

  _showError(errObj){
    switch(errObj.type){
      case 'required':
        errObj.msg += `, [${errObj.name}]不能为空`;
        break;
      case 'type':
        errObj.msg += `, [${errObj.name}]数据类型不是${errObj.dataType}类型`;
        break;
    }
    return errObj;
  }

  _validateError(key, field) {
    let errObj = Util.deepCopy(WOOD.config.errorCode.error_validation);
    errObj.name = field.alias;
    errObj.dataType = field.type;
    if (typeof field === 'object') {
      let value = field.value !== undefined ? field.value : field.default;
      // 验证是否空值
      if (field.required) {
        errObj.type = 'required';
        if (value === undefined) return this._showError(errObj);
        if (typeof value === 'number' && value !== 0 && !value) return this._showError(errObj);
        if (typeof value === 'string' && value == '') return this._showError(errObj);
        if (typeof value === 'object' && Util.isEmpty(value)) return this._showError(errObj);

        // 验证数据类型
        if (field.type && field.type !== 'Virtual') {
          errObj.type = 'type';
          if (field.type === 'Date' && !(value instanceof Date)) return this._showError(errObj);
          if (Array.isArray(value)) {
            if(field.type !== 'Array') return this._showError(errObj);
          }else{
            if (typeof value !== field.type.toLowerCase()) return this._showError(errObj);
          }
        }
      }
      //自定义验证  param: value
      if (field.validator) {
        if (typeof field.validator === 'function') {
          let hasErr = field.validator(value);
          if (hasErr) {
            errObj = hasErr.error ? hasErr.error : {...errObj, msg: errObj.msg += `, ${hasErr}` };
            return this._showError(errObj);
          }
        }
      }
    }
    return false;
  }

  // 验证字段
  validate() {
    let that = this;
    function loopData(fields) {
      let hasErr = false;
      for (let key in fields) {
        let field = fields[key];
        if (!fieldType.includes(field.type)) {
          hasErr = loopData(field);
        } else {
          hasErr = that._validateError(key, field);
        }
        if (hasErr) break;
      }
      return hasErr;
    }
    return loopData(this.data);
  }

  // 重置数据
  resetData(){
    function loopData(fields, parentData) {
      if (!Util.isEmpty(fields)) {
        for (let key in fields) {
          let field = fields[key];
          if (typeof field == 'object') {
            if (!fieldType.includes(field.type)) {
              parentData[key] = loopData(field, Array.isArray(field) ? [] : {});
            } else {
              let theVal = field.default;
              parentData[key] = theVal;
            }
          } else if (typeof field !== 'function') {
            parentData[key] = field;
          }
        }
      }
      return parentData;
    }
    loopData(this.data, {});
  }

  // 设置模型数据
  setData(target) {
    let fields = this.data;
    if (typeof target === 'object' && !Array.isArray(target)) {
      if (!Util.isEmpty(target)) {
        function loopData(_fields, data) {
          for (let key in _fields) {
            let _value = data[key];
            if (_value == undefined) continue;
            if (!fieldType.includes(_fields[key].type)) {
              if(Array.isArray(_value) && Array.isArray(_fields[key])){
                let newArr = [];
                _value.forEach((item, index) => {
                  let tempField = Util.deepCopy(_fields[key][0]);
                  for(let subKey in tempField){
                    tempField[subKey].alias = tempField[subKey].alias.replace(`${key}.0`, `${key}.${index}`);
                  }
                  newArr.push(loopData(tempField, item));
                });
                _fields[key] = newArr;
              }else{
                loopData(_fields[key], _value);
              }
            } else {
              _fields[key].value = _value;
            }
          }
          return _fields;
        }
        loopData(fields, target);
      }
    }
  }

  // 获取模型数据
  getData(hasVirtualField = true) {
    function loopData(fields, parentData) {
      if (!Util.isEmpty(fields)) {
        for (let key in fields) {
          let field = fields[key];
          if (!hasVirtualField && field.type === 'Virtual') continue;
          if (typeof field == 'object') {
            if (!fieldType.includes(field.type)) {
              parentData[key] = loopData(field, Array.isArray(field) ? [] : {});
            } else {
              let theVal = field.value || field.default;
              parentData[key] = theVal;
            }
          } else if (typeof field !== 'function') {
            parentData[key] = field;
          }
        }
      }
      return parentData;
    }
    return loopData(this.data, {});
  }
}

module.exports = Fields;
