import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);
const db = drizzle(connection);

const [rows] = await connection.execute(
  "SELECT id, name, hostname, port, username, userId FROM sshHosts"
);
console.log("SSH Hosts:", JSON.stringify(rows, null, 2));

const [users] = await connection.execute("SELECT id, name FROM users");
console.log("Users:", JSON.stringify(users, null, 2));

await connection.end();
