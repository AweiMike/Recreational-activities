const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// 資料庫設定
const db = new sqlite3.Database('event_checkin.db');

// 管理員密碼
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 重設資料庫的API（仅供調試使用）
app.post('/api/reset-database', (req, res) => {
  const { password } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: '無權限操作' });
  }
  
  // 刪除所有表
  db.serialize(() => {
    db.run('DROP TABLE IF EXISTS attendees');
    db.run('DROP TABLE IF EXISTS events');
    db.run('DROP TABLE IF EXISTS event_images');
    
    console.log('資料庫已重設，重新啟動伺服器以初始化資料');
    res.json({ message: '資料庫已重設，請重新啟動伺服器' });
    
    // 重新啟動進程
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
});

// 初始化資料庫
db.serialize(() => {
  // 活動表
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    location TEXT,
    status TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 參加者表（加入event_id）
  db.run(`CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    dependents INTEGER DEFAULT 0,
    relation TEXT DEFAULT '本人',
    status TEXT DEFAULT 'pending',
    carPlate TEXT DEFAULT '',
    total INTEGER DEFAULT 1,
    isLeader BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
  )`);

  // 活動圖片表（加入event_id）
  db.run(`CREATE TABLE IF NOT EXISTS event_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    imageData TEXT,
    uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
  )`);

  // 檢查是否已有活動，沒有則插入初始資料
  // 注意：如果需要重新初始化，請使用 POST /api/reset-database
  db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    
    if (row.count === 0) {
      // 建立所有活動
      const initialEvents = [
        { name: '新化分局文康活動旭集餐廳 - 9月22日', date: '2024-09-22', time: '11:30', location: '旭集餐廳 | 訂位編號 TNXU2025092211059' },
        { name: '新化分局文康活動旭集餐廳 - 9月23日', date: '2024-09-23', time: '11:30', location: '旭集餐廳 | 訂位編號 TNXU2025092311040' },
        { name: '新化分局文康活動旭集餐廳 - 9月25日', date: '2024-09-25', time: '11:30', location: '旭集餐廳 | 訂位編號 TNXU2025092511059' },
        { name: '新化分局文康活動旭集餐廳 - 9月26日', date: '2024-09-26', time: '11:30', location: '旭集餐廳 | 訂位編號 TNXU2025092611055' }
      ];

      const eventStmt = db.prepare(`INSERT INTO events (name, date, time, location) VALUES (?, ?, ?, ?)`);
      
      initialEvents.forEach((event, index) => {
        eventStmt.run(event.name, event.date, event.time, event.location, function(err) {
          if (err) {
            console.error(err);
            return;
          }
          
          const eventId = this.lastID;
          
          // 為第一個活動建立參加者資料
          if (index === 0) {
            const initialAttendees = [
              { name: '蘇有義', dependents: 0, relation: '本人', total: 1 },
              { name: '林白姬', dependents: 2, relation: '眷屬', total: 3 },
              { name: '鄭東澤', dependents: 2, relation: '眷屬', total: 3, isLeader: true },
              { name: '江金靜', dependents: 0, relation: '本人', total: 1 },
              { name: '黃文彬', dependents: 0, relation: '本人', total: 1 },
              { name: '趙哲勗', dependents: 0, relation: '本人', total: 1 },
              { name: '陳瑞麟', dependents: 0, relation: '本人', total: 1 },
              { name: '陳昭宏', dependents: 0, relation: '本人', total: 1 },
              { name: '蘇育賢', dependents: 0, relation: '本人', total: 1 },
              { name: '馬士于', dependents: 0, relation: '本人', total: 1 },
              { name: '呂勝雄', dependents: 1, relation: '眷屬', total: 2 },
              { name: '溫捷恩', dependents: 0, relation: '本人', total: 1 },
              { name: '陳冠廷', dependents: 0, relation: '本人', total: 1 },
              { name: '林俊祺', dependents: 1, relation: '眷屬', total: 2 },
              { name: '林世賢', dependents: 0, relation: '本人', total: 1 },
              { name: '詹昆達', dependents: 0, relation: '本人', total: 1 },
              { name: '劉盈蓉', dependents: 0, relation: '本人', total: 1 },
              { name: '林于勝', dependents: 0, relation: '本人', total: 1 },
              { name: '阮士閣', dependents: 1, relation: '眷屬', total: 2 },
              { name: '陳志明', dependents: 1, relation: '眷屬', total: 2 },
              { name: '曾冠傑', dependents: 0, relation: '本人', total: 1 },
              { name: '胡富堯', dependents: 0, relation: '本人', total: 1 },
              { name: '楊璧菁', dependents: 0, relation: '警友', total: 1 },
              { name: '吳玉琴', dependents: 0, relation: '警友', total: 1 }
            ];

            const attendeeStmt = db.prepare(`INSERT INTO attendees (event_id, name, dependents, relation, total, isLeader) 
                                           VALUES (?, ?, ?, ?, ?, ?)`);
            
            initialAttendees.forEach(attendee => {
              attendeeStmt.run(eventId, attendee.name, attendee.dependents, attendee.relation, 
                              attendee.total, attendee.isLeader ? 1 : 0);
            });
            attendeeStmt.finalize();
          }
          
          // 9月23日活動參加者
          if (index === 1) {
            const event0923Attendees = [
              { name: '蘇錦修', dependents: 1, relation: '眷屬', total: 2 },
              { name: '張晴芝', dependents: 0, relation: '本人', total: 1 },
              { name: '鄭莛宥', dependents: 0, relation: '本人', total: 1 },
              { name: '梁秋和', dependents: 0, relation: '本人', total: 1 },
              { name: '湯智傑', dependents: 0, relation: '本人', total: 1 },
              { name: '蔡明宗', dependents: 1, relation: '眷屬', total: 2 },
              { name: '魏妤庭', dependents: 0, relation: '本人', total: 1 },
              { name: '楊釗驊', dependents: 0, relation: '本人', total: 1 },
              { name: '陳韻竹', dependents: 0, relation: '本人', total: 1 },
              { name: '許亦祺', dependents: 1, relation: '眷屬', total: 2 },
              { name: '王曼丞', dependents: 1, relation: '眷屬', total: 2 },
              { name: '鄭敏弘', dependents: 0, relation: '本人', total: 1 },
              { name: '周政男', dependents: 0, relation: '本人', total: 1 },
              { name: '連尉智', dependents: 0, relation: '本人', total: 1 }
            ];

            const stmt23 = db.prepare(`INSERT INTO attendees (event_id, name, dependents, relation, total, isLeader) 
                                     VALUES (?, ?, ?, ?, ?, ?)`);
            
            event0923Attendees.forEach(attendee => {
              stmt23.run(eventId, attendee.name, attendee.dependents, attendee.relation, 
                        attendee.total, attendee.isLeader ? 1 : 0);
            });
            stmt23.finalize();
          }
          
          // 9月25日活動參加者 - 訂位編號 TNXU2025092511059
          if (index === 2) {
            const event0925Attendees = [
              { name: '徐天位', dependents: 0, relation: '本人', total: 1 },
              { name: '謝昌佑', dependents: 0, relation: '本人', total: 1 },
              { name: '王耀賢', dependents: 0, relation: '本人', total: 1 },
              { name: '張宗龍', dependents: 0, relation: '本人', total: 1 },
              { name: '黃昜鈞', dependents: 0, relation: '本人', total: 1 },
              { name: '林秀翰', dependents: 0, relation: '本人', total: 1 },
              { name: '姜耀棠', dependents: 1, relation: '眷屬', total: 2 },
              { name: '楊家豪', dependents: 0, relation: '本人', total: 1 },
              { name: '謝安廷', dependents: 0, relation: '本人', total: 1 }
            ];

            const stmt25 = db.prepare(`INSERT INTO attendees (event_id, name, dependents, relation, total, isLeader) 
                                     VALUES (?, ?, ?, ?, ?, ?)`);
            
            event0925Attendees.forEach(attendee => {
              stmt25.run(eventId, attendee.name, attendee.dependents, attendee.relation, 
                        attendee.total, attendee.isLeader ? 1 : 0);
            });
            stmt25.finalize();
          }
          
          // 9月26日活動參加者 - 訂位編號 TNXU2025092611055
          if (index === 3) {
            const event0926Attendees = [
              { name: '卓新裕', dependents: 0, relation: '本人', total: 1 },
              { name: '張丞勛', dependents: 0, relation: '本人', total: 1 },
              { name: '李世上', dependents: 0, relation: '本人', total: 1 },
              { name: '鄭文興', dependents: 1, relation: '眷屬', total: 2 },
              { name: '鄭玠琳', dependents: 1, relation: '眷屬', total: 2 },
              { name: '陳信淮', dependents: 1, relation: '眷屬', total: 2 },
              { name: '李金安', dependents: 1, relation: '眷屬', total: 2 },
              { name: '郭俊億', dependents: 0, relation: '本人', total: 1 },
              { name: '黃振原', dependents: 1, relation: '眷屬', total: 2 },
              { name: '吳重宏', dependents: 0, relation: '本人', total: 1 },
              { name: '許銘倫', dependents: 0, relation: '本人', total: 1 },
              { name: '王琳敬', dependents: 0, relation: '本人', total: 1 },
              { name: '朱唐緯', dependents: 0, relation: '本人', total: 1 },
              { name: '曾靖宜', dependents: 0, relation: '本人', total: 1 },
              { name: '林冠宏', dependents: 0, relation: '本人', total: 1 },
              { name: '林芷玄', dependents: 0, relation: '本人', total: 1 },
              { name: '黃壁儒', dependents: 1, relation: '眷屬', total: 2 },
              { name: '楊登旭', dependents: 0, relation: '本人', total: 1 },
              { name: '蔡宙宏', dependents: 0, relation: '本人', total: 1 },
              { name: '蔡仕良', dependents: 0, relation: '本人', total: 1 },
              { name: '張志能', dependents: 0, relation: '本人', total: 1 }
            ];

            const stmt26 = db.prepare(`INSERT INTO attendees (event_id, name, dependents, relation, total, isLeader) 
                                     VALUES (?, ?, ?, ?, ?, ?)`);
            
            event0926Attendees.forEach(attendee => {
              stmt26.run(eventId, attendee.name, attendee.dependents, attendee.relation, 
                        attendee.total, attendee.isLeader ? 1 : 0);
            });
            stmt26.finalize();
          }
        });
      });
      eventStmt.finalize();
      
      console.log('初始所有活動和參加者資料已插入');
    }
  });
});

// API 路由

// 登入相關API
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  
  // 檢查是否為管理員
  if (password === ADMIN_PASSWORD) {
    return res.json({ 
      type: 'admin', 
      message: '管理員登入成功' 
    });
  }
  
  if (!name) {
    return res.status(400).json({ error: '請輸入姓名' });
  }
  
  // 查詢該姓名參加的活動
  db.all(`
    SELECT a.id as attendee_id, a.name, e.id as event_id, e.name as event_name, 
           e.date, e.time, e.location
    FROM attendees a 
    JOIN events e ON a.event_id = e.id 
    WHERE a.name LIKE ?
    ORDER BY e.date DESC
  `, [`%${name}%`], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到您的姓名，請確認拼寫是否正確' });
    }
    
    if (rows.length === 1) {
      // 只有一個活動，直接返回
      return res.json({
        type: 'personal',
        attendee: rows[0],
        redirect: `/personal/${rows[0].event_id}/${rows[0].attendee_id}`
      });
    }
    
    // 多個活動，返回選擇列表
    res.json({
      type: 'select',
      name: name,
      events: rows
    });
  });
});

// 獲取所有活動
app.get('/api/events', (req, res) => {
  db.all("SELECT * FROM events ORDER BY date DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 獲取特定活動的參加者
app.get('/api/events/:eventId/attendees', (req, res) => {
  const { eventId } = req.params;
  db.all("SELECT * FROM attendees WHERE event_id = ? ORDER BY id", [eventId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 獲取特定參加者資料
app.get('/api/attendees/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT a.*, e.name as event_name, e.date, e.time, e.location
    FROM attendees a 
    JOIN events e ON a.event_id = e.id 
    WHERE a.id = ?
  `, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '找不到參加者' });
      return;
    }
    res.json(row);
  });
});

app.post('/api/attendees/:id/checkin', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.run(`UPDATE attendees SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, 
    [status, id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 獲取更新後的資料（包含活動資訊）
      db.get(`
        SELECT a.*, e.name as event_name, e.date
        FROM attendees a 
        JOIN events e ON a.event_id = e.id 
        WHERE a.id = ?
      `, [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播更新到該活動的房間
        io.to(`event_${row.event_id}`).emit('attendeeUpdated', row);
        res.json(row);
      });
    });
});

app.post('/api/attendees/:id/carplate', (req, res) => {
  const { id } = req.params;
  const { carPlate } = req.body;
  
  db.run(`UPDATE attendees SET carPlate = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, 
    [carPlate, id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 獲取更新後的資料（包含活動資訊）
      db.get(`
        SELECT a.*, e.name as event_name, e.date
        FROM attendees a 
        JOIN events e ON a.event_id = e.id 
        WHERE a.id = ?
      `, [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播更新到該活動的房間
        io.to(`event_${row.event_id}`).emit('attendeeUpdated', row);
        res.json(row);
      });
    });
});

app.get('/api/events/:eventId/image', (req, res) => {
  const { eventId } = req.params;
  db.get("SELECT imageData FROM event_images WHERE event_id = ? ORDER BY uploadedAt DESC LIMIT 1", 
    [eventId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ imageUrl: row ? row.imageData : null });
  });
});

app.post('/api/events/:eventId/image', (req, res) => {
  const { eventId } = req.params;
  const { imageData } = req.body;
  
  // 先刪除該活動的舊圖片
  db.run("DELETE FROM event_images WHERE event_id = ?", [eventId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 插入新圖片
    db.run("INSERT INTO event_images (event_id, imageData) VALUES (?, ?)", 
      [eventId, imageData], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 即時廣播圖片更新到該活動的房間
      io.to(`event_${eventId}`).emit('imageUpdated', { imageUrl: imageData });
      res.json({ success: true });
    });
  });
});

app.post('/api/events/:eventId/reset', (req, res) => {
  const { eventId } = req.params;
  
  db.serialize(() => {
    db.run("UPDATE attendees SET status = 'pending', carPlate = '', updatedAt = CURRENT_TIMESTAMP WHERE event_id = ?", 
      [eventId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
    });
    
    db.run("DELETE FROM event_images WHERE event_id = ?", [eventId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 獲取重設後的該活動資料
      db.all("SELECT * FROM attendees WHERE event_id = ? ORDER BY id", [eventId], (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播重設到該活動的房間
        io.to(`event_${eventId}`).emit('dataReset', { attendees: rows });
        res.json({ success: true, attendees: rows });
      });
    });
  });
});

// 獲取活動統計
app.get('/api/events/:eventId/stats', (req, res) => {
  const { eventId } = req.params;
  
  db.all(`
    SELECT 
      COUNT(*) as total_people,
      SUM(total) as total_count,
      SUM(CASE WHEN status = 'checked-in' THEN total ELSE 0 END) as checked_in_count,
      COUNT(CASE WHEN carPlate != '' AND carPlate IS NOT NULL THEN 1 END) as cars_registered
    FROM attendees 
    WHERE event_id = ?
  `, [eventId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = rows[0];
    res.json({
      totalPeople: stats.total_count || 0,
      checkedInPeople: stats.checked_in_count || 0,
      pendingPeople: (stats.total_count || 0) - (stats.checked_in_count || 0),
      carsRegistered: stats.cars_registered || 0
    });
  });
});

// Socket.IO 連接處理
let connectedUsers = 0;
let eventRooms = {}; // 追蹤各活動房間的人數

io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`使用者連接，目前線上人數: ${connectedUsers}`);
  
  // 加入活動房間
  socket.on('joinEvent', (eventId) => {
    socket.join(`event_${eventId}`);
    
    if (!eventRooms[eventId]) {
      eventRooms[eventId] = 0;
    }
    eventRooms[eventId]++;
    
    console.log(`使用者加入活動 ${eventId}，該活動線上人數: ${eventRooms[eventId]}`);
    
    // 廣播該活動的線上人數
    io.to(`event_${eventId}`).emit('eventUserCountUpdate', eventRooms[eventId]);
    
    // 發送該活動的初始資料
    db.all("SELECT * FROM attendees WHERE event_id = ? ORDER BY id", [eventId], (err, attendees) => {
      if (!err) {
        socket.emit('initialData', { attendees });
      }
    });
    
    // 發送該活動的圖片
    db.get("SELECT imageData FROM event_images WHERE event_id = ? ORDER BY uploadedAt DESC LIMIT 1", 
      [eventId], (err, row) => {
      if (!err && row) {
        socket.emit('imageUpdated', { imageUrl: row.imageData });
      }
    });
  });
  
  // 離開活動房間
  socket.on('leaveEvent', (eventId) => {
    socket.leave(`event_${eventId}`);
    
    if (eventRooms[eventId]) {
      eventRooms[eventId]--;
      if (eventRooms[eventId] <= 0) {
        delete eventRooms[eventId];
      } else {
        io.to(`event_${eventId}`).emit('eventUserCountUpdate', eventRooms[eventId]);
      }
    }
  });
  
  socket.on('disconnect', () => {
    connectedUsers--;
    console.log(`使用者離線，目前線上人數: ${connectedUsers}`);
    
    // 從所有活動房間中移除並更新人數
    Object.keys(eventRooms).forEach(eventId => {
      if (eventRooms[eventId] > 0) {
        eventRooms[eventId]--;
        if (eventRooms[eventId] <= 0) {
          delete eventRooms[eventId];
        } else {
          io.to(`event_${eventId}`).emit('eventUserCountUpdate', eventRooms[eventId]);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});

// 處理程序結束時關閉資料庫
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('資料庫連接已關閉');
    process.exit(0);
  });
});