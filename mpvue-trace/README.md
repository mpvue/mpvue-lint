# mpvue-lint
#美团内部使用方法 mnpm install @waimai/mpvue-trace
在你的mpvue页面代码,main.js中加入如下引用
```javascript
const mpvueTrace = require('@waimai/mpvue-lint/mpvue-trace')
mpvueTrace.trace(Vue)
```
这样每次你触发Vue更新都会报告更新数据量，通过减少更新数据大小，减轻setData负担，可以
帮助优化页面性能，找出渲染瓶颈.

注意计算update大小过程本身也会有损耗，所以调试使用，线上一定要注意删除trace