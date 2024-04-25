const mysql =  require('mysql2');

const connection = mysql.createConnection({
    connectionLimit:10,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    multipleStatements: true
});

// change to connection pool?
connection.connect ((err) => {
  if (err) throw err;
  console.log("connected to db");

})

module.exports = connection;