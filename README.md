# mpvue-lint
#美团内部使用方法 mnpm install @waimai/mpvue-lint
构建流中调用，传入entry(array) ,
要检查的入口Vue文件 
```javascript
const mpvueLint = require('@waimai/mpvue-lint') 
mpvueLint.build(
{ 
	entry:
	[ path.resolve('mpvue/page/worldcup/home/index.vue'), 
	path.resolve('mpvue/page/worldcup/card_detail/index.vue'), 
	path.resolve('mpvue/page/worldcup/activity_rules/index.vue') 
	] 
})
```
如果有引用路径的错误，会报白色提示 如果有template错误，比如组件上用class,绑定click事件等会报错误名，文件名，和组件名 如果Vue文件方法里有写法错误，如使用zepto,window,document等，会报错误名，文件名，方法名，行号 如果想自定义需要报错的函数调用，请按照**mpvuelint.json**里的格式添加你的函数名，例如,"knb":true会在 vue文件中所有调用knb的地方报错提醒
lint检查非强制，FE同学自己根据提醒修改业务代码

# mpvue-trace
debug时跟踪数据变动的模块
# 用法
在mpvue/你的工作目录/你的页面目录/main.js中加入如下引用
```javascript
const mpvueTrace = require('@waimai/mpvue-lint/mpvue-trace')
mpvueTrace.trace(Vue); //Vue是当前页面中的Vue实例
```
调试mpvue页面时，如果触发了数据更新，console控制台会输出这次操作500ms内引发的所有数据更新的大小，
帮助FE同学观察页面数据变化，通过优化减少数据变动提高页面性能
# 使用注意！
上面的调试代码会监听Vue.$updateDataToMP方法并把更新数据转字符串计算大小，会有一定性能损耗，
仅做调试trace用，上线代码一定要去除。