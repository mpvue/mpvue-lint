function trace(Vue){
    function getVmData (vm) {
        // 确保当前 vm 所有数据被同步
        var dataKeys = [].concat(
            Object.keys(vm._data || {}),
            Object.keys(vm._props || {}),
            Object.keys(vm._mpProps || {}),
            Object.keys(vm._computedWatchers || {})
        );
        return dataKeys.reduce(function (res, key) {
            res[key] = vm[key];
            return res
        }, {})
    }

    function getComKey (vm) {
        return vm && vm.$attrs ? vm.$attrs['mpcomid'] : '0'
    }function getParentComKey (vm, res) {
        if ( res === void 0 ) res = [];

        var ref = vm || {};
        var $parent = ref.$parent;
        if (!$parent) { return res }
        res.unshift(getComKey($parent));
        if ($parent.$parent) {
            return getParentComKey($parent, res)
        }
        return res
    }

    function formatVmData (vm) {
        var $p = getParentComKey(vm).join(',');
        var $k = $p + ($p ? ',' : '') + getComKey(vm);

        // getVmData 这儿获取当前组件内的所有数据，包含 props、computed 的数据
        // 改动 vue.runtime 所获的的核心能力
        var data = Object.assign(getVmData(vm), { $k: $k, $kk: ($k + ","), $p: $p });
        var key = '$root.' + $k;
        var res = {};
        res[key] = data;
        return res
    }

    let fun = Vue.prototype.$updateDataToMP;

    let timer = 0; //计时器
    let updateDataTotal = 0; //总共更新的数据量

    Vue.prototype.$updateDataToMP = function(){
        var data = formatVmData(this);
        var updateData = JSON.stringify(data)
        if(!timer){
            timer = setTimeout(function(){
                clearTimeout(timer);
                updateDataTotal = (updateDataTotal/1024).toFixed(1)
                console.log('这次操作引发500ms内数据更新量:'+updateDataTotal+'kb')
                timer = 0;
                updateDataTotal = 0;
            },500)
        }else if(timer){
            updateData = updateData.replace(/[^\u0000-\u00ff]/g,"aa") //中文占2字节，中文替换成两个字母计算占用空间
            updateDataTotal+=updateData.length
        }
        fun.call(this);
    }
}


module.exports={
    trace:trace
}
