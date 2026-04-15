import { defineConfig, transformerDirectives } from 'unocss'

// 定义主题颜色
const theme = {
  // 白天模式颜色
  light: {
    // 黄色系
    'yellow': {
      300: '#f5c94d', // 浅黄
      500: '#e9b730', // 主色调 - primary
    },
    // 红色系
    'red': {
      500: '#f44336', // 主色调 - danger
    },
    // 蓝色系
    'blue': {
      500: '#2196f3', // 更多菜单 - 扫描
    },
    // 纯灰色系
    'gray': {
      0: '#000', // 黑色
      100: '#333333', // 浅灰
      700: '#cccccc', // 中灰 - 固定工具栏 - 禁用
      900: '#f5f5f5', // 浅灰 - tooltip工具栏 - 背景
      1000: '#fff', // 白色
    },
    // 偏蓝灰色系
    'blue-gray': {
      300: '#5c5d68', // 浅偏蓝灰 - 更多菜单/工具栏格式 - x
      400: '#6e6f79', // 浅偏蓝灰 - 列表简介文字/搜索框placeholder
      700: '#e6e6e8', // 浅偏蓝灰 - 列表 - 锁定背景
      800: '#f0f0f2', // 浅偏蓝灰 - 更多弹窗 - ionItem 背景
      900: '#f8f8fa', // 浅偏蓝灰 - 更多弹窗背景/ionItem 禁用背景
      950: '#e3e3e8', // 浅偏蓝灰 - input 背景
    },
    // 偏紫灰色系
    'purple-gray': {
      350: '#6a696f', // 浅偏紫灰 - 列表 - 数量文字
      400: '#7a797d', // 浅偏紫灰 - 搜索框 - x
      500: '#9e9da1', // 中偏紫灰 - 列表 - 禁用文字
      550: '#a9a8ac', // 中偏紫灰 - 列表 - 箭头
      700: '#e8e7eb', // 浅偏紫灰 - 更多弹窗active背景/列表分割线
      800: '#f0eff2', // 浅偏紫灰 - 更多菜单 - x背景
      850: '#f5f4f7', // 浅偏紫灰 - 固定工具栏/格式 - active 文字
      900: '#fafafa', // 浅偏紫灰 - 搜索框 - 附件背景
    },
  },
  // 黑夜模式颜色
  dark: {
    // 黄色系
    'yellow': {
      300: '#f2bc40', // 浅黄
      500: '#dab13d', // 主色调 - primary
    },
    // 红色系
    'red': {
      500: '#ea5546', // 主色调 - danger
    },
    // 蓝色系
    'blue': {
      500: '#3b82f5', // 更多菜单 - 扫描
    },
    // 纯灰色系
    'gray': {
      0: '#fff', // 白色
      100: '#dcdcdc', // 浅灰
      700: '#404040', // 中灰 - 固定工具栏 - 禁用
      900: '#202020', // 深灰 - tooltip工具栏 - 背景
      1000: '#000', // 黑色
    },
    // 偏蓝灰色系
    'blue-gray': {
      300: '#a1a2aa', // 浅偏蓝灰 - 更多菜单/工具栏格式 - x
      400: '#9b9ca4', // 浅偏蓝灰 - 列表简介文字/搜索框placeholder
      700: '#3a3a3c', // 深偏蓝灰 - 列表 - 锁定背景
      800: '#2c2c2e', // 深偏蓝灰 - 更多弹窗 - ionItem 背景
      900: '#242426', // 深偏蓝灰 - 更多弹窗背景/ionItem 禁用背景
      950: '#1c1c1e', // 深偏蓝灰 - input 背景
    },
    // 偏紫灰色系
    'purple-gray': {
      350: '#99989e', // 浅偏紫灰 - 列表 - 数量文字
      400: '#8e8d91', // 浅偏紫灰 - 搜索框 - x
      500: '#656468', // 中偏紫灰 - 列表 - 禁用文字
      550: '#5b5a5e', // 中偏紫灰 - 列表 - 箭头
      700: '#3d3c40', // 深偏紫灰 - 更多弹窗active背景/列表分割线
      800: '#363539', // 深偏紫灰 - 更多菜单 - x背景
      850: '#313034', // 深偏紫灰 - 固定工具栏/格式 - active 文字
      900: '#262529', // 深偏紫灰 - 搜索框 - 附件背景
    },
  },
}

// 获取当前主题模式（这里可以根据实际情况修改，例如从localStorage或其他配置中获取）
// 默认使用亮色主题作为基础主题
const currentTheme = 'light'

export default defineConfig({
  transformers: [
    transformerDirectives(),
  ],
  shortcuts: [
    ['text-elipsis', 'overflow-hidden text-ellipsis whitespace-nowrap'],
  ],
  theme: {
    colors: {
      // 基础颜色（默认为亮色主题）
      // 黄色系
      'yellow': {
        300: theme[currentTheme].yellow[300],
        500: theme[currentTheme].yellow[500],
      },
      // 红色系
      'red': {
        500: theme[currentTheme].red[500],
      },
      // 蓝色系
      'blue': {
        500: theme[currentTheme].blue[500],
      },
      // 纯灰色系
      'gray': {
        0: theme[currentTheme].gray[0],
        100: theme[currentTheme].gray[100],
        700: theme[currentTheme].gray[700],
        900: theme[currentTheme].gray[900],
        1000: theme[currentTheme].gray[1000],
      },
      // 偏蓝灰色系
      'blue-gray': {
        300: theme[currentTheme]['blue-gray'][300],
        400: theme[currentTheme]['blue-gray'][400],
        700: theme[currentTheme]['blue-gray'][700],
        800: theme[currentTheme]['blue-gray'][800],
        900: theme[currentTheme]['blue-gray'][900],
        950: theme[currentTheme]['blue-gray'][950],
      },
      // 偏紫灰色系
      'purple-gray': {
        350: theme[currentTheme]['purple-gray'][350],
        400: theme[currentTheme]['purple-gray'][400],
        500: theme[currentTheme]['purple-gray'][500],
        550: theme[currentTheme]['purple-gray'][550],
        700: theme[currentTheme]['purple-gray'][700],
        800: theme[currentTheme]['purple-gray'][800],
        850: theme[currentTheme]['purple-gray'][850],
        900: theme[currentTheme]['purple-gray'][900],
      },
      'primary': theme[currentTheme].yellow[500],
      'danger': theme[currentTheme].red[500],

      // 明确的暗色主题颜色（带有dark-前缀）
      'dark-yellow': {
        300: theme.dark.yellow[300],
        500: theme.dark.yellow[500],
      },
      'dark-red': {
        500: theme.dark.red[500],
      },
      'dark-blue': {
        500: theme.dark.blue[500],
      },
      'dark-gray': {
        0: theme.dark.gray[0],
        100: theme.dark.gray[100],
        700: theme.dark.gray[700],
        900: theme.dark.gray[900],
        1000: theme.dark.gray[1000],
      },
      'dark-blue-gray': {
        300: theme.dark['blue-gray'][300],
        400: theme.dark['blue-gray'][400],
        700: theme.dark['blue-gray'][700],
        800: theme.dark['blue-gray'][800],
        900: theme.dark['blue-gray'][900],
        950: theme.dark['blue-gray'][950],
      },
      'dark-purple-gray': {
        350: theme.dark['purple-gray'][350],
        400: theme.dark['purple-gray'][400],
        500: theme.dark['purple-gray'][500],
        550: theme.dark['purple-gray'][550],
        700: theme.dark['purple-gray'][700],
        800: theme.dark['purple-gray'][800],
        850: theme.dark['purple-gray'][850],
        900: theme.dark['purple-gray'][900],
      },
      'dark-primary': theme.dark.yellow[500],
      'dark-danger': theme.dark.red[500],
    },
  },
})
