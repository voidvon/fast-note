// 测试路由匹配逻辑
const testPaths = [
  '/user123/n/note456', // 应该匹配（其他用户的备忘录）
  '/n/note456', // 不应该匹配（自己的备忘录）
  '/user123/f/folder456', // 不应该匹配（文件夹）
  '/user123/n/', // 不应该匹配（缺少noteId）
  '/user123/n/note456/edit', // 不应该匹配（有额外路径）
  '/', // 不应该匹配（根路径）
  '/home', // 不应该匹配（首页）
]

const userContextRegex = /^\/[^/]+\/n\/[^/]+$/

testPaths.forEach((path) => {
  const isMatch = userContextRegex.test(path)
  console.log(`${path}: ${isMatch ? '✓ 匹配（使用签名URL）' : '✗ 不匹配（直接下载）'}`)
})
