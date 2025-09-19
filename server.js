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

// 初始化資料庫
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    dependents INTEGER DEFAULT 0,
    relation TEXT DEFAULT '本人',
    status TEXT DEFAULT 'pending',
    carPlate TEXT DEFAULT '',
    total INTEGER DEFAULT 1,
    isLeader BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imageData TEXT,
    uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 檢查是否已有資料，沒有則插入初始資料
  db.get("SELECT COUNT(*) as count FROM attendees", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    
    if (row.count === 0) {
      const initialAttendees = [
        { id: 1, name: '蘇有義', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 2, name: '林白姬', dependents: 2, relation: '眷屬', status: 'pending', carPlate: '', total: 3 },
        { id: 3, name: '鄭東澤', dependents: 2, relation: '眷屬', status: 'pending', carPlate: '', total: 3, isLeader: true },
        { id: 4, name: '江金靜', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 5, name: '黃文彬', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 6, name: '趙哲勗', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 7, name: '陳瑞麟', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 8, name: '陳昭宏', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 9, name: '蘇育賢', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 10, name: '馬士于', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 11, name: '呂勝雄', dependents: 1, relation: '眷屬', status: 'pending', carPlate: '', total: 2 },
        { id: 12, name: '溫捷恩', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 13, name: '陳冠廷', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 14, name: '林俊祺', dependents: 1, relation: '眷屬', status: 'pending', carPlate: '', total: 2 },
        { id: 15, name: '林世賢', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 16, name: '詹昆達', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 17, name: '劉盈蓉', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 18, name: '林于勝', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 19, name: '阮士閣', dependents: 1, relation: '眷屬', status: 'pending', carPlate: '', total: 2 },
        { id: 20, name: '陳志明', dependents: 1, relation: '眷屬', status: 'pending', carPlate: '', total: 2 },
        { id: 21, name: '曾冠傑', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 22, name: '胡富堯', dependents: 0, relation: '本人', status: 'pending', carPlate: '', total: 1 },
        { id: 23, name: '楊璧菁', dependents: 0, relation: '警友', status: 'pending', carPlate: '', total: 1 },
        { id: 24, name: '吳玉琴', dependents: 0, relation: '警友', status: 'pending', carPlate: '', total: 1 },
      ];

      const stmt = db.prepare(`INSERT INTO attendees (id, name, dependents, relation, status, carPlate, total, isLeader) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      
      initialAttendees.forEach(attendee => {
        stmt.run(attendee.id, attendee.name, attendee.dependents, attendee.relation, 
                attendee.status, attendee.carPlate, attendee.total, attendee.isLeader ? 1 : 0);
      });
      stmt.finalize();
      
      console.log('初始參加者資料已插入');
    }
  });
});

// API 路由
app.get('/api/attendees', (req, res) => {
  db.all("SELECT * FROM attendees ORDER BY id", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
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
      
      // 獲取更新後的資料
      db.get("SELECT * FROM attendees WHERE id = ?", [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播更新
        io.emit('attendeeUpdated', row);
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
      
      // 獲取更新後的資料
      db.get("SELECT * FROM attendees WHERE id = ?", [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播更新
        io.emit('attendeeUpdated', row);
        res.json(row);
      });
    });
});

app.get('/api/image', (req, res) => {
  db.get("SELECT imageData FROM event_images ORDER BY uploadedAt DESC LIMIT 1", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ imageUrl: row ? row.imageData : null });
  });
});

app.post('/api/image', (req, res) => {
  const { imageData } = req.body;
  
  // 先刪除舊圖片
  db.run("DELETE FROM event_images", (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 插入新圖片
    db.run("INSERT INTO event_images (imageData) VALUES (?)", [imageData], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 即時廣播圖片更新
      io.emit('imageUpdated', { imageUrl: imageData });
      res.json({ success: true });
    });
  });
});

app.post('/api/reset', (req, res) => {
  db.serialize(() => {
    db.run("UPDATE attendees SET status = 'pending', carPlate = '', updatedAt = CURRENT_TIMESTAMP", (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
    });
    
    db.run("DELETE FROM event_images", (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 獲取重設後的所有資料
      db.all("SELECT * FROM attendees ORDER BY id", (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 即時廣播重設
        io.emit('dataReset', { attendees: rows });
        res.json({ success: true, attendees: rows });
      });
    });
  });
});

// Socket.IO 連接處理
let connectedUsers = 0;

io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`使用者連接，目前線上人數: ${connectedUsers}`);
  
  // 廣播線上人數
  io.emit('userCountUpdate', connectedUsers);
  
  // 發送初始資料給新連接的使用者
  db.all("SELECT * FROM attendees ORDER BY id", (err, attendees) => {
    if (!err) {
      socket.emit('initialData', { attendees });
    }
  });
  
  db.get("SELECT imageData FROM event_images ORDER BY uploadedAt DESC LIMIT 1", (err, row) => {
    if (!err && row) {
      socket.emit('imageUpdated', { imageUrl: row.imageData });
    }
  });
  
  socket.on('disconnect', () => {
    connectedUsers--;
    console.log(`使用者離線，目前線上人數: ${connectedUsers}`);
    io.emit('userCountUpdate', connectedUsers);
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