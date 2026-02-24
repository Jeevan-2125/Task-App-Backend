// import mysql from 'mysql2/promise';

// const db = mysql.createPool({
//   host:'localhost',
//   user: 'u118553460_test',
//   password: '{TRANSact]@1034',        
//   database: 'u118553460_test2',
// });

// // const db = mysql.createPool({
// //     host: process.env.DB_HOST,
// //     user: process.env.DB_USER,
// //     password: process.env.DB_PASSWORD,
// //     database: process.env.DB_NAME,
// //     waitForConnections: true,
// //     connectionLimit: 10,
// //     queueLimit: 0
// // });


// export default db;


import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createPool({
  // Use the hostname provided in your screenshot
  host: 'srv1327.hstgr.io', 
  user: 'u118553460_app1',
  password: '{TRANSact]@1034', 
  database: 'u118553460_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

export default db;