import { dialogController } from '@/shared/ui/f7'

export function promptFolderName(defaultValue = '') {
  return dialogController.prompt({
    title: '新建文件夹',
    text: '请输入文件夹名称',
    defaultValue,
  })
}
