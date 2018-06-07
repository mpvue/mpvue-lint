const vuecompiler = require('vue-template-compiler')
const babylon = require('babylon');
const fs = require('fs');
const path = require('path')

class TemplateBuild {

   constructor(sourcePath){
      this.sourcePath = sourcePath;
   }
   templateRead(content){
     try {
       var SFCObj = vuecompiler.parseComponent(content)
       if(!SFCObj.template || !SFCObj.script){
         return;
       }
       this.compile(SFCObj.template.content,SFCObj.script.content)
     }catch (e){
       console.log(e)
     }

   }
   compile(template,script){
     try{
     let templateAst = vuecompiler.compile(template)
     // 模版语法树 存到this 备用
     this.templateAst = templateAst.ast;

     let astTree = babylon.parse(script, {
       sourceType: 'module',
     });

       const body = astTree.program.body;
       body.forEach((item) => {
         if (item.type === 'ExportDefaultDeclaration') {
            this.searchVueComponents(item)
         }else if (item.type === 'ImportDeclaration'){
           if(/\.vue/.test(item.source.value)){
             //文件路径直接定义.vue才会进入递归搜索 否则忽略
             this.resolveImport(item);
           }
         }
       },this);
     }catch (e){
       console.log(e)
     }

   }

  searchVueComponents(exportCode) {
    //查找vue export代码里的组件名称，配合template AST来标注组件上的错误用法
    try {
      exportCode.declaration.properties.forEach((item) => {
        if (item.key.name === 'components') {
          this.searchVueTemplate(this.templateAst,item.value.properties)
        }
      },this);
    } catch (e) {
      console.log(e);
    }
  }

  searchVueTemplate(AST,componentsList){
    //根据传入的vue组件名列表
    componentsList.forEach((componentAST)=>{
        if(componentAST.key.name == AST.tag){
            this.vueTemplateASTLint(AST)
        }
    })
    if(AST.children instanceof Array){
      AST.children.forEach((item)=>{
        this.searchVueTemplate(item,componentsList)
      })
    }
  }

  vueTemplateASTLint(componentAST){
    //模版中的组件节点在这里进行检查
    if(componentAST.directives && componentAST.directives.length>0){
      componentAST.directives.forEach((item)=>{
        if(item.name == 'show'){
          this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上使用v-show指令，用v-if替代')
        }
      })
    }
    if(componentAST.classBinding){
      this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上使用样式绑定')
    }
    if(componentAST.staticClass){
      this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上使用样式')
    }
    if(componentAST.staticStyle){
      this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上使用内联样式')
    }
    if(componentAST.styleBinding){
      this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上使用样式绑定')
    }
    if(componentAST.events && Object.keys(componentAST.events).length>0){
      ['click','touchstart','touchend','touchmove','input','focus','submit'].forEach((key)=>{
        if(componentAST.events[key]){
          this.IdentifierErrorLog('mpvue不支持在自定义' + componentAST.tag + '组件上绑定' + key + '事件')
        }
      })
    }

  }

  resolveImport(AstNode){
    //遍历检查依赖文件中的vue template语法
    try {
      const filePath = path.resolve(this.sourcePath,'../',AstNode.source.value) //文件中的相对路径，变成绝对路径
      const content = fs.readFileSync(filePath).toString();
      let templateBuild = new TemplateBuild(filePath);
      templateBuild.templateRead(content)
    }catch (e){
      console.log(e)
    }
  }


  IdentifierErrorLog(error){
    //检测上报非法代码
      console.error('\x1b[31m%s\x1b[39m', `error in ${this.sourcePath}`);
      console.error('\x1b[31m%s\x1b[39m', error);
  }
}

module.exports ={
  build:function(content,sourcePath){
    let templateBuild = new TemplateBuild(sourcePath);
    templateBuild.templateRead(content)
  }
}
