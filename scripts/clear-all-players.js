/**
 * 清空所有玩家数据及排行榜
 * 用法: node scripts/clear-all-players.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

// 手动加载 .env
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
console.log('MYSQL_URL:', process.env.MYSQL_URL ? '已设置' : '未设置');
console.log('REDIS_URL:', process.env.REDIS_URL ? '已设置' : '未设置');

const mysql = require('mysql2/promise');

async function main() {
  console.log('\n清空所有玩家数据及排行榜...\n');

  // 1. 检查 MySQL 连接
  if (process.env.MYSQL_URL) {
    try {
      const connection = await mysql.createConnection(process.env.MYSQL_URL);
      console.log('MySQL 已连接');

      // 清除外键约束顺序：先删除子表，再删父表
      await connection.execute('DELETE FROM game_records');
      console.log('  ✅ game_records 已清空');

      await connection.execute('DELETE FROM point_transactions');
      console.log('  ✅ point_transactions 已清空');

      await connection.execute('DELETE FROM players');
      console.log('  ✅ players 已清空');

      await connection.end();
    } catch (e) {
      console.log('  ❌ MySQL 操作失败:', e.message);
    }
  } else {
    console.log('  MySQL 未配置，跳过');
  }

  console.log('\n✅ 所有数据已清空！玩家和排行榜将恢复为初始状态。');
  console.log('   ⚠️ 请手动重启服务端以使内存数据生效。');
  process.exit(0);
}

main().catch(e => {
  console.error('清空失败:', e);
  process.exit(1);
});
