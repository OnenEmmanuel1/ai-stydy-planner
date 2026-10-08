const mysql = require('mysql2/promise');
for (const name of ['DB_HOST','DB_PORT','DB_NAME','DB_USER',]) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
const pool = mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,waitForConnections:true,connectionLimit:10,timezone:'Z',dateStrings:false});
module.exports = pool;
