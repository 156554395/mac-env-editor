import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
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
// 添加变量对话框
const dialogVisible = ref(false);
const varForm = ref();
const newVar = reactive({
    key: '',
    value: '',
    type: 'env'
});
const rules = {
    key: [
        { required: true, message: '请输入变量名', trigger: 'blur' }
    ],
    value: [
        { required: true, message: '请输入变量值', trigger: 'blur' }
    ]
};
// 计算属性
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
        error.value = `加载失败: ${err.message}`;
    }
    finally {
        loading.value = false;
    }
};
const handleRefresh = () => {
    loadData();
};
const handleValueChange = (row) => {
    row.isValid = validateEnvironmentVariable(row.key, row.value);
    checkChanges();
};
const validateEnvironmentVariable = (key, value) => {
    if (!key || typeof key !== 'string')
        return false;
    const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!keyRegex.test(key))
        return false;
    return true;
};
const isVarNameValid = (name) => {
    return validateEnvironmentVariable(name, '');
};
const checkChanges = () => {
    const current = JSON.stringify(envVars.value);
    const original = JSON.stringify(originalEnvVars.value);
    hasChanges.value = current !== original;
};
const handleAddConfirm = () => {
    varForm.value?.validate((valid) => {
        if (valid && isVarNameValid(newVar.key)) {
            const category = newVar.type === 'alias' ? '别名' :
                newVar.key.includes('PATH') ? 'PATH' : '环境变量';
            envVars.value.push({
                key: newVar.key.toUpperCase(),
                value: newVar.value,
                type: newVar.type,
                isValid: true,
                category
            });
            envVars.value.sort((a, b) => a.key.localeCompare(b.key));
            dialogVisible.value = false;
            checkChanges();
            ElMessage.success('变量已添加');
        }
        else {
            ElMessage.error('请输入有效的变量名和值');
        }
    });
};
const handleDelete = (index) => {
    ElMessageBox.confirm('确定要删除这个环境变量吗？', '确认删除', {
        type: 'warning'
    }).then(() => {
        envVars.value.splice(index, 1);
        checkChanges();
        ElMessage.success('变量已删除');
    }).catch(() => { });
};
const handleSave = async () => {
    saving.value = true;
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
            ElMessage.success(result.message || '保存成功');
        }
        else {
            ElMessage.error(result.error || '保存失败');
        }
    }
    catch (err) {
        ElMessage.error(`保存失败: ${err.message}`);
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
            ElMessage.error(result.message || '备份失败');
        }
    }
    catch (err) {
        ElMessage.error(`备份失败: ${err.message}`);
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
const getCategoryColor = (categoryName) => {
    const category = categories.value.find(c => c.name === categoryName);
    return category?.color || '#909399';
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
const handleViewTypeChange = () => {
    selectedCategory.value = 'all';
};
const handleAdd = (type) => {
    newVar.type = type || 'env';
    newVar.key = '';
    newVar.value = '';
    dialogVisible.value = true;
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
        default:
            return '环境变量';
    }
};
// 生命周期
onMounted(() => {
    loadData();
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
const __VLS_0 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.ElHeader;
/** @type {[typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-actions" },
});
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "danger",
    disabled: (!__VLS_ctx.hasChanges),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "danger",
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
    disabled: (!__VLS_ctx.hasChanges),
    loading: (__VLS_ctx.saving),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    type: "primary",
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
const __VLS_24 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (__VLS_ctx.handleRefresh)
};
__VLS_27.slots.default;
var __VLS_27;
var __VLS_7;
const __VLS_32 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.ElAside;
/** @type {[typeof __VLS_components.ElAside, typeof __VLS_components.elAside, typeof __VLS_components.ElAside, typeof __VLS_components.elAside, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    width: "280px",
}));
const __VLS_38 = __VLS_37({
    width: "280px",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar" },
});
const __VLS_40 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ class: "shell-info" },
}));
const __VLS_42 = __VLS_41({
    ...{ class: "shell-info" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_43.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
if (__VLS_ctx.shellInfo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.shellInfo.shellName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.shellInfo.configPath);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.shellInfo.activeConfig);
}
else {
    const __VLS_44 = {}.ElSkeleton;
    /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        animated: true,
        rows: (3),
    }));
    const __VLS_46 = __VLS_45({
        animated: true,
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
var __VLS_43;
const __VLS_48 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ class: "view-selector" },
}));
const __VLS_50 = __VLS_49({
    ...{ class: "view-selector" },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_51.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
const __VLS_52 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
}));
const __VLS_54 = __VLS_53({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onChange: (__VLS_ctx.handleViewTypeChange)
};
__VLS_55.slots.default;
const __VLS_60 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    value: "all",
}));
const __VLS_62 = __VLS_61({
    value: "all",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
var __VLS_63;
const __VLS_64 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    value: "env",
}));
const __VLS_66 = __VLS_65({
    value: "env",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
var __VLS_67;
const __VLS_68 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    value: "alias",
}));
const __VLS_70 = __VLS_69({
    value: "alias",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
var __VLS_71;
var __VLS_55;
var __VLS_51;
if (__VLS_ctx.viewType === 'all') {
    const __VLS_72 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ class: "categories" },
    }));
    const __VLS_74 = __VLS_73({
        ...{ class: "categories" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_75.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-list" },
    });
    for (const [category] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.viewType === 'all'))
                        return;
                    __VLS_ctx.selectCategory(category.name);
                } },
            key: (category.name),
            ...{ class: "category-item" },
            ...{ class: ({ active: __VLS_ctx.selectedCategory === category.name }) },
        });
        const __VLS_76 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            color: (category.color),
            size: "small",
        }));
        const __VLS_78 = __VLS_77({
            color: (category.color),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        __VLS_79.slots.default;
        (category.name);
        var __VLS_79;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "category-count" },
        });
        (__VLS_ctx.getCategoryCount(category.name));
    }
    var __VLS_75;
}
var __VLS_39;
const __VLS_80 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({}));
const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    ...{ class: "main-content" },
}));
const __VLS_86 = __VLS_85({
    ...{ class: "main-content" },
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_87.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.getCurrentTitle());
    (__VLS_ctx.filteredEnvVars.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "header-actions-right" },
    });
    const __VLS_88 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        modelValue: (__VLS_ctx.searchQuery),
        placeholder: "搜索...",
        ...{ style: {} },
        clearable: true,
    }));
    const __VLS_90 = __VLS_89({
        modelValue: (__VLS_ctx.searchQuery),
        placeholder: "搜索...",
        ...{ style: {} },
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    {
        const { prefix: __VLS_thisSlot } = __VLS_91.slots;
        const __VLS_92 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({}));
        const __VLS_94 = __VLS_93({}, ...__VLS_functionalComponentArgsRest(__VLS_93));
        __VLS_95.slots.default;
        const __VLS_96 = {}.Search;
        /** @type {[typeof __VLS_components.Search, ]} */ ;
        // @ts-ignore
        const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({}));
        const __VLS_98 = __VLS_97({}, ...__VLS_functionalComponentArgsRest(__VLS_97));
        var __VLS_95;
    }
    var __VLS_91;
    if (__VLS_ctx.viewType === 'all') {
        const __VLS_100 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.viewType === 'all'))
                    return;
                __VLS_ctx.showAddDialog();
            }
        };
        __VLS_103.slots.default;
        (__VLS_ctx.selectedCategory === 'all' ? '' : __VLS_ctx.selectedCategory);
        var __VLS_103;
    }
    else if (__VLS_ctx.viewType === 'env') {
        const __VLS_108 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_112;
        let __VLS_113;
        let __VLS_114;
        const __VLS_115 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.viewType === 'all'))
                    return;
                if (!(__VLS_ctx.viewType === 'env'))
                    return;
                __VLS_ctx.handleAdd('env');
            }
        };
        __VLS_111.slots.default;
        var __VLS_111;
    }
    else if (__VLS_ctx.viewType === 'alias') {
        const __VLS_116 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }));
        const __VLS_118 = __VLS_117({
            ...{ 'onClick': {} },
            type: "primary",
            icon: "Plus",
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        let __VLS_120;
        let __VLS_121;
        let __VLS_122;
        const __VLS_123 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.viewType === 'all'))
                    return;
                if (!!(__VLS_ctx.viewType === 'env'))
                    return;
                if (!(__VLS_ctx.viewType === 'alias'))
                    return;
                __VLS_ctx.handleAdd('alias');
            }
        };
        __VLS_119.slots.default;
        var __VLS_119;
    }
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
    const __VLS_124 = {}.ElSkeleton;
    /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        rows: (8),
        animated: true,
    }));
    const __VLS_126 = __VLS_125({
        rows: (8),
        animated: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error" },
    });
    const __VLS_128 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        title: (__VLS_ctx.error),
        type: "error",
        closable: (false),
    }));
    const __VLS_130 = __VLS_129({
        title: (__VLS_ctx.error),
        type: "error",
        closable: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
}
else if (__VLS_ctx.filteredEnvVars.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
    const __VLS_132 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        description: (__VLS_ctx.getEmptyDescription()),
    }));
    const __VLS_134 = __VLS_133({
        description: (__VLS_ctx.getEmptyDescription()),
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "env-table" },
    });
    const __VLS_136 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
    }));
    const __VLS_138 = __VLS_137({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    if (__VLS_ctx.viewType === 'all') {
        const __VLS_140 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
            prop: "type",
            label: "类型",
            width: "80",
        }));
        const __VLS_142 = __VLS_141({
            prop: "type",
            label: "类型",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_141));
        __VLS_143.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_143.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_144 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "small",
            }));
            const __VLS_146 = __VLS_145({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_145));
            __VLS_147.slots.default;
            (row.type === 'env' ? 'ENV' : 'ALIAS');
            var __VLS_147;
        }
        var __VLS_143;
    }
    const __VLS_148 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        prop: "key",
        label: "名称",
        width: "200",
    }));
    const __VLS_150 = __VLS_149({
        prop: "key",
        label: "名称",
        width: "200",
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    __VLS_151.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_151.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
        (row.key);
        if (row.category && __VLS_ctx.viewType === 'all') {
            const __VLS_152 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
                size: "small",
                color: (__VLS_ctx.getCategoryColor(row.category)),
            }));
            const __VLS_154 = __VLS_153({
                size: "small",
                color: (__VLS_ctx.getCategoryColor(row.category)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_153));
            __VLS_155.slots.default;
            (row.category);
            var __VLS_155;
        }
    }
    var __VLS_151;
    const __VLS_156 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        prop: "value",
        label: "值",
    }));
    const __VLS_158 = __VLS_157({
        prop: "value",
        label: "值",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_159.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_160 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
        }));
        const __VLS_162 = __VLS_161({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        let __VLS_164;
        let __VLS_165;
        let __VLS_166;
        const __VLS_167 = {
            onInput: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.handleValueChange(row);
            }
        };
        var __VLS_163;
    }
    var __VLS_159;
    const __VLS_168 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        width: "120",
        label: "操作",
    }));
    const __VLS_170 = __VLS_169({
        width: "120",
        label: "操作",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    __VLS_171.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_171.slots;
        const [{ row, $index }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_172 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
            ...{ 'onClick': {} },
            type: "danger",
            size: "small",
        }));
        const __VLS_174 = __VLS_173({
            ...{ 'onClick': {} },
            type: "danger",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        let __VLS_176;
        let __VLS_177;
        let __VLS_178;
        const __VLS_179 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!!(__VLS_ctx.filteredEnvVars.length === 0))
                    return;
                __VLS_ctx.handleDelete($index);
            }
        };
        __VLS_175.slots.default;
        var __VLS_175;
    }
    var __VLS_171;
    var __VLS_139;
}
var __VLS_87;
var __VLS_83;
var __VLS_35;
var __VLS_3;
const __VLS_180 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.dialogVisible),
    title: "添加环境变量",
    width: "500px",
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.dialogVisible),
    title: "添加环境变量",
    width: "500px",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    ref: "varForm",
    labelWidth: "100px",
}));
const __VLS_186 = __VLS_185({
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    ref: "varForm",
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
/** @type {typeof __VLS_ctx.varForm} */ ;
var __VLS_188 = {};
__VLS_187.slots.default;
const __VLS_190 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
    label: "变量名",
    prop: "key",
}));
const __VLS_192 = __VLS_191({
    label: "变量名",
    prop: "key",
}, ...__VLS_functionalComponentArgsRest(__VLS_191));
__VLS_193.slots.default;
const __VLS_194 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
    modelValue: (__VLS_ctx.newVar.key),
    placeholder: "例如: PATH",
    ...{ class: ({ 'invalid': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
}));
const __VLS_196 = __VLS_195({
    modelValue: (__VLS_ctx.newVar.key),
    placeholder: "例如: PATH",
    ...{ class: ({ 'invalid': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_195));
var __VLS_193;
const __VLS_198 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
    label: "变量值",
    prop: "value",
}));
const __VLS_200 = __VLS_199({
    label: "变量值",
    prop: "value",
}, ...__VLS_functionalComponentArgsRest(__VLS_199));
__VLS_201.slots.default;
const __VLS_202 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
    modelValue: (__VLS_ctx.newVar.value),
    placeholder: "例如: /usr/local/bin",
}));
const __VLS_204 = __VLS_203({
    modelValue: (__VLS_ctx.newVar.value),
    placeholder: "例如: /usr/local/bin",
}, ...__VLS_functionalComponentArgsRest(__VLS_203));
var __VLS_201;
var __VLS_187;
{
    const { footer: __VLS_thisSlot } = __VLS_183.slots;
    const __VLS_206 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_207 = __VLS_asFunctionalComponent(__VLS_206, new __VLS_206({
        ...{ 'onClick': {} },
    }));
    const __VLS_208 = __VLS_207({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_207));
    let __VLS_210;
    let __VLS_211;
    let __VLS_212;
    const __VLS_213 = {
        onClick: (...[$event]) => {
            __VLS_ctx.dialogVisible = false;
        }
    };
    __VLS_209.slots.default;
    var __VLS_209;
    const __VLS_214 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_215 = __VLS_asFunctionalComponent(__VLS_214, new __VLS_214({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_216 = __VLS_215({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_215));
    let __VLS_218;
    let __VLS_219;
    let __VLS_220;
    const __VLS_221 = {
        onClick: (__VLS_ctx.handleAddConfirm)
    };
    __VLS_217.slots.default;
    var __VLS_217;
}
var __VLS_183;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['header-content']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-info']} */ ;
/** @type {__VLS_StyleScopedClasses['view-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['categories']} */ ;
/** @type {__VLS_StyleScopedClasses['category-list']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item']} */ ;
/** @type {__VLS_StyleScopedClasses['category-count']} */ ;
/** @type {__VLS_StyleScopedClasses['main-content']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions-right']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['env-table']} */ ;
// @ts-ignore
var __VLS_189 = __VLS_188;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Search: Search,
            shellInfo: shellInfo,
            loading: loading,
            saving: saving,
            viewType: viewType,
            selectedCategory: selectedCategory,
            categories: categories,
            getEmptyDescription: getEmptyDescription,
            getPlaceholder: getPlaceholder,
            error: error,
            searchQuery: searchQuery,
            hasChanges: hasChanges,
            dialogVisible: dialogVisible,
            varForm: varForm,
            newVar: newVar,
            rules: rules,
            filteredEnvVars: filteredEnvVars,
            handleRefresh: handleRefresh,
            handleValueChange: handleValueChange,
            isVarNameValid: isVarNameValid,
            handleAddConfirm: handleAddConfirm,
            handleDelete: handleDelete,
            handleSave: handleSave,
            handleBackup: handleBackup,
            selectCategory: selectCategory,
            getCategoryCount: getCategoryCount,
            getCategoryColor: getCategoryColor,
            showAddDialog: showAddDialog,
            handleViewTypeChange: handleViewTypeChange,
            handleAdd: handleAdd,
            getCurrentTitle: getCurrentTitle,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
