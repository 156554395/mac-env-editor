/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
// 状态管理
const envVars = ref([]);
const originalEnvVars = ref([]);
const shellInfo = ref(null);
const loading = ref(false);
const saving = ref(false);
const viewType = ref('all');
const selectedCategory = ref('all');
// 分类定义
const categories = ref([
    { name: 'all', color: '#409eff', prefix: '' },
    { name: '环境变量', color: '#67c23a', prefix: '' },
    { name: '别名', color: '#e6a23c', prefix: 'alias' },
    { name: 'PATH', color: '#f56c6c', prefix: 'PATH' }
]);
// 视图选项
const viewOptions = [
    { label: '全部', value: 'all' },
    { label: '环境变量', value: 'env' },
    { label: '别名', value: 'alias' },
    { label: '源码编辑', value: 'source' }
];
// 获取空状态提示文本
const getEmptyDescription = () => {
    if (!shellInfo.value) {
        return '正在加载Shell信息...';
    }
    if (searchQuery.value) {
        return '没有找到匹配的环境变量';
    }
    switch (viewType.value) {
        case 'all':
            return '当前没有配置任何环境变量';
        case 'env':
            return '当前没有配置任何环境变量';
        case 'alias':
            return '当前没有配置任何别名';
        default:
            return '当前没有配置任何环境变量';
    }
};
// 获取输入框占位符
const getPlaceholder = (type) => {
    switch (type) {
        case 'env':
            return '输入环境变量值';
        case 'alias':
            return '输入别名命令';
        case 'path':
            return '输入路径，多路径用冒号分隔';
        default:
            return '输入值';
    }
};
const error = ref('');
const searchQuery = ref('');
const hasChanges = ref(false);
// 源码编辑相关状态
const sourceContent = ref('');
const originalSourceContent = ref('');
const sourceFileName = ref('');
const sourceFilePath = ref('');
const sourceLoading = ref(false);
const sourceSaving = ref(false);
// 自动保存防抖
let autoSaveTimer = null;
const scheduleAutoSave = () => {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(async () => {
        if (hasChanges.value) {
            console.log('自动保存中...');
            await saveChangesToFile();
        }
    }, 2000); // 2秒后自动保存
};
// 添加变量对话框
const dialogVisible = ref(false);
const varForm = ref();
const newVar = reactive({
    key: '',
    value: '',
    type: 'env'
});
const rules = {
    key: [{ required: true, message: '请输入变量名', trigger: 'blur' }],
    value: [{ required: true, message: '请输入变量值', trigger: 'blur' }]
};
// 计算属性
const showTypeSelector = computed(() => {
    return viewType.value === 'all' && selectedCategory.value === 'all';
});
const getDialogTitle = () => {
    if (newVar.type === 'alias') {
        return '添加别名';
    }
    else {
        return '添加环境变量';
    }
};
const getKeyLabel = () => {
    return newVar.type === 'alias' ? '别名名称' : '变量名';
};
const getValueLabel = () => {
    return newVar.type === 'alias' ? '别名命令' : '变量值';
};
const getKeyPlaceholder = () => {
    if (newVar.type === 'alias') {
        return '例如: ll';
    }
    else {
        return '例如: PATH';
    }
};
const getValuePlaceholder = () => {
    if (newVar.type === 'alias') {
        return '例如: ls -la';
    }
    else {
        return '例如: /usr/local/bin';
    }
};
const filteredEnvVars = computed(() => {
    let filtered = envVars.value;
    // 根据视图类型过滤
    if (viewType.value === 'env') {
        filtered = filtered.filter(item => item.type === 'env');
    }
    else if (viewType.value === 'alias') {
        filtered = filtered.filter(item => item.type === 'alias');
    }
    // 根据分类过滤
    if (selectedCategory.value !== 'all') {
        if (selectedCategory.value === '环境变量') {
            filtered = filtered.filter(item => item.type === 'env');
        }
        else if (selectedCategory.value === '别名') {
            filtered = filtered.filter(item => item.type === 'alias');
        }
        else if (selectedCategory.value === 'PATH') {
            filtered = filtered.filter(item => item.key.includes('PATH'));
        }
    }
    // 根据搜索查询过滤
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(env => env.key.toLowerCase().includes(query) ||
            env.value.toLowerCase().includes(query));
    }
    return filtered;
});
// 方法定义
const loadData = async () => {
    loading.value = true;
    error.value = '';
    try {
        const [envResult, shellResult] = await Promise.all([
            window.electronAPI.getEnvVars(),
            window.electronAPI.getShellInfo()
        ]);
        if (envResult.success && envResult.data) {
            const envData = envResult.data;
            const parsed = [];
            // 处理环境变量
            Object.entries(envData.env || {}).forEach(([key, value]) => {
                parsed.push({
                    key,
                    value: value,
                    type: 'env',
                    isValid: true,
                    category: key.includes('PATH') ? 'PATH' : '环境变量'
                });
            });
            // 处理别名
            Object.entries(envData.aliases || {}).forEach(([key, value]) => {
                parsed.push({
                    key,
                    value: value,
                    type: 'alias',
                    isValid: true,
                    category: '别名'
                });
            });
            envVars.value = parsed.sort((a, b) => a.key.localeCompare(b.key));
            originalEnvVars.value = JSON.parse(JSON.stringify(parsed));
        }
        else {
            error.value = envResult.error || '加载环境变量失败';
        }
        if (shellResult.success && shellResult.data) {
            shellInfo.value = shellResult.data;
        }
    }
    catch (err) {
        error.value = `加载失败: ${err?.message || String(err)}`;
    }
    finally {
        loading.value = false;
    }
};
const handleRefresh = () => {
    loadData();
};
const handleValueChange = (row) => {
    row.isValid = validateEnvironmentVariable(row.key);
    checkChanges();
    scheduleAutoSave();
};
const handleKeyChange = (row) => {
    // 验证变量名
    row.isValid = isVarNameValid(row.key);
    // 更新分类
    if (row.type === 'env') {
        row.category = row.key.includes('PATH') ? 'PATH' : '环境变量';
    }
    else {
        row.category = '别名';
    }
    checkChanges();
    scheduleAutoSave();
};
const validateEnvironmentVariable = (key) => {
    if (!key || typeof key !== 'string')
        return false;
    const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!keyRegex.test(key))
        return false;
    return true;
};
const isVarNameValid = (name) => {
    return validateEnvironmentVariable(name);
};
const checkChanges = () => {
    const current = JSON.stringify(envVars.value);
    const original = JSON.stringify(originalEnvVars.value);
    hasChanges.value = current !== original;
};
const handleAddConfirm = async () => {
    varForm.value?.validate(async (valid) => {
        if (valid && isVarNameValid(newVar.key)) {
            const category = newVar.type === 'alias'
                ? '别名'
                : newVar.key.includes('PATH')
                    ? 'PATH'
                    : '环境变量';
            // 检查是否已存在
            const existingIndex = envVars.value.findIndex(v => v.key === newVar.key && v.type === newVar.type);
            if (existingIndex !== -1) {
                ElMessage.error('该名称已存在');
                return;
            }
            // 添加到数组
            envVars.value.push({
                key: newVar.key.toUpperCase(),
                value: newVar.value,
                type: newVar.type,
                isValid: true,
                category
            });
            envVars.value.sort((a, b) => a.key.localeCompare(b.key));
            // 自动保存到文件
            await saveChangesToFile();
            dialogVisible.value = false;
            const itemType = newVar.type === 'alias' ? '别名' : '环境变量';
            ElMessage.success(`${itemType}已添加并保存`);
        }
        else {
            ElMessage.error('请输入有效的名称和值');
        }
    });
};
// 统一的保存方法
const saveChangesToFile = async () => {
    try {
        const envData = {
            env: {},
            aliases: {}
        };
        envVars.value.forEach(item => {
            if (item.isValid) {
                if (item.type === 'env') {
                    envData.env[item.key] = item.value;
                }
                else if (item.type === 'alias') {
                    envData.aliases[item.key] = item.value;
                }
            }
        });
        const result = await window.electronAPI.saveEnvVars(envData);
        if (result.success) {
            originalEnvVars.value = JSON.parse(JSON.stringify(envVars.value));
            hasChanges.value = false;
            return true;
        }
        else {
            ElMessage.error(result.error || '保存失败');
            return false;
        }
    }
    catch (err) {
        ElMessage.error(`保存失败: ${err?.message || String(err)}`);
        return false;
    }
};
const handleDelete = async (index) => {
    const item = filteredEnvVars.value[index];
    const itemType = item.type === 'alias' ? '别名' : '环境变量';
    ElMessageBox.confirm(`确定要删除${itemType} "${item.key}" 吗？`, '确认删除', {
        type: 'warning'
    })
        .then(async () => {
        // 从原数组中找到并删除该项
        const originalIndex = envVars.value.findIndex(v => v.key === item.key && v.type === item.type);
        if (originalIndex !== -1) {
            envVars.value.splice(originalIndex, 1);
            checkChanges();
            // 自动保存到文件
            const success = await saveChangesToFile();
            if (success) {
                ElMessage.success(`${itemType}已删除并保存`);
            }
        }
    })
        .catch(() => { });
};
const handleSave = async () => {
    saving.value = true;
    try {
        const success = await saveChangesToFile();
        if (success) {
            ElMessage.success('保存成功');
        }
    }
    finally {
        saving.value = false;
    }
};
const handleBackup = async () => {
    try {
        const result = await window.electronAPI.backupConfig();
        if (result.success) {
            ElMessage.success(`备份成功: ${result.backupPath}`);
        }
        else {
            ElMessage.error(result.error || '备份失败');
        }
    }
    catch (err) {
        ElMessage.error(`备份失败: ${err?.message || String(err)}`);
    }
};
// 分类和视图相关函数
const selectCategory = (category) => {
    selectedCategory.value = category;
};
const getCategoryCount = (categoryName) => {
    if (categoryName === 'all')
        return envVars.value.length;
    if (categoryName === '环境变量') {
        return envVars.value.filter(v => v.type === 'env').length;
    }
    if (categoryName === '别名') {
        return envVars.value.filter(v => v.type === 'alias').length;
    }
    if (categoryName === 'PATH') {
        return envVars.value.filter(v => v.key.includes('PATH')).length;
    }
    return 0;
};
const showAddDialog = () => {
    if (selectedCategory.value === 'all') {
        newVar.type = 'env';
    }
    else {
        newVar.type = selectedCategory.value === '别名' ? 'alias' : 'env';
    }
    newVar.key = '';
    newVar.value = '';
    dialogVisible.value = true;
};
const handleAdd = (type) => {
    newVar.type = type || 'env';
    newVar.key = '';
    newVar.value = '';
    dialogVisible.value = true;
};
// 获取分类图标
const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
        case 'all':
            return '📋';
        case '环境变量':
            return '⚙️';
        case '别名':
            return '🔗';
        case 'PATH':
            return '🛤️';
        default:
            return '📄';
    }
};
// 获取行类名
const getRowClassName = ({ row }) => {
    if (!row.isValid)
        return 'error-row';
    if (row.type === 'alias')
        return 'alias-row';
    if (row.key.includes('PATH'))
        return 'path-row';
    return '';
};
// 添加命令处理
const handleAddCommand = (command) => {
    handleAdd(command);
};
// 获取当前标题
const getCurrentTitle = () => {
    switch (viewType.value) {
        case 'all':
            return '所有环境变量';
        case 'env':
            return '环境变量';
        case 'alias':
            return '别名';
        case 'source':
            return `源码编辑 - ${sourceFileName.value || '配置文件'}`;
        default:
            return '环境变量';
    }
};
// 源码编辑功能
const loadSourceContent = async () => {
    sourceLoading.value = true;
    try {
        const result = await window.electronAPI.getConfigFileContent();
        if (result.success && result.data) {
            sourceContent.value = result.data.content;
            originalSourceContent.value = result.data.content;
            sourceFileName.value = result.data.fileName;
            sourceFilePath.value = result.data.filePath;
        }
        else {
            ElMessage.error(result.error || '加载配置文件失败');
        }
    }
    catch (err) {
        ElMessage.error(`加载失败: ${err?.message || String(err)}`);
    }
    finally {
        sourceLoading.value = false;
    }
};
const saveSourceContent = async () => {
    sourceSaving.value = true;
    try {
        const result = await window.electronAPI.saveConfigFileContent({
            content: sourceContent.value,
            filePath: sourceFilePath.value
        });
        if (result.success) {
            originalSourceContent.value = sourceContent.value;
            ElMessage.success(result.message || '配置文件已保存');
            // 重新加载环境变量数据
            await loadData();
        }
        else {
            ElMessage.error(result.error || '保存失败');
        }
    }
    catch (err) {
        ElMessage.error(`保存失败: ${err?.message || String(err)}`);
    }
    finally {
        sourceSaving.value = false;
    }
};
const handleSourceContentChange = () => {
    // 检查源码是否有变化
    const hasSourceChanges = sourceContent.value !== originalSourceContent.value;
    hasChanges.value = hasSourceChanges;
};
const handleViewTypeChange = () => {
    selectedCategory.value = 'all';
    // 如果切换到源码编辑模式，加载源码内容
    if (viewType.value === 'source') {
        loadSourceContent();
    }
};
// 生命周期
onMounted(() => {
    loadData();
});
onBeforeUnmount(() => {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logo-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "app-title" },
});
if (__VLS_ctx.shellInfo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "shell-info-badge" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "shell-name" },
    });
    (__VLS_ctx.shellInfo.shellName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "config-path" },
    });
    (__VLS_ctx.shellInfo.activeConfig);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-actions" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    type: "info",
    icon: ('Refresh'),
    loading: (__VLS_ctx.loading),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    type: "info",
    icon: ('Refresh'),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.handleRefresh)
};
__VLS_3.slots.default;
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "warning",
    icon: ('FolderOpened'),
    disabled: (!__VLS_ctx.hasChanges),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "warning",
    icon: ('FolderOpened'),
    disabled: (!__VLS_ctx.hasChanges),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.handleBackup)
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    type: "primary",
    icon: ('Check'),
    disabled: (!__VLS_ctx.hasChanges),
    loading: (__VLS_ctx.saving),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    type: "primary",
    icon: ('Check'),
    disabled: (!__VLS_ctx.hasChanges),
    loading: (__VLS_ctx.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.handleSave)
};
__VLS_19.slots.default;
var __VLS_19;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "control-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "view-switcher" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "panel-title" },
});
const __VLS_24 = {}.ElSegmented;
/** @type {[typeof __VLS_components.ElSegmented, typeof __VLS_components.elSegmented, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
    options: (__VLS_ctx.viewOptions),
    size: "large",
}));
const __VLS_26 = __VLS_25({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
    options: (__VLS_ctx.viewOptions),
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onChange: (__VLS_ctx.handleViewTypeChange)
};
var __VLS_27;
if (__VLS_ctx.viewType === 'all') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-filter" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "panel-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-grid" },
    });
    for (const [category] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.viewType === 'all'))
                        return;
                    __VLS_ctx.selectCategory(category.name);
                } },
            key: (category.name),
            ...{ class: "category-card" },
            ...{ class: ({ active: __VLS_ctx.selectedCategory === category.name }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-icon" },
            ...{ style: ({ backgroundColor: category.color }) },
        });
        (__VLS_ctx.getCategoryIcon(category.name));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-info" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "category-name" },
        });
        (category.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "category-count" },
        });
        (__VLS_ctx.getCategoryCount(category.name));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "panel-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-number" },
});
(__VLS_ctx.envVars.filter(v => v.type === 'env').length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-number" },
});
(__VLS_ctx.envVars.filter(v => v.type === 'alias').length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-number" },
});
(__VLS_ctx.envVars.filter(v => v.key.includes('PATH')).length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "main-workspace" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace-toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "workspace-title" },
});
(__VLS_ctx.getCurrentTitle());
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "result-count" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "count-number" },
});
(__VLS_ctx.filteredEnvVars.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-right" },
});
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: "搜索环境变量或别名...",
    ...{ class: "search-input" },
    clearable: true,
    prefixIcon: ('Search'),
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: "搜索环境变量或别名...",
    ...{ class: "search-input" },
    clearable: true,
    prefixIcon: ('Search'),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.ElDropdown;
/** @type {[typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ 'onCommand': {} },
    trigger: "click",
}));
const __VLS_38 = __VLS_37({
    ...{ 'onCommand': {} },
    trigger: "click",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_40;
let __VLS_41;
let __VLS_42;
const __VLS_43 = {
    onCommand: (__VLS_ctx.handleAddCommand)
};
__VLS_39.slots.default;
const __VLS_44 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    type: "primary",
    size: "large",
    icon: ('Plus'),
}));
const __VLS_46 = __VLS_45({
    type: "primary",
    size: "large",
    icon: ('Plus'),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ class: "el-icon--right" },
}));
const __VLS_50 = __VLS_49({
    ...{ class: "el-icon--right" },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.ArrowDown;
/** @type {[typeof __VLS_components.ArrowDown, typeof __VLS_components.arrowDown, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
var __VLS_47;
{
    const { dropdown: __VLS_thisSlot } = __VLS_39.slots;
    const __VLS_56 = {}.ElDropdownMenu;
    /** @type {[typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({}));
    const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    const __VLS_60 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        command: "env",
        icon: ('Setting'),
    }));
    const __VLS_62 = __VLS_61({
        command: "env",
        icon: ('Setting'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    var __VLS_63;
    const __VLS_64 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        command: "alias",
        icon: ('Link'),
    }));
    const __VLS_66 = __VLS_65({
        command: "alias",
        icon: ('Link'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_67.slots.default;
    var __VLS_67;
    var __VLS_59;
}
var __VLS_39;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace-content" },
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-state" },
    });
    const __VLS_68 = {}.ElSkeleton;
    /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        rows: (8),
        animated: true,
    }));
    const __VLS_70 = __VLS_69({
        rows: (8),
        animated: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-text" },
    });
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error-state" },
    });
    const __VLS_72 = {}.ElResult;
    /** @type {[typeof __VLS_components.ElResult, typeof __VLS_components.elResult, typeof __VLS_components.ElResult, typeof __VLS_components.elResult, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        icon: "error",
        title: "加载失败",
        subTitle: (__VLS_ctx.error),
    }));
    const __VLS_74 = __VLS_73({
        icon: "error",
        title: "加载失败",
        subTitle: (__VLS_ctx.error),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    {
        const { extra: __VLS_thisSlot } = __VLS_75.slots;
        const __VLS_76 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_78 = __VLS_77({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        let __VLS_80;
        let __VLS_81;
        let __VLS_82;
        const __VLS_83 = {
            onClick: (__VLS_ctx.handleRefresh)
        };
        __VLS_79.slots.default;
        var __VLS_79;
    }
    var __VLS_75;
}
else if (__VLS_ctx.viewType === 'source') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "source-editor-container" },
    });
    if (__VLS_ctx.sourceLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading-state" },
        });
        const __VLS_84 = {}.ElSkeleton;
        /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            rows: (8),
            animated: true,
        }));
        const __VLS_86 = __VLS_85({
            rows: (8),
            animated: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading-text" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor-toolbar" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "toolbar-left" },
        });
        const __VLS_88 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            type: "info",
            size: "large",
        }));
        const __VLS_90 = __VLS_89({
            type: "info",
            size: "large",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        __VLS_91.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "el-icon-document" },
        });
        (__VLS_ctx.sourceFilePath);
        var __VLS_91;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "toolbar-right" },
        });
        const __VLS_92 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            ...{ 'onClick': {} },
            type: "success",
            icon: ('Check'),
            loading: (__VLS_ctx.sourceSaving),
            disabled: (!__VLS_ctx.hasChanges),
            size: "large",
        }));
        const __VLS_94 = __VLS_93({
            ...{ 'onClick': {} },
            type: "success",
            icon: ('Check'),
            loading: (__VLS_ctx.sourceSaving),
            disabled: (!__VLS_ctx.hasChanges),
            size: "large",
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        let __VLS_96;
        let __VLS_97;
        let __VLS_98;
        const __VLS_99 = {
            onClick: (__VLS_ctx.saveSourceContent)
        };
        __VLS_95.slots.default;
        var __VLS_95;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor-content" },
        });
        const __VLS_100 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onInput': {} },
            modelValue: (__VLS_ctx.sourceContent),
            type: "textarea",
            rows: (20),
            placeholder: "请输入配置文件内容...",
            ...{ class: "source-textarea" },
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onInput': {} },
            modelValue: (__VLS_ctx.sourceContent),
            type: "textarea",
            rows: (20),
            placeholder: "请输入配置文件内容...",
            ...{ class: "source-textarea" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onInput: (__VLS_ctx.handleSourceContentChange)
        };
        var __VLS_103;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor-footer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "footer-info" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "line-count" },
        });
        (__VLS_ctx.sourceContent.split('\n').length);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "char-count" },
        });
        (__VLS_ctx.sourceContent.length);
        if (__VLS_ctx.hasChanges) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "change-indicator" },
            });
        }
    }
}
else if (__VLS_ctx.filteredEnvVars.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
    const __VLS_108 = {}.ElResult;
    /** @type {[typeof __VLS_components.ElResult, typeof __VLS_components.elResult, typeof __VLS_components.ElResult, typeof __VLS_components.elResult, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        icon: "info",
        title: "暂无数据",
        subTitle: (__VLS_ctx.getEmptyDescription()),
    }));
    const __VLS_110 = __VLS_109({
        icon: "info",
        title: "暂无数据",
        subTitle: (__VLS_ctx.getEmptyDescription()),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    __VLS_111.slots.default;
    {
        const { extra: __VLS_thisSlot } = __VLS_111.slots;
        const __VLS_112 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_114 = __VLS_113({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        let __VLS_116;
        let __VLS_117;
        let __VLS_118;
        const __VLS_119 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.viewType === 'source'))
                    return;
                if (!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.showAddDialog();
            }
        };
        __VLS_115.slots.default;
        var __VLS_115;
    }
    var __VLS_111;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "data-table" },
    });
    const __VLS_120 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
        rowClassName: (__VLS_ctx.getRowClassName),
        stripe: true,
        size: "large",
    }));
    const __VLS_122 = __VLS_121({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
        rowClassName: (__VLS_ctx.getRowClassName),
        stripe: true,
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    if (__VLS_ctx.viewType === 'all') {
        const __VLS_124 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
            prop: "type",
            label: "类型",
            width: "120",
            align: "center",
        }));
        const __VLS_126 = __VLS_125({
            prop: "type",
            label: "类型",
            width: "120",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        __VLS_127.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_127.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_128 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "large",
                effect: "dark",
            }));
            const __VLS_130 = __VLS_129({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "large",
                effect: "dark",
            }, ...__VLS_functionalComponentArgsRest(__VLS_129));
            __VLS_131.slots.default;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: (row.type === 'env' ? 'el-icon-setting' : 'el-icon-link') },
            });
            (row.type === 'env' ? 'ENV' : 'ALIAS');
            var __VLS_131;
        }
        var __VLS_127;
    }
    const __VLS_132 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        prop: "key",
        label: "名称",
        width: "250",
    }));
    const __VLS_134 = __VLS_133({
        prop: "key",
        label: "名称",
        width: "250",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_135.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "key-cell" },
        });
        const __VLS_136 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
            ...{ 'onInput': {} },
            modelValue: (row.key),
            ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(row.key) }) },
            placeholder: "变量名称",
            size: "large",
            ...{ class: "key-input" },
        }));
        const __VLS_138 = __VLS_137({
            ...{ 'onInput': {} },
            modelValue: (row.key),
            ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(row.key) }) },
            placeholder: "变量名称",
            size: "large",
            ...{ class: "key-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_137));
        let __VLS_140;
        let __VLS_141;
        let __VLS_142;
        const __VLS_143 = {
            onInput: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.viewType === 'source'))
                    return;
                if (!!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.handleKeyChange(row);
            }
        };
        var __VLS_139;
    }
    var __VLS_135;
    const __VLS_144 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        prop: "value",
        label: "值",
    }));
    const __VLS_146 = __VLS_145({
        prop: "value",
        label: "值",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_147.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_148 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid-input': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
            size: "large",
        }));
        const __VLS_150 = __VLS_149({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid-input': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
            size: "large",
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        let __VLS_152;
        let __VLS_153;
        let __VLS_154;
        const __VLS_155 = {
            onInput: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.viewType === 'source'))
                    return;
                if (!!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.handleValueChange(row);
            }
        };
        var __VLS_151;
    }
    var __VLS_147;
    const __VLS_156 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        width: "120",
        label: "操作",
        align: "center",
    }));
    const __VLS_158 = __VLS_157({
        width: "120",
        label: "操作",
        align: "center",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_159.slots;
        const [{ $index }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_160 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            ...{ 'onClick': {} },
            type: "danger",
            size: "large",
            icon: ('Delete'),
            text: true,
        }));
        const __VLS_162 = __VLS_161({
            ...{ 'onClick': {} },
            type: "danger",
            size: "large",
            icon: ('Delete'),
            text: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        let __VLS_164;
        let __VLS_165;
        let __VLS_166;
        const __VLS_167 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.viewType === 'source'))
                    return;
                if (!!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.handleDelete($index);
            }
        };
        __VLS_163.slots.default;
        var __VLS_163;
    }
    var __VLS_159;
    var __VLS_123;
}
const __VLS_168 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.getDialogTitle()),
    width: "600px",
    showClose: (false),
    ...{ class: "add-dialog" },
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.getDialogTitle()),
    width: "600px",
    showClose: (false),
    ...{ class: "add-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    ref: "varForm",
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    labelWidth: "120px",
    size: "large",
}));
const __VLS_174 = __VLS_173({
    ref: "varForm",
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    labelWidth: "120px",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
/** @type {typeof __VLS_ctx.varForm} */ ;
var __VLS_176 = {};
__VLS_175.slots.default;
if (__VLS_ctx.showTypeSelector) {
    const __VLS_178 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
        label: "类型",
        prop: "type",
    }));
    const __VLS_180 = __VLS_179({
        label: "类型",
        prop: "type",
    }, ...__VLS_functionalComponentArgsRest(__VLS_179));
    __VLS_181.slots.default;
    const __VLS_182 = {}.ElRadioGroup;
    /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
    // @ts-ignore
    const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
        modelValue: (__VLS_ctx.newVar.type),
        size: "large",
    }));
    const __VLS_184 = __VLS_183({
        modelValue: (__VLS_ctx.newVar.type),
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_183));
    __VLS_185.slots.default;
    const __VLS_186 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
        value: "env",
    }));
    const __VLS_188 = __VLS_187({
        value: "env",
    }, ...__VLS_functionalComponentArgsRest(__VLS_187));
    __VLS_189.slots.default;
    var __VLS_189;
    const __VLS_190 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
        value: "alias",
    }));
    const __VLS_192 = __VLS_191({
        value: "alias",
    }, ...__VLS_functionalComponentArgsRest(__VLS_191));
    __VLS_193.slots.default;
    var __VLS_193;
    var __VLS_185;
    var __VLS_181;
}
const __VLS_194 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
    label: (__VLS_ctx.getKeyLabel()),
    prop: "key",
}));
const __VLS_196 = __VLS_195({
    label: (__VLS_ctx.getKeyLabel()),
    prop: "key",
}, ...__VLS_functionalComponentArgsRest(__VLS_195));
__VLS_197.slots.default;
const __VLS_198 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
    modelValue: (__VLS_ctx.newVar.key),
    placeholder: (__VLS_ctx.getKeyPlaceholder()),
    ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
    size: "large",
}));
const __VLS_200 = __VLS_199({
    modelValue: (__VLS_ctx.newVar.key),
    placeholder: (__VLS_ctx.getKeyPlaceholder()),
    ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_199));
var __VLS_197;
const __VLS_202 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
    label: (__VLS_ctx.getValueLabel()),
    prop: "value",
}));
const __VLS_204 = __VLS_203({
    label: (__VLS_ctx.getValueLabel()),
    prop: "value",
}, ...__VLS_functionalComponentArgsRest(__VLS_203));
__VLS_205.slots.default;
const __VLS_206 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_207 = __VLS_asFunctionalComponent(__VLS_206, new __VLS_206({
    modelValue: (__VLS_ctx.newVar.value),
    placeholder: (__VLS_ctx.getValuePlaceholder()),
    size: "large",
}));
const __VLS_208 = __VLS_207({
    modelValue: (__VLS_ctx.newVar.value),
    placeholder: (__VLS_ctx.getValuePlaceholder()),
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_207));
var __VLS_205;
var __VLS_175;
{
    const { footer: __VLS_thisSlot } = __VLS_171.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-footer" },
    });
    const __VLS_210 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_211 = __VLS_asFunctionalComponent(__VLS_210, new __VLS_210({
        ...{ 'onClick': {} },
        size: "large",
    }));
    const __VLS_212 = __VLS_211({
        ...{ 'onClick': {} },
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_211));
    let __VLS_214;
    let __VLS_215;
    let __VLS_216;
    const __VLS_217 = {
        onClick: (...[$event]) => {
            __VLS_ctx.dialogVisible = false;
        }
    };
    __VLS_213.slots.default;
    var __VLS_213;
    const __VLS_218 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_219 = __VLS_asFunctionalComponent(__VLS_218, new __VLS_218({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
    }));
    const __VLS_220 = __VLS_219({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_219));
    let __VLS_222;
    let __VLS_223;
    let __VLS_224;
    const __VLS_225 = {
        onClick: (__VLS_ctx.handleAddConfirm)
    };
    __VLS_221.slots.default;
    var __VLS_221;
}
var __VLS_171;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['app-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-title']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-info-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-name']} */ ;
/** @type {__VLS_StyleScopedClasses['config-path']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-body']} */ ;
/** @type {__VLS_StyleScopedClasses['control-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['view-switcher']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['category-filter']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['category-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['category-card']} */ ;
/** @type {__VLS_StyleScopedClasses['category-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['category-info']} */ ;
/** @type {__VLS_StyleScopedClasses['category-name']} */ ;
/** @type {__VLS_StyleScopedClasses['category-count']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-number']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['main-workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-title']} */ ;
/** @type {__VLS_StyleScopedClasses['result-count']} */ ;
/** @type {__VLS_StyleScopedClasses['count-number']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-right']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['el-icon--right']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-content']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-text']} */ ;
/** @type {__VLS_StyleScopedClasses['error-state']} */ ;
/** @type {__VLS_StyleScopedClasses['source-editor-container']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-text']} */ ;
/** @type {__VLS_StyleScopedClasses['source-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['source-editor-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['el-icon-document']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-right']} */ ;
/** @type {__VLS_StyleScopedClasses['source-editor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['source-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['source-editor-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-info']} */ ;
/** @type {__VLS_StyleScopedClasses['line-count']} */ ;
/** @type {__VLS_StyleScopedClasses['char-count']} */ ;
/** @type {__VLS_StyleScopedClasses['change-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['key-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['key-input']} */ ;
/** @type {__VLS_StyleScopedClasses['add-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-footer']} */ ;
// @ts-ignore
var __VLS_177 = __VLS_176;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArrowDown: ArrowDown,
            envVars: envVars,
            shellInfo: shellInfo,
            loading: loading,
            saving: saving,
            viewType: viewType,
            selectedCategory: selectedCategory,
            categories: categories,
            viewOptions: viewOptions,
            getEmptyDescription: getEmptyDescription,
            getPlaceholder: getPlaceholder,
            error: error,
            searchQuery: searchQuery,
            hasChanges: hasChanges,
            sourceContent: sourceContent,
            sourceFilePath: sourceFilePath,
            sourceLoading: sourceLoading,
            sourceSaving: sourceSaving,
            dialogVisible: dialogVisible,
            varForm: varForm,
            newVar: newVar,
            rules: rules,
            showTypeSelector: showTypeSelector,
            getDialogTitle: getDialogTitle,
            getKeyLabel: getKeyLabel,
            getValueLabel: getValueLabel,
            getKeyPlaceholder: getKeyPlaceholder,
            getValuePlaceholder: getValuePlaceholder,
            filteredEnvVars: filteredEnvVars,
            handleRefresh: handleRefresh,
            handleValueChange: handleValueChange,
            handleKeyChange: handleKeyChange,
            isVarNameValid: isVarNameValid,
            handleAddConfirm: handleAddConfirm,
            handleDelete: handleDelete,
            handleSave: handleSave,
            handleBackup: handleBackup,
            selectCategory: selectCategory,
            getCategoryCount: getCategoryCount,
            showAddDialog: showAddDialog,
            getCategoryIcon: getCategoryIcon,
            getRowClassName: getRowClassName,
            handleAddCommand: handleAddCommand,
            getCurrentTitle: getCurrentTitle,
            saveSourceContent: saveSourceContent,
            handleSourceContentChange: handleSourceContentChange,
            handleViewTypeChange: handleViewTypeChange,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
