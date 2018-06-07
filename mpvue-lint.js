const fs = require('fs');
const babylon = require('babylon');
const path = require('path')

const templateLint = require('./mpvue-template-lint')

const pathList = [];//需要遍历的文件列表

let illegalGrammaMap;


try{
  let filePath = path.join(__dirname, './mpvuelint.json')
  let mplint = fs.readFileSync(filePath).toString();
  illegalGrammaMap = JSON.parse(mplint);
}catch(e){
  console.log(e)
  console.log('.mpvuelint 读取失败，使用语法检查')
  illegalGrammaMap = {
    'document':1,
    'window':1,
    'history':1,
    'location':1,
    'webviewAPI':1,
    '$':1,
    'zepto':1
  }
}


class MpVueLint {
  constructor(sourcePath = '',scriptLineNumber = 0){
    this.scriptLineNumber = scriptLineNumber;
    this.sourcePath = sourcePath;
  }
  build(options) {
    pathList.push(path)
    options.entry.forEach((path) => {
      if(/\.vue/.test(path) && fs.existsSync(path)){

        const content = fs.readFileSync(path).toString();

        new MpVueLint(path,0).templateRead(content,'vue');

      }else if(/\.js/.test(path) && fs.existsSync(path)){

        const content = fs.readFileSync(path).toString();

        new MpVueLint(path,0).templateRead(content,'js');

      }else if(fs.existsSync(path+'.js')){
        //第一次从入口中解析到import a.js, 把a.js加入入口列表并预编译
        //第二次发现a.js已经解析过，跳过这步防止重复预编译
        if(!( (path+'.js') in pathList)){
          pathList.push(path+'.js')
          this.build({
            entry:[path+'.js']
          })
        }
      }else if(fs.existsSync(path+'.vue')){
        //第一次从入口中解析到import a.vue, 把a.vue加入入口列表并预编译
        //第二次发现a.js已经解析过，跳过这步防止重复预编译
        if(!( (path+'.vue') in pathList)){
          pathList.push(path+'.vue')
          this.build({
            entry:[path+'.vue']
          })
        }
      }
    },this);
  }
  templateRead(content,fileType) {
    let jsCode
    if(fileType === 'vue'){
      const inlinejs = content.match(/(<script[^>]*?>)([\s\S]*?)(<\/script>)/i);

      const codeBeforeScript = content.split(/(<script[^>]*?>)([\s\S]*?)(<\/script>)/i);
      this.scriptLineNumber = 0; //<script>表达式开始的行号，用于后续标注行号用
      if(codeBeforeScript && codeBeforeScript[0]){
        this.scriptLineNumber = codeBeforeScript[0].match(/\n/g).length
      }
      jsCode = inlinejs[2];
      templateLint.build(content,this.sourcePath);
    }else if(fileType === 'js'){
      jsCode = content;
    }
    this.codeToAst(jsCode,fileType);
  }
  codeToAst(code,fileType) {
    const astTree = babylon.parse(code, {
      sourceType: 'module',
    });
    try {
      if(fileType === 'vue'){
        const body = astTree.program.body;
        body.forEach((item) => {
          if (item.type === 'ExportDefaultDeclaration') {
            this.rebuildVueMethods(item);
          }else if (item.type === 'ImportDeclaration'){
            this.resolveImport(item);
          }
        },this);
      }else if(fileType === 'js'){
        this.foreachBody(astTree.program.body, 'in JS file');
      }
    } catch (e) {
      console.log(e);
    }
  }
  rebuildVueMethods(exportCode) {
    try {
      exportCode.declaration.properties.forEach((item) => {
        if (item.key.name === 'methods') {
          this.buildVueMethods(item);
        }else if(item.key.name === 'created' || item.key.name === 'mounted'){
          if (item.type === 'ObjectProperty' && item.value.body) {
            this.foreachBody(item.value.body.body, item.key.name);
          } else if (item.type === 'ObjectMethod') {
            this.foreachBody(item.body.body, item.key.name);
          }
        }
      },this);
    } catch (e) {
      console.log(e);
    }
  }
  buildVueMethods(AstNode) {
    if (AstNode.value && AstNode.value.properties) {
      AstNode.value.properties.forEach((item) => {
        if (item.type === 'ObjectProperty' && item.value.body) {
          this.foreachBody(item.value.body.body, item.key.name);
        } else if (item.type === 'ObjectMethod') {
          this.foreachBody(item.body.body, item.key.name);
        }
      },this);
    }
  }

//源码遍历扫描方法
  IdentifierErrorLog(callee,property,methodName){
    //检测上报非法代码
    if (callee.name in illegalGrammaMap){
      if (property) {
        console.log('\x1b[31m%s\x1b[39m', `${callee.name}.${property.name} ()not support in miniProgram`);
      } else {
        console.error('\x1b[31m%s\x1b[39m', `${callee.name} ()not support in miniProgram`);
      }
      console.error('\x1b[31m%s\x1b[39m', `error in ${this.sourcePath}`);
      console.error('\x1b[31m%s\x1b[39m', `line number: ${callee.loc.start.line+this.scriptLineNumber}`);
      console.error('\x1b[31m%s\x1b[39m', `method name: ${methodName} ()`);
    }else if(property && property.name in illegalGrammaMap){
      console.log('\x1b[31m%s\x1b[39m', `${callee.name}.${property.name} ()not support in miniProgram`);
      console.error('\x1b[31m%s\x1b[39m', `error in ${this.sourcePath}`);
      console.error('\x1b[31m%s\x1b[39m', `line number: ${callee.loc.start.line+this.scriptLineNumber}`);
      console.error('\x1b[31m%s\x1b[39m', `method name: ${methodName} ()`);
    }
  }

  recruiseFuncExpression(callee, property, methodName) {
    if (callee.type === 'Identifier' || (property && property.type === 'Identifier')) {
      //函数调用体或者member属性都要检查名称，如果是禁用API 报错
      this.IdentifierErrorLog(callee,property,methodName)
    } else if (callee.type === 'CallExpression') {
      // $(winodw).on 多层函数调用，递归
      this.recruiseFuncExpression(callee.callee, callee.property, methodName);
    } else if (callee.type === 'MemberExpression') {
      // webviewAPI.init() 对象方法调用
      this.recruiseFuncExpression(callee.object, callee.property, methodName);
    }
  }

  recruiseExpressionStatement(item,methodName){
    if (item.expression.type === 'CallExpression') {
      //函数调用
      this.recruiseFuncExpression(
        item.expression.callee,
        null,
        methodName);
    }else if(item.expression.type === "AssignmentExpression"){
      //赋值
      this.recruiseAssignmentExpression(item.expression,methodName);
    }
  }

  recruiseAssignmentExpression (item,methodName){
    this.recruiseFuncExpression(item.left,null,methodName)
    this.recruiseFuncExpression(item.right,null,methodName)
  }

  recruiseIFExpression(item,methodName){
    if(item.consequent && item.consequent.type === 'BlockStatement'){
      this.foreachBody(item.consequent.body,methodName)
    }
    if(item.alternate && item.alternate.type === 'BlockStatement'){
      this.foreachBody(item.alternate.body,methodName)
    }else if(item.alternate && item.alternate.type === 'IfStatement'){
      this.recruiseIFExpression(item.alternate,methodName)
    }
  }

  foreachBody(body, methodName){
    if (body) {
      body.forEach((item) => {
        if(item.type === 'IfStatement'){
          // if 语句
          this.recruiseIFExpression(item,methodName)
        }else if(item.type === 'ExpressionStatement'){
          //一般表达式
          this.recruiseExpressionStatement(item,methodName);
        }
      });
    }
  }

  resolveImport(AstNode){
    //遍历检查依赖文件中的js语法
    this.build({
      entry:[
        path.resolve(this.sourcePath,'../',AstNode.source.value) //文件中的相对路径，变成绝对路径
      ]
    })
  }
}

module.exports ={
  build:function(option){
    console.log('----开始预处理mpvue组件----');
    var MpVueLintObj = new MpVueLint()
    MpVueLintObj.build(option);
    console.log('----预处理mpvue组件完成----');
  }
}

