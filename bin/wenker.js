#!/usr/bin/env node
/**
 * WENKER Router launcher cho npm global / npx.
 *
 * Mục đích: sau khi `npm i -g wenker-router`, người dùng chỉ cần gõ `wenker`
 * là server bật lên ở http://localhost:3600 (dashboard đã build sẵn được phục vụ
 * trực tiếp từ client/dist).
 *
 * Cấu hình qua biến môi trường (giống hệt khi chạy `node server/index.js`):
 *   PORT=3600        cổng lắng nghe
 *   HOST=0.0.0.0     địa chỉbind
 *   WENKER_HOME=...  thư mục dữ liệu (mặc định ~/.wenker)
 */


const path = require('path');

// Kiểm tra sớm để báo lỗi dễ hiểu thay vì crash khó đọc bên trong server.
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(
    `\nWENKER Router cần Node.js >= 18 (phát hiện ${process.versions.node}).\n` +
      'Node 18 trở lên mới có fetch() toàn cục, bắt buộc để gọi các nhà cung cấp AI.\n' +
      'Tải bản mới nhất tại: https://nodejs.org/\n',
  );
  process.exit(1);
}

const entry = path.join(__dirname, '..', 'server', 'index.js');
require(entry);
