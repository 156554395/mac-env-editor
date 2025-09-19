/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown, ChatDotRound, InfoFilled, Document, Plus, Edit, Delete, CopyDocument, Setting } from '@element-plus/icons-vue';
// 状态管理
const envVars = ref([]);
const originalEnvVars = ref([]);
const shellInfo = ref(null);
const loading = ref(false);
const saving = ref(false);
const viewType = ref('all');
const selectedCategory = ref('all');
const operationLogs = ref([]);
const showLogsDialog = ref(false);
// 从本地存储加载操作日志
const loadOperationLogs = () => {
    try {
        const savedLogs = localStorage.getItem('env-editor-operation-logs');
        if (savedLogs) {
            const parsed = JSON.parse(savedLogs);
            // 将时间戳字符串转换回 Date 对象
            operationLogs.value = parsed.map((log) => ({
                ...log,
                timestamp: new Date(log.timestamp)
            }));
        }
    }
    catch (error) {
        console.error('加载操作日志失败:', error);
        operationLogs.value = [];
    }
};
// 保存操作日志到本地存储
const saveOperationLogs = () => {
    try {
        localStorage.setItem('env-editor-operation-logs', JSON.stringify(operationLogs.value));
    }
    catch (error) {
        console.error('保存操作日志失败:', error);
    }
};
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
// 操作日志记录函数
const addOperationLog = (type, category, key, description, oldValue, newValue, fullOldValue, fullNewValue) => {
    const log = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        type,
        category,
        key,
        oldValue,
        newValue,
        fullOldValue,
        fullNewValue,
        timestamp: new Date(),
        description
    };
    operationLogs.value.unshift(log); // 新日志添加到前面
    // 最多保留100条日志
    if (operationLogs.value.length > 100) {
        operationLogs.value = operationLogs.value.slice(0, 100);
    }
    // 保存到本地存储
    saveOperationLogs();
};
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
    // 验证变量名有效性（别名和环境变量都用相同的规则）
    row.isValid = isVarNameValid(row.key);
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
                key: newVar.key,
                value: newVar.value,
                type: newVar.type,
                isValid: true,
                category
            });
            envVars.value.sort((a, b) => a.key.localeCompare(b.key));
            // 自动保存到文件
            await saveChangesToFile();
            // 记录操作日志
            const logCategory = newVar.type === 'alias' ? '别名' : '环境变量';
            addOperationLog('create', logCategory, newVar.key, `添加了${logCategory} "${newVar.key}"`, undefined, newVar.value);
            dialogVisible.value = false;
            const itemType = newVar.type === 'alias' ? '别名' : '环境变量';
            // 跳转到对应的类别视图
            if (newVar.type === 'alias') {
                viewType.value = 'alias';
                selectedCategory.value = 'all';
            }
            else {
                viewType.value = 'env';
                selectedCategory.value = 'all';
            }
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
            // 在更新原始数据之前记录变化日志
            recordChangeLogs();
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
// 记录变化日志
const recordChangeLogs = () => {
    // 检测修改和新增
    envVars.value.forEach(current => {
        const original = originalEnvVars.value.find(o => o.key === current.key && o.type === current.type);
        if (original) {
            // 检测值变化
            if (original.value !== current.value) {
                const category = current.type === 'alias' ? '别名' : '环境变量';
                addOperationLog('update', category, current.key, `修改了${category} "${current.key}" 的值`, original.value, current.value);
            }
        }
        else {
            // 检测新增（这种情况应该很少，因为新增通常通过 handleAddConfirm）
            const category = current.type === 'alias' ? '别名' : '环境变量';
            addOperationLog('create', category, current.key, `添加了${category} "${current.key}"`, undefined, current.value);
        }
    });
    // 检测删除（在原始数组中但当前数组中找不到的项）
    originalEnvVars.value.forEach(original => {
        const current = envVars.value.find(c => c.key === original.key && c.type === original.type);
        if (!current) {
            const category = original.type === 'alias' ? '别名' : '环境变量';
            addOperationLog('delete', category, original.key, `删除了${category} "${original.key}"`, original.value, undefined);
        }
    });
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
        let success = false;
        if (viewType.value === 'source') {
            // 源码编辑模式：保存源码内容
            sourceSaving.value = true;
            try {
                const result = await window.electronAPI.saveConfigFileContent({
                    content: sourceContent.value,
                    filePath: sourceFilePath.value
                });
                if (result.success) {
                    // 记录源码编辑操作日志（在更新原始内容之前）
                    addOperationLog('update', '环境变量', sourceFileName.value || '配置文件', `修改了配置文件 "${sourceFileName.value || '配置文件'}" 的源码内容`, originalSourceContent.value.length > 300 ?
                        originalSourceContent.value.substring(0, 300) + '...' :
                        originalSourceContent.value, sourceContent.value.length > 300 ?
                        sourceContent.value.substring(0, 300) + '...' :
                        sourceContent.value, originalSourceContent.value, // 完整的原值
                    sourceContent.value // 完整的新值
                    );
                    originalSourceContent.value = sourceContent.value;
                    ElMessage.success(result.message || '配置文件已保存');
                    // 重新加载环境变量数据
                    await loadData();
                    success = true;
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
        }
        else {
            // 普通模式：保存环境变量
            success = await saveChangesToFile();
            if (success) {
                ElMessage.success('保存成功');
            }
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
            return 'Grid';
        case '环境变量':
            return 'Setting';
        case '别名':
            return 'Link';
        case 'PATH':
            return 'Guide';
        default:
            return 'Document';
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
// 处理下拉菜单命令
const handleDropdownCommand = (command) => {
    switch (command) {
        case 'logs':
            showLogsDialog.value = true;
            break;
        case 'feedback':
            openGitHubIssue();
            break;
        case 'about':
            showAboutDialog();
            break;
    }
};
// 复制文本到剪贴板
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success('已复制到剪贴板');
    }
    catch (err) {
        console.error('复制失败:', err);
        ElMessage.error('复制失败');
    }
};
// 格式化时间
const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    if (diff < 60000) {
        // 1分钟内
        return '刚刚';
    }
    else if (diff < 3600000) {
        // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`;
    }
    else if (diff < 86400000) {
        // 24小时内
        return `${Math.floor(diff / 3600000)}小时前`;
    }
    else {
        return timestamp.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};
// 清空日志
const clearLogs = () => {
    ElMessageBox.confirm('确定要清空所有操作日志吗？', '确认清空', {
        type: 'warning'
    })
        .then(() => {
        operationLogs.value = [];
        // 清空本地存储
        localStorage.removeItem('env-editor-operation-logs');
        ElMessage.success('操作日志已清空');
    })
        .catch(() => { });
};
// 打开GitHub Issues页面
const openGitHubIssue = async () => {
    const repoUrl = 'https://github.com/156554395/mac-env-editor';
    const issueUrl = `${repoUrl}/issues/new`;
    // 获取系统信息用于问题模板
    const systemInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.userAgent.includes('Mac') ? 'macOS' : 'Unknown',
        appVersion: '1.1.0'
    };
    const issueTemplate = `
## 问题描述
请详细描述您遇到的问题

## 复现步骤
1.
2.
3.

## 期望行为
请描述您期望的正确行为

## 实际行为
请描述实际发生的行为

## 系统信息
- 应用版本: ${systemInfo.appVersion}
- 操作系统: ${systemInfo.platform}
- 浏览器: ${systemInfo.userAgent}

## 附加信息
请提供任何可能有助于解决问题的额外信息
  `.trim();
    const params = new URLSearchParams({
        title: '[Bug Report] ',
        body: issueTemplate,
        labels: 'bug'
    });
    const finalUrl = `${issueUrl}?${params.toString()}`;
    try {
        // 使用Electron的shell模块打开外部链接
        if (window.electronAPI && window.electronAPI.openExternal) {
            await window.electronAPI.openExternal(finalUrl);
        }
        else {
            // 备用方案：直接使用window.open
            window.open(finalUrl, '_blank');
        }
    }
    catch (error) {
        console.error('Failed to open GitHub issue page:', error);
        ElMessage.error('无法打开GitHub问题反馈页面');
    }
};
// 显示关于对话框
const showAboutDialog = () => {
    ElMessageBox({
        title: '关于应用',
        message: `
    <div style="text-align: center; padding: 20px;">
      <h2 style="margin: 0 0 20px 0; color: #409EFF;">Mac 环境变量编辑器</h2>
      <p style="margin: 10px 0; color: #666;">版本: 1.1.0</p>
      <p style="margin: 10px 0; color: #666;">一个现代化、直观的 macOS 环境变量和别名管理工具</p>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 5px 0; color: #999; font-size: 12px;">开发者: 156554395</p>
      </div>
    </div>
    `,
        dangerouslyUseHTMLString: true,
        showCancelButton: true,
        confirmButtonText: '访问GitHub项目',
        cancelButtonText: '关闭'
    })
        .then(async () => {
        // 点击"访问GitHub项目"按钮时打开GitHub链接
        try {
            const repoUrl = 'https://github.com/156554395/mac-env-editor';
            if (window.electronAPI && window.electronAPI.openExternal) {
                await window.electronAPI.openExternal(repoUrl);
            }
            else {
                window.open(repoUrl, '_blank');
            }
        }
        catch (error) {
            console.error('Failed to open GitHub page:', error);
            ElMessage.error('无法打开GitHub项目页面');
        }
    })
        .catch(() => {
        // 点击"关闭"按钮或按ESC键，不做任何操作
    });
};
// 生命周期
onMounted(() => {
    loadData();
    loadOperationLogs();
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
const __VLS_0 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    size: "24",
}));
const __VLS_2 = __VLS_1({
    size: "24",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.Setting;
/** @type {[typeof __VLS_components.Setting, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "app-title" },
});
if (__VLS_ctx.shellInfo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "shell-info-badge" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "config-path" },
    });
    (__VLS_ctx.shellInfo.activeConfig);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-actions" },
});
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "info",
    icon: ('Refresh'),
    loading: (__VLS_ctx.loading),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "info",
    icon: ('Refresh'),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.handleRefresh)
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    type: "warning",
    icon: ('FolderOpened'),
    disabled: (!__VLS_ctx.hasChanges),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    type: "warning",
    icon: ('FolderOpened'),
    disabled: (!__VLS_ctx.hasChanges),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.handleBackup)
};
__VLS_19.slots.default;
var __VLS_19;
const __VLS_24 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    type: "primary",
    icon: ('Check'),
    disabled: (!__VLS_ctx.hasChanges),
    loading: (__VLS_ctx.saving),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    type: "primary",
    icon: ('Check'),
    disabled: (!__VLS_ctx.hasChanges),
    loading: (__VLS_ctx.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (__VLS_ctx.handleSave)
};
__VLS_27.slots.default;
var __VLS_27;
const __VLS_32 = {}.ElDropdown;
/** @type {[typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onCommand': {} },
}));
const __VLS_34 = __VLS_33({
    ...{ 'onCommand': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onCommand: (__VLS_ctx.handleDropdownCommand)
};
__VLS_35.slots.default;
const __VLS_40 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    type: "default",
    icon: ('MoreFilled'),
}));
const __VLS_42 = __VLS_41({
    type: "default",
    icon: ('MoreFilled'),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ class: "el-icon--right" },
}));
const __VLS_46 = __VLS_45({
    ...{ class: "el-icon--right" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.ArrowDown;
/** @type {[typeof __VLS_components.ArrowDown, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
var __VLS_47;
var __VLS_43;
{
    const { dropdown: __VLS_thisSlot } = __VLS_35.slots;
    const __VLS_52 = {}.ElDropdownMenu;
    /** @type {[typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
    const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    const __VLS_56 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        command: "logs",
    }));
    const __VLS_58 = __VLS_57({
        command: "logs",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    const __VLS_60 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({}));
    const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    const __VLS_64 = {}.Document;
    /** @type {[typeof __VLS_components.Document, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
    const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
    var __VLS_63;
    var __VLS_59;
    const __VLS_68 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        command: "feedback",
    }));
    const __VLS_70 = __VLS_69({
        command: "feedback",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    const __VLS_72 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({}));
    const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    const __VLS_76 = {}.ChatDotRound;
    /** @type {[typeof __VLS_components.ChatDotRound, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
    const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
    var __VLS_75;
    var __VLS_71;
    const __VLS_80 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        command: "about",
    }));
    const __VLS_82 = __VLS_81({
        command: "about",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    const __VLS_84 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    const __VLS_88 = {}.InfoFilled;
    /** @type {[typeof __VLS_components.InfoFilled, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({}));
    const __VLS_90 = __VLS_89({}, ...__VLS_functionalComponentArgsRest(__VLS_89));
    var __VLS_87;
    var __VLS_83;
    var __VLS_55;
}
var __VLS_35;
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
const __VLS_92 = {}.ElSegmented;
/** @type {[typeof __VLS_components.ElSegmented, typeof __VLS_components.elSegmented, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
    options: (__VLS_ctx.viewOptions),
    size: "large",
}));
const __VLS_94 = __VLS_93({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.viewType),
    options: (__VLS_ctx.viewOptions),
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
let __VLS_96;
let __VLS_97;
let __VLS_98;
const __VLS_99 = {
    onChange: (__VLS_ctx.handleViewTypeChange)
};
var __VLS_95;
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
        const __VLS_100 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            size: "20",
        }));
        const __VLS_102 = __VLS_101({
            size: "20",
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        __VLS_103.slots.default;
        const __VLS_104 = ((__VLS_ctx.getCategoryIcon(category.name)));
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({}));
        const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
        var __VLS_103;
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
const __VLS_108 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: "搜索环境变量或别名...",
    ...{ class: "search-input" },
    clearable: true,
    size: "large",
    prefixIcon: ('Search'),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: "搜索环境变量或别名...",
    ...{ class: "search-input" },
    clearable: true,
    size: "large",
    prefixIcon: ('Search'),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.ElDropdown;
/** @type {[typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, typeof __VLS_components.ElDropdown, typeof __VLS_components.elDropdown, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    ...{ 'onCommand': {} },
    trigger: "click",
}));
const __VLS_114 = __VLS_113({
    ...{ 'onCommand': {} },
    trigger: "click",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
let __VLS_116;
let __VLS_117;
let __VLS_118;
const __VLS_119 = {
    onCommand: (__VLS_ctx.handleAddCommand)
};
__VLS_115.slots.default;
const __VLS_120 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    type: "primary",
    size: "large",
    icon: ('Plus'),
}));
const __VLS_122 = __VLS_121({
    type: "primary",
    size: "large",
    icon: ('Plus'),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    ...{ class: "el-icon--right" },
}));
const __VLS_126 = __VLS_125({
    ...{ class: "el-icon--right" },
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.ArrowDown;
/** @type {[typeof __VLS_components.ArrowDown, typeof __VLS_components.arrowDown, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({}));
const __VLS_130 = __VLS_129({}, ...__VLS_functionalComponentArgsRest(__VLS_129));
var __VLS_127;
var __VLS_123;
{
    const { dropdown: __VLS_thisSlot } = __VLS_115.slots;
    const __VLS_132 = {}.ElDropdownMenu;
    /** @type {[typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, typeof __VLS_components.ElDropdownMenu, typeof __VLS_components.elDropdownMenu, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
    const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    const __VLS_136 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        command: "env",
        icon: ('Setting'),
    }));
    const __VLS_138 = __VLS_137({
        command: "env",
        icon: ('Setting'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    var __VLS_139;
    const __VLS_140 = {}.ElDropdownItem;
    /** @type {[typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, typeof __VLS_components.ElDropdownItem, typeof __VLS_components.elDropdownItem, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        command: "alias",
        icon: ('Link'),
    }));
    const __VLS_142 = __VLS_141({
        command: "alias",
        icon: ('Link'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    var __VLS_143;
    var __VLS_135;
}
var __VLS_115;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace-content" },
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-state" },
    });
    const __VLS_144 = {}.ElSkeleton;
    /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        rows: (8),
        animated: true,
    }));
    const __VLS_146 = __VLS_145({
        rows: (8),
        animated: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-text" },
    });
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error-state" },
    });
    const __VLS_148 = {}.ElResult;
    /** @type {[typeof __VLS_components.ElResult, typeof __VLS_components.elResult, typeof __VLS_components.ElResult, typeof __VLS_components.elResult, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        icon: "error",
        title: "加载失败",
        subTitle: (__VLS_ctx.error),
    }));
    const __VLS_150 = __VLS_149({
        icon: "error",
        title: "加载失败",
        subTitle: (__VLS_ctx.error),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    __VLS_151.slots.default;
    {
        const { extra: __VLS_thisSlot } = __VLS_151.slots;
        const __VLS_152 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_154 = __VLS_153({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_153));
        let __VLS_156;
        let __VLS_157;
        let __VLS_158;
        const __VLS_159 = {
            onClick: (__VLS_ctx.handleRefresh)
        };
        __VLS_155.slots.default;
        var __VLS_155;
    }
    var __VLS_151;
}
else if (__VLS_ctx.viewType === 'source') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "source-editor-container" },
    });
    if (__VLS_ctx.sourceLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading-state" },
        });
        const __VLS_160 = {}.ElSkeleton;
        /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            rows: (8),
            animated: true,
        }));
        const __VLS_162 = __VLS_161({
            rows: (8),
            animated: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading-text" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "source-editor-content" },
        });
        const __VLS_164 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            ...{ 'onInput': {} },
            modelValue: (__VLS_ctx.sourceContent),
            type: "textarea",
            rows: (20),
            placeholder: "请输入配置文件内容...",
            ...{ class: "source-textarea" },
        }));
        const __VLS_166 = __VLS_165({
            ...{ 'onInput': {} },
            modelValue: (__VLS_ctx.sourceContent),
            type: "textarea",
            rows: (20),
            placeholder: "请输入配置文件内容...",
            ...{ class: "source-textarea" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        let __VLS_168;
        let __VLS_169;
        let __VLS_170;
        const __VLS_171 = {
            onInput: (__VLS_ctx.handleSourceContentChange)
        };
        var __VLS_167;
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
    const __VLS_172 = {}.ElResult;
    /** @type {[typeof __VLS_components.ElResult, typeof __VLS_components.elResult, typeof __VLS_components.ElResult, typeof __VLS_components.elResult, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        icon: "info",
        title: "暂无数据",
        subTitle: (__VLS_ctx.getEmptyDescription()),
    }));
    const __VLS_174 = __VLS_173({
        icon: "info",
        title: "暂无数据",
        subTitle: (__VLS_ctx.getEmptyDescription()),
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    {
        const { extra: __VLS_thisSlot } = __VLS_175.slots;
        const __VLS_176 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_178 = __VLS_177({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_177));
        let __VLS_180;
        let __VLS_181;
        let __VLS_182;
        const __VLS_183 = {
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
        __VLS_179.slots.default;
        var __VLS_179;
    }
    var __VLS_175;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "data-table" },
    });
    const __VLS_184 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
        rowClassName: (__VLS_ctx.getRowClassName),
        stripe: true,
        size: "large",
    }));
    const __VLS_186 = __VLS_185({
        data: (__VLS_ctx.filteredEnvVars),
        ...{ style: {} },
        rowClassName: (__VLS_ctx.getRowClassName),
        stripe: true,
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    __VLS_187.slots.default;
    if (__VLS_ctx.viewType === 'all') {
        const __VLS_188 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
            prop: "type",
            label: "类型",
            width: "120",
            align: "center",
        }));
        const __VLS_190 = __VLS_189({
            prop: "type",
            label: "类型",
            width: "120",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_189));
        __VLS_191.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_191.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_192 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "large",
                effect: "dark",
            }));
            const __VLS_194 = __VLS_193({
                type: (row.type === 'env' ? 'success' : 'warning'),
                size: "large",
                effect: "dark",
            }, ...__VLS_functionalComponentArgsRest(__VLS_193));
            __VLS_195.slots.default;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
                ...{ class: (row.type === 'env' ? 'el-icon-setting' : 'el-icon-link') },
            });
            (row.type === 'env' ? 'ENV' : 'ALIAS');
            var __VLS_195;
        }
        var __VLS_191;
    }
    const __VLS_196 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        prop: "key",
        label: "名称",
        width: "250",
    }));
    const __VLS_198 = __VLS_197({
        prop: "key",
        label: "名称",
        width: "250",
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_199.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "key-cell" },
        });
        const __VLS_200 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
            ...{ 'onInput': {} },
            modelValue: (row.key),
            ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(row.key) }) },
            placeholder: "变量名称",
            size: "large",
            ...{ class: "key-input" },
        }));
        const __VLS_202 = __VLS_201({
            ...{ 'onInput': {} },
            modelValue: (row.key),
            ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(row.key) }) },
            placeholder: "变量名称",
            size: "large",
            ...{ class: "key-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_201));
        let __VLS_204;
        let __VLS_205;
        let __VLS_206;
        const __VLS_207 = {
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
        var __VLS_203;
    }
    var __VLS_199;
    const __VLS_208 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        prop: "value",
        label: "值",
    }));
    const __VLS_210 = __VLS_209({
        prop: "value",
        label: "值",
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    __VLS_211.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_211.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_212 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid-input': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
            size: "large",
        }));
        const __VLS_214 = __VLS_213({
            ...{ 'onInput': {} },
            modelValue: (row.value),
            ...{ class: ({ 'invalid-input': !row.isValid }) },
            placeholder: (__VLS_ctx.getPlaceholder(row.type)),
            size: "large",
        }, ...__VLS_functionalComponentArgsRest(__VLS_213));
        let __VLS_216;
        let __VLS_217;
        let __VLS_218;
        const __VLS_219 = {
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
        var __VLS_215;
    }
    var __VLS_211;
    const __VLS_220 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        width: "120",
        label: "操作",
        align: "center",
    }));
    const __VLS_222 = __VLS_221({
        width: "120",
        label: "操作",
        align: "center",
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    __VLS_223.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_223.slots;
        const [{ $index }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_224 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
            ...{ 'onClick': {} },
            type: "danger",
            size: "large",
            icon: ('Delete'),
            text: true,
        }));
        const __VLS_226 = __VLS_225({
            ...{ 'onClick': {} },
            type: "danger",
            size: "large",
            icon: ('Delete'),
            text: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_225));
        let __VLS_228;
        let __VLS_229;
        let __VLS_230;
        const __VLS_231 = {
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
        __VLS_227.slots.default;
        var __VLS_227;
    }
    var __VLS_223;
    var __VLS_187;
}
const __VLS_232 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.getDialogTitle()),
    width: "600px",
    showClose: (false),
    ...{ class: "add-dialog" },
}));
const __VLS_234 = __VLS_233({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.getDialogTitle()),
    width: "600px",
    showClose: (false),
    ...{ class: "add-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
const __VLS_236 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    ref: "varForm",
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    labelWidth: "120px",
    size: "large",
}));
const __VLS_238 = __VLS_237({
    ref: "varForm",
    model: (__VLS_ctx.newVar),
    rules: (__VLS_ctx.rules),
    labelWidth: "120px",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
/** @type {typeof __VLS_ctx.varForm} */ ;
var __VLS_240 = {};
__VLS_239.slots.default;
if (__VLS_ctx.showTypeSelector) {
    const __VLS_242 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_243 = __VLS_asFunctionalComponent(__VLS_242, new __VLS_242({
        label: "类型",
        prop: "type",
    }));
    const __VLS_244 = __VLS_243({
        label: "类型",
        prop: "type",
    }, ...__VLS_functionalComponentArgsRest(__VLS_243));
    __VLS_245.slots.default;
    const __VLS_246 = {}.ElRadioGroup;
    /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
    // @ts-ignore
    const __VLS_247 = __VLS_asFunctionalComponent(__VLS_246, new __VLS_246({
        modelValue: (__VLS_ctx.newVar.type),
        size: "large",
    }));
    const __VLS_248 = __VLS_247({
        modelValue: (__VLS_ctx.newVar.type),
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_247));
    __VLS_249.slots.default;
    const __VLS_250 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_251 = __VLS_asFunctionalComponent(__VLS_250, new __VLS_250({
        value: "env",
    }));
    const __VLS_252 = __VLS_251({
        value: "env",
    }, ...__VLS_functionalComponentArgsRest(__VLS_251));
    __VLS_253.slots.default;
    var __VLS_253;
    const __VLS_254 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({
        value: "alias",
    }));
    const __VLS_256 = __VLS_255({
        value: "alias",
    }, ...__VLS_functionalComponentArgsRest(__VLS_255));
    __VLS_257.slots.default;
    var __VLS_257;
    var __VLS_249;
    var __VLS_245;
}
const __VLS_258 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_259 = __VLS_asFunctionalComponent(__VLS_258, new __VLS_258({
    label: (__VLS_ctx.getKeyLabel()),
    prop: "key",
}));
const __VLS_260 = __VLS_259({
    label: (__VLS_ctx.getKeyLabel()),
    prop: "key",
}, ...__VLS_functionalComponentArgsRest(__VLS_259));
__VLS_261.slots.default;
const __VLS_262 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_263 = __VLS_asFunctionalComponent(__VLS_262, new __VLS_262({
    modelValue: (__VLS_ctx.newVar.key),
    modelModifiers: { trim: true, },
    placeholder: (__VLS_ctx.getKeyPlaceholder()),
    ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
    size: "large",
}));
const __VLS_264 = __VLS_263({
    modelValue: (__VLS_ctx.newVar.key),
    modelModifiers: { trim: true, },
    placeholder: (__VLS_ctx.getKeyPlaceholder()),
    ...{ class: ({ 'invalid-input': !__VLS_ctx.isVarNameValid(__VLS_ctx.newVar.key) }) },
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_263));
var __VLS_261;
const __VLS_266 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_267 = __VLS_asFunctionalComponent(__VLS_266, new __VLS_266({
    label: (__VLS_ctx.getValueLabel()),
    prop: "value",
}));
const __VLS_268 = __VLS_267({
    label: (__VLS_ctx.getValueLabel()),
    prop: "value",
}, ...__VLS_functionalComponentArgsRest(__VLS_267));
__VLS_269.slots.default;
const __VLS_270 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_271 = __VLS_asFunctionalComponent(__VLS_270, new __VLS_270({
    modelValue: (__VLS_ctx.newVar.value),
    modelModifiers: { trim: true, },
    placeholder: (__VLS_ctx.getValuePlaceholder()),
    size: "large",
}));
const __VLS_272 = __VLS_271({
    modelValue: (__VLS_ctx.newVar.value),
    modelModifiers: { trim: true, },
    placeholder: (__VLS_ctx.getValuePlaceholder()),
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_271));
var __VLS_269;
var __VLS_239;
{
    const { footer: __VLS_thisSlot } = __VLS_235.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-footer" },
    });
    const __VLS_274 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_275 = __VLS_asFunctionalComponent(__VLS_274, new __VLS_274({
        ...{ 'onClick': {} },
        size: "large",
    }));
    const __VLS_276 = __VLS_275({
        ...{ 'onClick': {} },
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_275));
    let __VLS_278;
    let __VLS_279;
    let __VLS_280;
    const __VLS_281 = {
        onClick: (...[$event]) => {
            __VLS_ctx.dialogVisible = false;
        }
    };
    __VLS_277.slots.default;
    var __VLS_277;
    const __VLS_282 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_283 = __VLS_asFunctionalComponent(__VLS_282, new __VLS_282({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
    }));
    const __VLS_284 = __VLS_283({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_283));
    let __VLS_286;
    let __VLS_287;
    let __VLS_288;
    const __VLS_289 = {
        onClick: (__VLS_ctx.handleAddConfirm)
    };
    __VLS_285.slots.default;
    var __VLS_285;
}
var __VLS_235;
const __VLS_290 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_291 = __VLS_asFunctionalComponent(__VLS_290, new __VLS_290({
    modelValue: (__VLS_ctx.showLogsDialog),
    title: "操作日志",
    width: "80%",
    ...{ class: "logs-dialog" },
}));
const __VLS_292 = __VLS_291({
    modelValue: (__VLS_ctx.showLogsDialog),
    title: "操作日志",
    width: "80%",
    ...{ class: "logs-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_291));
__VLS_293.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logs-container" },
});
if (__VLS_ctx.operationLogs.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-logs" },
    });
    const __VLS_294 = {}.ElResult;
    /** @type {[typeof __VLS_components.ElResult, typeof __VLS_components.elResult, ]} */ ;
    // @ts-ignore
    const __VLS_295 = __VLS_asFunctionalComponent(__VLS_294, new __VLS_294({
        icon: "info",
        title: "暂无操作日志",
        subTitle: "开始使用应用后，操作记录将显示在这里",
    }));
    const __VLS_296 = __VLS_295({
        icon: "info",
        title: "暂无操作日志",
        subTitle: "开始使用应用后，操作记录将显示在这里",
    }, ...__VLS_functionalComponentArgsRest(__VLS_295));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "logs-list" },
    });
    for (const [log] of __VLS_getVForSourceType((__VLS_ctx.operationLogs))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (log.id),
            ...{ class: "log-item" },
            ...{ class: (`log-${log.type}`) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-header" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-type-icon" },
        });
        if (log.type === 'create') {
            const __VLS_298 = {}.ElIcon;
            /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
            // @ts-ignore
            const __VLS_299 = __VLS_asFunctionalComponent(__VLS_298, new __VLS_298({
                ...{ class: "create-icon" },
            }));
            const __VLS_300 = __VLS_299({
                ...{ class: "create-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_299));
            __VLS_301.slots.default;
            const __VLS_302 = {}.Plus;
            /** @type {[typeof __VLS_components.Plus, ]} */ ;
            // @ts-ignore
            const __VLS_303 = __VLS_asFunctionalComponent(__VLS_302, new __VLS_302({}));
            const __VLS_304 = __VLS_303({}, ...__VLS_functionalComponentArgsRest(__VLS_303));
            var __VLS_301;
        }
        if (log.type === 'update') {
            const __VLS_306 = {}.ElIcon;
            /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
            // @ts-ignore
            const __VLS_307 = __VLS_asFunctionalComponent(__VLS_306, new __VLS_306({
                ...{ class: "update-icon" },
            }));
            const __VLS_308 = __VLS_307({
                ...{ class: "update-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_307));
            __VLS_309.slots.default;
            const __VLS_310 = {}.Edit;
            /** @type {[typeof __VLS_components.Edit, ]} */ ;
            // @ts-ignore
            const __VLS_311 = __VLS_asFunctionalComponent(__VLS_310, new __VLS_310({}));
            const __VLS_312 = __VLS_311({}, ...__VLS_functionalComponentArgsRest(__VLS_311));
            var __VLS_309;
        }
        if (log.type === 'delete') {
            const __VLS_314 = {}.ElIcon;
            /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
            // @ts-ignore
            const __VLS_315 = __VLS_asFunctionalComponent(__VLS_314, new __VLS_314({
                ...{ class: "delete-icon" },
            }));
            const __VLS_316 = __VLS_315({
                ...{ class: "delete-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_315));
            __VLS_317.slots.default;
            const __VLS_318 = {}.Delete;
            /** @type {[typeof __VLS_components.Delete, ]} */ ;
            // @ts-ignore
            const __VLS_319 = __VLS_asFunctionalComponent(__VLS_318, new __VLS_318({}));
            const __VLS_320 = __VLS_319({}, ...__VLS_functionalComponentArgsRest(__VLS_319));
            var __VLS_317;
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-content" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-description" },
        });
        (log.description);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-details" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "log-category" },
        });
        (log.category);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "log-time" },
        });
        (__VLS_ctx.formatTime(log.timestamp));
        if (log.oldValue || log.newValue) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "log-values" },
            });
            if (log.oldValue) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "log-old-value" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "label" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "value-container" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "value" },
                });
                (log.oldValue);
                const __VLS_322 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_323 = __VLS_asFunctionalComponent(__VLS_322, new __VLS_322({
                    ...{ 'onClick': {} },
                    type: "text",
                    size: "small",
                    ...{ class: "copy-btn" },
                    icon: (__VLS_ctx.CopyDocument),
                    title: "复制原值",
                }));
                const __VLS_324 = __VLS_323({
                    ...{ 'onClick': {} },
                    type: "text",
                    size: "small",
                    ...{ class: "copy-btn" },
                    icon: (__VLS_ctx.CopyDocument),
                    title: "复制原值",
                }, ...__VLS_functionalComponentArgsRest(__VLS_323));
                let __VLS_326;
                let __VLS_327;
                let __VLS_328;
                const __VLS_329 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.operationLogs.length === 0))
                            return;
                        if (!(log.oldValue || log.newValue))
                            return;
                        if (!(log.oldValue))
                            return;
                        __VLS_ctx.copyToClipboard(log.fullOldValue || log.oldValue);
                    }
                };
                var __VLS_325;
            }
            if (log.newValue) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "log-new-value" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "label" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "value-container" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "value" },
                });
                (log.newValue);
                const __VLS_330 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_331 = __VLS_asFunctionalComponent(__VLS_330, new __VLS_330({
                    ...{ 'onClick': {} },
                    type: "text",
                    size: "small",
                    ...{ class: "copy-btn" },
                    icon: (__VLS_ctx.CopyDocument),
                    title: "复制新值",
                }));
                const __VLS_332 = __VLS_331({
                    ...{ 'onClick': {} },
                    type: "text",
                    size: "small",
                    ...{ class: "copy-btn" },
                    icon: (__VLS_ctx.CopyDocument),
                    title: "复制新值",
                }, ...__VLS_functionalComponentArgsRest(__VLS_331));
                let __VLS_334;
                let __VLS_335;
                let __VLS_336;
                const __VLS_337 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.operationLogs.length === 0))
                            return;
                        if (!(log.oldValue || log.newValue))
                            return;
                        if (!(log.newValue))
                            return;
                        __VLS_ctx.copyToClipboard(log.fullNewValue || log.newValue);
                    }
                };
                var __VLS_333;
            }
        }
    }
}
{
    const { footer: __VLS_thisSlot } = __VLS_293.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-footer" },
    });
    const __VLS_338 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_339 = __VLS_asFunctionalComponent(__VLS_338, new __VLS_338({
        ...{ 'onClick': {} },
        type: "danger",
        plain: true,
    }));
    const __VLS_340 = __VLS_339({
        ...{ 'onClick': {} },
        type: "danger",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_339));
    let __VLS_342;
    let __VLS_343;
    let __VLS_344;
    const __VLS_345 = {
        onClick: (__VLS_ctx.clearLogs)
    };
    __VLS_341.slots.default;
    var __VLS_341;
    const __VLS_346 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_347 = __VLS_asFunctionalComponent(__VLS_346, new __VLS_346({
        ...{ 'onClick': {} },
    }));
    const __VLS_348 = __VLS_347({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_347));
    let __VLS_350;
    let __VLS_351;
    let __VLS_352;
    const __VLS_353 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showLogsDialog = false;
        }
    };
    __VLS_349.slots.default;
    var __VLS_349;
}
var __VLS_293;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['app-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-title']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-info-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['config-path']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['el-icon--right']} */ ;
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
/** @type {__VLS_StyleScopedClasses['logs-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-container']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-logs']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-list']} */ ;
/** @type {__VLS_StyleScopedClasses['log-item']} */ ;
/** @type {__VLS_StyleScopedClasses['log-header']} */ ;
/** @type {__VLS_StyleScopedClasses['log-type-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['create-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['update-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['log-content']} */ ;
/** @type {__VLS_StyleScopedClasses['log-description']} */ ;
/** @type {__VLS_StyleScopedClasses['log-details']} */ ;
/** @type {__VLS_StyleScopedClasses['log-category']} */ ;
/** @type {__VLS_StyleScopedClasses['log-time']} */ ;
/** @type {__VLS_StyleScopedClasses['log-values']} */ ;
/** @type {__VLS_StyleScopedClasses['log-old-value']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['log-new-value']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-footer']} */ ;
// @ts-ignore
var __VLS_241 = __VLS_240;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArrowDown: ArrowDown,
            ChatDotRound: ChatDotRound,
            InfoFilled: InfoFilled,
            Document: Document,
            Plus: Plus,
            Edit: Edit,
            Delete: Delete,
            CopyDocument: CopyDocument,
            Setting: Setting,
            envVars: envVars,
            shellInfo: shellInfo,
            loading: loading,
            saving: saving,
            viewType: viewType,
            selectedCategory: selectedCategory,
            operationLogs: operationLogs,
            showLogsDialog: showLogsDialog,
            categories: categories,
            viewOptions: viewOptions,
            getEmptyDescription: getEmptyDescription,
            getPlaceholder: getPlaceholder,
            error: error,
            searchQuery: searchQuery,
            hasChanges: hasChanges,
            sourceContent: sourceContent,
            sourceLoading: sourceLoading,
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
            handleSourceContentChange: handleSourceContentChange,
            handleViewTypeChange: handleViewTypeChange,
            handleDropdownCommand: handleDropdownCommand,
            copyToClipboard: copyToClipboard,
            formatTime: formatTime,
            clearLogs: clearLogs,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
