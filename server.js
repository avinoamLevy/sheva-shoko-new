const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
// חיובי לאינטרנט: מקבל את הפורט שהשרת מקצה, או 3000 כברירת מחדל במחשב
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// הגדרת נתיב אבסולוטי (מלא) לקובץ ה-Database כדי שהשרת באינטרנט לא יתבלבל במיקום
const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('שגיאה בחיבור למסד הנתונים:', err.message);
    } else {
        console.log('מחובר בהצלחה למסד הנתונים SQLite בנתיב:', dbPath);
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        rating INTEGER NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// 1. נתיב API לקבלת כל הביקורות
app.get('/api/reviews', (req, res) => {
    const sql = 'SELECT * FROM reviews ORDER BY id DESC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("שגיאה בשליפת ביקורות:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 2. נתיב API לשמירת ביקורת חדשה
app.post('/api/reviews', (req, res) => {
    console.log("שרת קיבל בקשת POST ב-body:", req.body);

    const { username, rating, message } = req.body;

    // בדיקת הגנה: ודואים ששום שדה לא הגיע ריק לשרת
    if (!username || rating === undefined || rating === null || !message) {
        console.warn("השרת סירב לבקשה: אחד מהשדות הגיע ריק או חסר", { username, rating, message });
        return res.status(400).json({ success: false, message: 'נתונים חסרים בשליחת הביקורת' });
    }

    const currentTimestamp = new Date().toISOString();
    const sql = 'INSERT INTO reviews (username, rating, message, timestamp) VALUES (?, ?, ?, ?)';

    db.run(sql, [username, rating, message, currentTimestamp], function (err) {
        if (err) {
            console.error("שגיאה בכתיבה ל-SQLite:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`הביקורת נשמרה בהצלחה ב-Database. שורה מספר: ${this.lastID}`);
        res.json({ success: true, id: this.lastID });
    });
});

// 3. נתיב API למחיקת ביקורת
app.delete('/api/reviews/:id', (req, res) => {
    const reviewId = req.params.id;
    console.log(`שרת קיבל בקשת DELETE עבור ביקורת מספר: ${reviewId}`);

    const sql = 'DELETE FROM reviews WHERE id = ?';
    db.run(sql, [reviewId], function (err) {
        if (err) {
            console.error("שגיאה במחיקה מ-SQLite:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }

        if (this.changes === 0) {
            res.status(404).json({ success: false, message: 'הביקורת לא נמצאה' });
        } else {
            console.log(`הביקורת מספר ${reviewId} נמחקה בהצלחה מה-Database.`);
            res.json({ success: true, message: 'הביקורת נמחקה בהצלחה מה-SQL' });
        }
    });
});

// פונקציית גיבוי (Catch-all): מגינה על האתר במקרה של רענון דף ומחזירה תמיד את ה-HTML הראשי
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`השרת רץ בהצלחה בפורט: ${PORT}`);
});