/**
 * 测试新的时间格式
 * 验证空格分隔的时间格式是否正常工作
 */

// 模拟新的 getTime 函数
function getTime(date) {
  return new Date(date || Date.now()).toISOString().replace('T', ' ')
}

console.log('=== 时间格式测试 ===\n')

// 1. 测试时间生成
const now = getTime()
console.log('1. 当前时间格式:', now)
console.log('   格式正确:', now.includes(' ') && !now.includes('T'))

// 2. 测试时间解析
const parsedDate = new Date(now)
console.log('\n2. 时间解析测试:')
console.log('   原始字符串:', now)
console.log('   解析后:', parsedDate.toISOString())
console.log('   解析成功:', !isNaN(parsedDate.getTime()))

// 3. 测试字符串比较
const time1 = getTime('2026-02-11 10:30:45.123Z')
const time2 = getTime('2026-02-11 09:30:45.123Z')
const time3 = getTime('2026-02-12 08:30:45.123Z')

console.log('\n3. 字符串比较测试:')
console.log('   时间1:', time1)
console.log('   时间2:', time2)
console.log('   时间3:', time3)
console.log('   时间1 > 时间2:', time1 > time2, '(应该为 true)')
console.log('   时间3 > 时间1:', time3 > time1, '(应该为 true)')
console.log('   时间2 > 时间3:', time2 > time3, '(应该为 false)')

// 4. 测试 getTime() 比较
const timestamp1 = new Date(time1).getTime()
const timestamp2 = new Date(time2).getTime()
const timestamp3 = new Date(time3).getTime()

console.log('\n4. 时间戳比较测试:')
console.log('   时间戳1:', timestamp1)
console.log('   时间戳2:', timestamp2)
console.log('   时间戳3:', timestamp3)
console.log('   时间戳1 > 时间戳2:', timestamp1 > timestamp2, '(应该为 true)')
console.log('   时间戳3 > 时间戳1:', timestamp3 > timestamp1, '(应该为 true)')

// 5. 测试排序
const times = [
  getTime('2026-02-11 15:30:45.123Z'),
  getTime('2026-02-11 09:30:45.123Z'),
  getTime('2026-02-12 08:30:45.123Z'),
  getTime('2026-02-10 20:30:45.123Z'),
]

console.log('\n5. 排序测试:')
console.log('   原始顺序:', times)
const sorted = [...times].sort()
console.log('   排序后:', sorted)
console.log('   排序正确:', sorted[0] < sorted[1] && sorted[1] < sorted[2] && sorted[2] < sorted[3])

// 6. 测试特殊值
const epoch = new Date(0).toISOString().replace('T', ' ')
console.log('\n6. 特殊值测试:')
console.log('   Epoch (1970-01-01):', epoch)
console.log('   解析成功:', new Date(epoch).getTime() === 0)

// 7. 测试 30 天前的时间
const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ')
console.log('\n7. 30天前时间测试:')
console.log('   30天前:', thirtyDaysAgo)
console.log('   格式正确:', thirtyDaysAgo.includes(' ') && !thirtyDaysAgo.includes('T'))

console.log('\n=== 所有测试完成 ===')
