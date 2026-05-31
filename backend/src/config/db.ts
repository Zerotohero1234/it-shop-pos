import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * MySQL Connection Pool Configuration
 * ใช้ Connection Pool เพื่อจัดการ connections อย่างมีประสิทธิภาพ
 * และหลีกเลี่ยงปัญหา connection exhaustion
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'it_shop_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/**
 * ทดสอบการเชื่อมต่อฐานข้อมูล
 * @returns Promise<boolean> - true ถ้าเชื่อมต่อสำเร็จ
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * ดำเนินการ Query แบบ Parameterized (ป้องกัน SQL Injection)
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Promise<any> - Query results
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * ปิด Connection Pool (ใช้ตอน graceful shutdown)
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('🔒 Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}

export default pool;
