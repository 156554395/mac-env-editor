<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <div class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <div class="logo-icon">⚙️</div>
          <h1 class="app-title">环境变量管理器</h1>
        </div>
        <div class="shell-info-badge" v-if="shellInfo">
          <span class="shell-name">{{ shellInfo.shellName }}</span>
          <span class="config-path">{{ shellInfo.activeConfig }}</span>
        </div>
      </div>

      <div class="header-actions">
        <el-button
          type="info"
          :icon="'Refresh'"
          @click="handleRefresh"
          :loading="loading"
        >
          刷新
        </el-button>
        <el-button
          type="warning"
          :icon="'FolderOpened'"
          :disabled="!hasChanges"
          @click="handleBackup"
        >
          备份配置
        </el-button>
        <el-button
          type="primary"
          :icon="'Check'"
          :disabled="!hasChanges"
          @click="handleSave"
          :loading="saving"
        >
          保存更改
        </el-button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="app-body">
      <!-- 左侧控制面板 -->
      <div class="control-panel">
        <!-- 视图切换器 -->
        <div class="view-switcher">
          <h3 class="panel-title">视图模式</h3>
          <el-segmented v-model="viewType" :options="viewOptions" size="large" @change="handleViewTypeChange" />
        </div>

        <!-- 分类过滤器 -->
        <div class="category-filter" v-if="viewType === 'all'">
          <h3 class="panel-title">分类筛选</h3>
          <div class="category-grid">
            <div
              v-for="category in categories"
              :key="category.name"
              class="category-card"
              :class="{ active: selectedCategory === category.name }"
              @click="selectCategory(category.name)"
            >
              <div class="category-icon" :style="{ backgroundColor: category.color }">
                {{ getCategoryIcon(category.name) }}
              </div>
              <div class="category-info">
                <span class="category-name">{{ category.name }}</span>
                <span class="category-count">{{ getCategoryCount(category.name) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="stats-panel">
          <h3 class="panel-title">统计信息</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">{{ envVars.filter(v => v.type === 'env').length }}</div>
              <div class="stat-label">环境变量</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ envVars.filter(v => v.type === 'alias').length }}</div>
              <div class="stat-label">别名</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ envVars.filter(v => v.key.includes('PATH')).length }}</div>
              <div class="stat-label">PATH 相关</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 主工作区 -->
      <div class="main-workspace">
        <!-- 工具栏 -->
        <div class="workspace-toolbar">
          <div class="toolbar-left">
            <h2 class="workspace-title">{{ getCurrentTitle() }}</h2>
            <div class="result-count">
              共 <span class="count-number">{{ filteredEnvVars.length }}</span> 项
            </div>
          </div>

          <div class="toolbar-right">
            <el-input
              v-model="searchQuery"
              placeholder="搜索环境变量或别名..."
              class="search-input"
              clearable
              :prefix-icon="'Search'"
            />
            <el-dropdown @command="handleAddCommand" trigger="click">
              <el-button type="primary" size="large" :icon="'Plus'">
                添加
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="env" :icon="'Setting'">环境变量</el-dropdown-item>
                  <el-dropdown-item command="alias" :icon="'Link'">别名</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="workspace-content">
          <div v-if="loading" class="loading-state">
            <el-skeleton :rows="8" animated />
            <div class="loading-text">正在加载配置文件...</div>
          </div>

          <div v-else-if="error" class="error-state">
            <el-result
              icon="error"
              title="加载失败"
              :sub-title="error"
            >
              <template #extra>
                <el-button type="primary" @click="handleRefresh">重新加载</el-button>
              </template>
            </el-result>
          </div>

          <!-- 源码编辑视图 -->
          <div v-else-if="viewType === 'source'" class="source-editor-container">
            <div v-if="sourceLoading" class="loading-state">
              <el-skeleton :rows="8" animated />
              <div class="loading-text">正在加载源码...</div>
            </div>
            <div v-else class="source-editor">
              <div class="source-editor-toolbar">
                <div class="toolbar-left">
                  <el-tag type="info" size="large">
                    <i class="el-icon-document"></i>
                    {{ sourceFilePath }}
                  </el-tag>
                </div>
                <div class="toolbar-right">
                  <el-button
                    type="success"
                    :icon="'Check'"
                    @click="saveSourceContent"
                    :loading="sourceSaving"
                    :disabled="!hasChanges"
                    size="large"
                  >
                    保存文件
                  </el-button>
                </div>
              </div>
              <div class="source-editor-content">
                <el-input
                  v-model="sourceContent"
                  type="textarea"
                  :rows="20"
                  placeholder="请输入配置文件内容..."
                  @input="handleSourceContentChange"
                  class="source-textarea"
                />
              </div>
              <div class="source-editor-footer">
                <div class="footer-info">
                  <span class="line-count">行数: {{ sourceContent.split('\n').length }}</span>
                  <span class="char-count">字符: {{ sourceContent.length }}</span>
                  <span v-if="hasChanges" class="change-indicator">• 未保存的更改</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="filteredEnvVars.length === 0" class="empty-state">
            <el-result
              icon="info"
              title="暂无数据"
              :sub-title="getEmptyDescription()"
            >
              <template #extra>
                <el-button type="primary" @click="showAddDialog()">添加第一个</el-button>
              </template>
            </el-result>
          </div>

          <div v-else class="data-table">
            <el-table
              :data="filteredEnvVars"
              style="width: 100%"
              :row-class-name="getRowClassName"
              stripe
              size="large"
            >
              <el-table-column
                prop="type"
                label="类型"
                width="120"
                v-if="viewType === 'all'"
                align="center"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="row.type === 'env' ? 'success' : 'warning'"
                    size="large"
                    effect="dark"
                  >
                    <i :class="row.type === 'env' ? 'el-icon-setting' : 'el-icon-link'"></i>
                    {{ row.type === 'env' ? 'ENV' : 'ALIAS' }}
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column prop="key" label="名称" width="250">
                <template #default="{ row }">
                  <div class="key-cell">
                    <el-input
                      v-model="row.key"
                      :class="{ 'invalid-input': !isVarNameValid(row.key) }"
                      @input="handleKeyChange(row)"
                      placeholder="变量名称"
                      size="large"
                      class="key-input"
                    />
                    <el-tag
                      v-if="row.category && viewType === 'all'"
                      size="small"
                      :color="getCategoryColor(row.category)"
                      class="category-tag"
                    >
                      {{ row.category }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="value" label="值">
                <template #default="{ row }">
                  <el-input
                    v-model="row.value"
                    :class="{ 'invalid-input': !row.isValid }"
                    @input="handleValueChange(row)"
                    :placeholder="getPlaceholder(row.type)"
                    size="large"
                  />
                </template>
              </el-table-column>

              <el-table-column width="120" label="操作" align="center">
                <template #default="{ row, $index }">
                  <el-button
                    type="danger"
                    size="large"
                    :icon="'Delete'"
                    @click="handleDelete($index)"
                    text
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加变量对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="getDialogTitle()"
      width="600px"
      :show-close="false"
      class="add-dialog"
    >
      <el-form :model="newVar" :rules="rules" ref="varForm" label-width="120px" size="large">
        <el-form-item label="类型" prop="type" v-if="showTypeSelector">
          <el-radio-group v-model="newVar.type" size="large">
            <el-radio-button value="env">环境变量</el-radio-button>
            <el-radio-button value="alias">别名</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="getKeyLabel()" prop="key">
          <el-input
            v-model="newVar.key"
            :placeholder="getKeyPlaceholder()"
            :class="{ 'invalid-input': !isVarNameValid(newVar.key) }"
            size="large"
          />
        </el-form-item>
        <el-form-item :label="getValueLabel()" prop="value">
          <el-input
            v-model="newVar.value"
            :placeholder="getValuePlaceholder()"
            size="large"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" size="large">取消</el-button>
          <el-button type="primary" @click="handleAddConfirm" size="large">确定添加</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import { EnvironmentVariable, ShellInfo, EnvData } from '../../types'

declare global {
  interface Window {
    electronAPI: {
      getEnvVars: () => Promise<{ success: boolean; data?: EnvData; error?: string }>
      saveEnvVars: (data: EnvData) => Promise<{ success: boolean; message?: string; error?: string }>
      backupConfig: (configFile?: string) => Promise<{ success: boolean; backupPath?: string; error?: string }>
      getShellInfo: () => Promise<{ success: boolean; data?: ShellInfo; error?: string }>
      getConfigFileContent: (configFile?: string) => Promise<{ success: boolean; data?: { content: string; filePath: string; fileName: string }; error?: string }>
      saveConfigFileContent: (data: { content: string; filePath?: string }) => Promise<{ success: boolean; message?: string; filePath?: string; error?: string }>
    }
  }
}

// 状态管理
const envVars = ref<EnvironmentVariable[]>([])
const originalEnvVars = ref<EnvironmentVariable[]>([])
const shellInfo = ref<ShellInfo | null>(null)
const loading = ref(false)
const saving = ref(false)
const viewType = ref('all')
const selectedCategory = ref('all')

// 分类定义
const categories = ref([
  { name: 'all', color: '#409eff', prefix: '' },
  { name: '环境变量', color: '#67c23a', prefix: '' },
  { name: '别名', color: '#e6a23c', prefix: 'alias' },
  { name: 'PATH', color: '#f56c6c', prefix: 'PATH' }
])

// 视图选项
const viewOptions = [
  { label: '全部', value: 'all' },
  { label: '环境变量', value: 'env' },
  { label: '别名', value: 'alias' },
  { label: '源码编辑', value: 'source' }
]

// 获取空状态提示文本
const getEmptyDescription = () => {
  if (!shellInfo.value) {
    return '正在加载Shell信息...'
  }
  if (searchQuery.value) {
    return '没有找到匹配的环境变量'
  }
  switch (viewType.value) {
    case 'all':
      return '当前没有配置任何环境变量'
    case 'env':
      return '当前没有配置任何环境变量'
    case 'alias':
      return '当前没有配置任何别名'
    default:
      return '当前没有配置任何环境变量'
  }
}
// 获取输入框占位符
const getPlaceholder = (type: string) => {
  switch (type) {
    case 'env':
      return '输入环境变量值'
    case 'alias':
      return '输入别名命令'
    case 'path':
      return '输入路径，多路径用冒号分隔'
    default:
      return '输入值'
  }
}

const error = ref('')
const searchQuery = ref('')
const hasChanges = ref(false)

// 源码编辑相关状态
const sourceContent = ref('')
const originalSourceContent = ref('')
const sourceFileName = ref('')
const sourceFilePath = ref('')
const sourceLoading = ref(false)
const sourceSaving = ref(false)

// 自动保存防抖
let autoSaveTimer: NodeJS.Timeout | null = null

const scheduleAutoSave = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(async () => {
    if (hasChanges.value) {
      console.log('自动保存中...')
      await saveChangesToFile()
    }
  }, 2000) // 2秒后自动保存
}

// 添加变量对话框
const dialogVisible = ref(false)
const varForm = ref()

const newVar = reactive({
  key: '',
  value: '',
  type: 'env' as 'env' | 'alias'
})

const rules = {
  key: [
    { required: true, message: '请输入变量名', trigger: 'blur' }
  ],
  value: [
    { required: true, message: '请输入变量值', trigger: 'blur' }
  ]
}

// 计算属性
const showTypeSelector = computed(() => {
  return viewType.value === 'all' && selectedCategory.value === 'all'
})

const getDialogTitle = () => {
  if (newVar.type === 'alias') {
    return '添加别名'
  } else {
    return '添加环境变量'
  }
}

const getKeyLabel = () => {
  return newVar.type === 'alias' ? '别名名称' : '变量名'
}

const getValueLabel = () => {
  return newVar.type === 'alias' ? '别名命令' : '变量值'
}

const getKeyPlaceholder = () => {
  if (newVar.type === 'alias') {
    return '例如: ll'
  } else {
    return '例如: PATH'
  }
}

const getValuePlaceholder = () => {
  if (newVar.type === 'alias') {
    return '例如: ls -la'
  } else {
    return '例如: /usr/local/bin'
  }
}
const filteredEnvVars = computed(() => {
  let filtered = envVars.value

  // 根据视图类型过滤
  if (viewType.value === 'env') {
    filtered = filtered.filter(item => item.type === 'env')
  } else if (viewType.value === 'alias') {
    filtered = filtered.filter(item => item.type === 'alias')
  }

  // 根据分类过滤
  if (selectedCategory.value !== 'all') {
    if (selectedCategory.value === '环境变量') {
      filtered = filtered.filter(item => item.type === 'env')
    } else if (selectedCategory.value === '别名') {
      filtered = filtered.filter(item => item.type === 'alias')
    } else if (selectedCategory.value === 'PATH') {
      filtered = filtered.filter(item => item.key.includes('PATH'))
    }
  }

  // 根据搜索查询过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(env =>
      env.key.toLowerCase().includes(query) ||
      env.value.toLowerCase().includes(query)
    )
  }

  return filtered
})

// 方法定义
const loadData = async () => {
  loading.value = true
  error.value = ''

  try {
    const [envResult, shellResult] = await Promise.all([
      window.electronAPI.getEnvVars(),
      window.electronAPI.getShellInfo()
    ])

    if (envResult.success && envResult.data) {
      const envData = envResult.data
      const parsed: EnvironmentVariable[] = []

      // 处理环境变量
      Object.entries(envData.env || {}).forEach(([key, value]) => {
        parsed.push({
          key,
          value: value as string,
          type: 'env',
          isValid: true,
          category: key.includes('PATH') ? 'PATH' : '环境变量'
        })
      })

      // 处理别名
      Object.entries(envData.aliases || {}).forEach(([key, value]) => {
        parsed.push({
          key,
          value: value as string,
          type: 'alias',
          isValid: true,
          category: '别名'
        })
      })

      envVars.value = parsed.sort((a, b) => a.key.localeCompare(b.key))
      originalEnvVars.value = JSON.parse(JSON.stringify(parsed))
    } else {
      error.value = envResult.error || '加载环境变量失败'
    }

    if (shellResult.success && shellResult.data) {
      shellInfo.value = shellResult.data
    }
  } catch (err: any) {
    error.value = `加载失败: ${err?.message || String(err)}`
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  loadData()
}

const handleValueChange = (row: EnvironmentVariable) => {
  row.isValid = validateEnvironmentVariable(row.key, row.value)
  checkChanges()
  scheduleAutoSave()
}

const handleKeyChange = (row: EnvironmentVariable) => {
  // 验证变量名
  row.isValid = isVarNameValid(row.key)

  // 更新分类
  if (row.type === 'env') {
    row.category = row.key.includes('PATH') ? 'PATH' : '环境变量'
  } else {
    row.category = '别名'
  }

  checkChanges()
  scheduleAutoSave()
}

const validateEnvironmentVariable = (key: string, value: string): boolean => {
  if (!key || typeof key !== 'string') return false

  const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if (!keyRegex.test(key)) return false

  return true
}

const isVarNameValid = (name: string): boolean => {
  return validateEnvironmentVariable(name, '')
}

const checkChanges = () => {
  const current = JSON.stringify(envVars.value)
  const original = JSON.stringify(originalEnvVars.value)
  hasChanges.value = current !== original
}

const handleAddConfirm = async () => {
  varForm.value?.validate(async (valid: boolean) => {
    if (valid && isVarNameValid(newVar.key)) {
      const category = newVar.type === 'alias' ? '别名' :
                     newVar.key.includes('PATH') ? 'PATH' : '环境变量'

      // 检查是否已存在
      const existingIndex = envVars.value.findIndex(v => v.key === newVar.key && v.type === newVar.type)
      if (existingIndex !== -1) {
        ElMessage.error('该名称已存在')
        return
      }

      // 添加到数组
      envVars.value.push({
        key: newVar.key.toUpperCase(),
        value: newVar.value,
        type: newVar.type,
        isValid: true,
        category
      })
      envVars.value.sort((a, b) => a.key.localeCompare(b.key))

      // 自动保存到文件
      await saveChangesToFile()

      dialogVisible.value = false
      const itemType = newVar.type === 'alias' ? '别名' : '环境变量'
      ElMessage.success(`${itemType}已添加并保存`)
    } else {
      ElMessage.error('请输入有效的名称和值')
    }
  })
}

// 统一的保存方法
const saveChangesToFile = async () => {
  try {
    const envData: EnvData = {
      env: {},
      aliases: {}
    }

    envVars.value.forEach(item => {
      if (item.isValid) {
        if (item.type === 'env') {
          envData.env[item.key] = item.value
        } else if (item.type === 'alias') {
          envData.aliases[item.key] = item.value
        }
      }
    })

    const result = await window.electronAPI.saveEnvVars(envData)

    if (result.success) {
      originalEnvVars.value = JSON.parse(JSON.stringify(envVars.value))
      hasChanges.value = false
      return true
    } else {
      ElMessage.error(result.error || '保存失败')
      return false
    }
  } catch (err: any) {
    ElMessage.error(`保存失败: ${err?.message || String(err)}`)
    return false
  }
}

const handleDelete = async (index: number) => {
  const item = filteredEnvVars.value[index]
  const itemType = item.type === 'alias' ? '别名' : '环境变量'

  ElMessageBox.confirm(
    `确定要删除${itemType} "${item.key}" 吗？`,
    '确认删除',
    {
      type: 'warning'
    }
  ).then(async () => {
    // 从原数组中找到并删除该项
    const originalIndex = envVars.value.findIndex(v => v.key === item.key && v.type === item.type)
    if (originalIndex !== -1) {
      envVars.value.splice(originalIndex, 1)
      checkChanges()

      // 自动保存到文件
      const success = await saveChangesToFile()
      if (success) {
        ElMessage.success(`${itemType}已删除并保存`)
      }
    }
  }).catch(() => {})
}

const handleSave = async () => {
  saving.value = true

  try {
    const success = await saveChangesToFile()
    if (success) {
      ElMessage.success('保存成功')
    }
  } finally {
    saving.value = false
  }
}

const handleBackup = async () => {
  try {
    const result = await window.electronAPI.backupConfig()

    if (result.success) {
      ElMessage.success(`备份成功: ${result.backupPath}`)
    } else {
      ElMessage.error(result.error || '备份失败')
    }
  } catch (err: any) {
    ElMessage.error(`备份失败: ${err?.message || String(err)}`)
  }
}

// 分类和视图相关函数
const selectCategory = (category: string) => {
  selectedCategory.value = category
}

const getCategoryCount = (categoryName: string) => {
  if (categoryName === 'all') return envVars.value.length
  if (categoryName === '环境变量') {
    return envVars.value.filter(v => v.type === 'env').length
  }
  if (categoryName === '别名') {
    return envVars.value.filter(v => v.type === 'alias').length
  }
  if (categoryName === 'PATH') {
    return envVars.value.filter(v => v.key.includes('PATH')).length
  }
  return 0
}

const getCategoryColor = (categoryName: string) => {
  const category = categories.value.find(c => c.name === categoryName)
  return category?.color || '#909399'
}

const showAddDialog = () => {
  if (selectedCategory.value === 'all') {
    newVar.type = 'env'
  } else {
    newVar.type = selectedCategory.value === '别名' ? 'alias' : 'env'
  }
  newVar.key = ''
  newVar.value = ''
  dialogVisible.value = true
}

const handleAdd = (type?: 'env' | 'alias') => {
  newVar.type = type || 'env'
  newVar.key = ''
  newVar.value = ''
  dialogVisible.value = true
}

// 获取分类图标
const getCategoryIcon = (categoryName: string) => {
  switch (categoryName) {
    case 'all': return '📋'
    case '环境变量': return '⚙️'
    case '别名': return '🔗'
    case 'PATH': return '🛤️'
    default: return '📄'
  }
}

// 获取行类名
const getRowClassName = ({ row }: { row: EnvironmentVariable }) => {
  if (!row.isValid) return 'error-row'
  if (row.type === 'alias') return 'alias-row'
  if (row.key.includes('PATH')) return 'path-row'
  return ''
}

// 添加命令处理
const handleAddCommand = (command: string) => {
  handleAdd(command as 'env' | 'alias')
}

// 获取当前标题
const getCurrentTitle = () => {
  switch (viewType.value) {
    case 'all':
      return '所有环境变量'
    case 'env':
      return '环境变量'
    case 'alias':
      return '别名'
    case 'source':
      return `源码编辑 - ${sourceFileName.value || '配置文件'}`
    default:
      return '环境变量'
  }
}

// 源码编辑功能
const loadSourceContent = async () => {
  sourceLoading.value = true

  try {
    const result = await window.electronAPI.getConfigFileContent()

    if (result.success && result.data) {
      sourceContent.value = result.data.content
      originalSourceContent.value = result.data.content
      sourceFileName.value = result.data.fileName
      sourceFilePath.value = result.data.filePath
    } else {
      ElMessage.error(result.error || '加载配置文件失败')
    }
  } catch (err: any) {
    ElMessage.error(`加载失败: ${err?.message || String(err)}`)
  } finally {
    sourceLoading.value = false
  }
}

const saveSourceContent = async () => {
  sourceSaving.value = true

  try {
    const result = await window.electronAPI.saveConfigFileContent({
      content: sourceContent.value,
      filePath: sourceFilePath.value
    })

    if (result.success) {
      originalSourceContent.value = sourceContent.value
      ElMessage.success(result.message || '配置文件已保存')
      // 重新加载环境变量数据
      await loadData()
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (err: any) {
    ElMessage.error(`保存失败: ${err?.message || String(err)}`)
  } finally {
    sourceSaving.value = false
  }
}

const handleSourceContentChange = () => {
  // 检查源码是否有变化
  const hasSourceChanges = sourceContent.value !== originalSourceContent.value
  hasChanges.value = hasSourceChanges
}

const handleViewTypeChange = () => {
  selectedCategory.value = 'all'

  // 如果切换到源码编辑模式，加载源码内容
  if (viewType.value === 'source') {
    loadSourceContent()
  }
}

// 生命周期
onMounted(() => {
  loadData()
})

onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
})
</script>

<style>
/* 全局样式重置 */
* {
  box-sizing: border-box;
}

/* 应用容器 */
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部导航栏 */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.shell-info-badge {
  display: flex;
  flex-direction: column;
  background: rgba(103, 126, 234, 0.1);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(103, 126, 234, 0.2);
}

.shell-name {
  font-weight: 600;
  color: #667eea;
  font-size: 14px;
}

.config-path {
  font-size: 12px;
  color: #6b7280;
  font-family: 'Monaco', 'Menlo', monospace;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 主体区域 */
.app-body {
  flex: 1;
  display: flex;
  padding: 24px;
  gap: 24px;
  overflow: hidden;
}

/* 左侧控制面板 */
.control-panel {
  width: 320px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.panel-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

/* 视图切换器 */
.view-switcher {
  .el-segmented {
    width: 100%;
  }
}

/* 分类过滤器 */
.category-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.category-card:hover {
  background: rgba(103, 126, 234, 0.05);
  transform: translateY(-2px);
}

.category-card.active {
  background: rgba(103, 126, 234, 0.1);
  border-color: rgba(103, 126, 234, 0.3);
  box-shadow: 0 4px 16px rgba(103, 126, 234, 0.2);
}

.category-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.category-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.category-name {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.category-count {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

/* 统计面板 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, rgba(103, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border-radius: 12px;
  border: 1px solid rgba(103, 126, 234, 0.2);
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #667eea;
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  font-weight: 500;
}

/* 主工作区 */
.main-workspace {
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 工具栏 */
.workspace-toolbar {
  padding: 24px 32px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(249, 250, 251, 0.8);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.workspace-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
}

.result-count {
  color: #6b7280;
  font-size: 14px;
}

.count-number {
  font-weight: 600;
  color: #667eea;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-input {
  width: 300px;
}

/* 工作区内容 */
.workspace-content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

/* 状态页面 */
.loading-state {
  text-align: center;
  padding: 60px 0;
}

.loading-text {
  margin-top: 24px;
  color: #6b7280;
  font-size: 16px;
}

.error-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}

/* 数据表格 */
.data-table {
  .el-table {
    background: transparent;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  }

  .el-table__header {
    background: rgba(249, 250, 251, 0.8);
  }

  .el-table th {
    background: transparent !important;
    border-bottom: 2px solid rgba(0, 0, 0, 0.06);
    font-weight: 600;
    color: #374151;
  }

  .el-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  }

  .el-table__row {
    transition: all 0.3s ease;
  }

  .el-table__row:hover {
    background: rgba(103, 126, 234, 0.03) !important;
  }

  .error-row {
    background: rgba(239, 68, 68, 0.05) !important;
  }

  .alias-row {
    background: rgba(245, 158, 11, 0.05) !important;
  }

  .path-row {
    background: rgba(16, 185, 129, 0.05) !important;
  }
}

/* 表格单元格 */
.key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.key-input .el-input__wrapper {
  background: rgba(103, 126, 234, 0.1);
  border: 1px solid rgba(103, 126, 234, 0.2);
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  font-weight: 600;
}

.key-input .el-input__inner {
  color: #667eea;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  font-weight: 600;
}

.key-input .el-input__wrapper:hover {
  border-color: rgba(103, 126, 234, 0.4);
}

.key-input .el-input__wrapper.is-focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(103, 126, 234, 0.2);
}

.key-name {
  background: rgba(103, 126, 234, 0.1);
  color: #667eea;
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(103, 126, 234, 0.2);
}

.category-tag {
  border: none !important;
}

/* 输入框样式 */
.invalid-input .el-input__wrapper {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2) !important;
}

/* 对话框样式 */
.add-dialog {
  .el-dialog {
    border-radius: 16px;
    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .el-dialog__header {
    background: rgba(255, 255, 255, 0.98);
    color: #1a1a1a;
    border-radius: 16px 16px 0 0;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .el-dialog__title {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
  }

  .el-dialog__body {
    padding: 24px;
    background: rgba(255, 255, 255, 0.98);
  }

  .el-dialog__headerbtn {
    top: 20px;
    right: 20px;

    .el-dialog__close {
      color: #6b7280;
      font-size: 18px;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px 32px;
  background: rgba(249, 250, 251, 0.5);
  border-radius: 0 0 20px 20px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .control-panel {
    width: 280px;
  }

  .app-body {
    padding: 16px;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }

  .control-panel {
    width: 100%;
    height: auto;
  }

  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .search-input {
    width: 100%;
  }
}

/* 源码编辑器样式 */
.source-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.source-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.source-editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(249, 250, 251, 0.8);
}

.source-editor-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.source-textarea {
  flex: 1;
}

.source-textarea .el-textarea__inner {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  min-height: 500px !important;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 20px;
}

.source-textarea .el-textarea__inner:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(103, 126, 234, 0.2);
}

.source-editor-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(249, 250, 251, 0.5);
}

.footer-info {
  display: flex;
  gap: 24px;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.change-indicator {
  color: #f59e0b;
  font-weight: 600;
}
</style>