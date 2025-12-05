use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub mode: String,
    pub user_id: String,
    pub created_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub session_id: String,
    pub speaker_id: String,
    pub timestamp: String,
    pub original_text: String,
    pub original_language: String,
    pub translated_text: Option<String>,
    pub target_language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub name: String,
    pub preferred_language: String,
    pub voiceprint_data: Option<Vec<u8>>,
    pub created_at: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Database { conn };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> Result<()> {
        // Sessions table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
            )",
            [],
        )?;

        // Messages table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                speaker_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                original_text TEXT NOT NULL,
                original_language TEXT NOT NULL,
                translated_text TEXT,
                target_language TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )",
            [],
        )?;

        // Speakers table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS speakers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                preferred_language TEXT NOT NULL,
                voiceprint_data BLOB,
                created_at TEXT NOT NULL
            )",
            [],
        )?;

        // Participants table (many-to-many relationship)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS session_participants (
                session_id TEXT NOT NULL,
                speaker_id TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                is_muted INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (session_id, speaker_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (speaker_id) REFERENCES speakers(id)
            )",
            [],
        )?;

        // Create indexes for better query performance
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)",
            [],
        )?;

        Ok(())
    }

    pub fn create_session(&self, mode: &str, user_id: &str) -> Result<Session> {
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO sessions (id, mode, user_id, created_at, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, mode, user_id, created_at, "active"],
        )?;

        Ok(Session {
            id,
            mode: mode.to_string(),
            user_id: user_id.to_string(),
            created_at,
            status: "active".to_string(),
        })
    }

    pub fn get_sessions(&self) -> Result<Vec<Session>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, mode, user_id, created_at, status FROM sessions ORDER BY created_at DESC")?;

        let sessions = stmt
            .query_map([], |row| {
                Ok(Session {
                    id: row.get(0)?,
                    mode: row.get(1)?,
                    user_id: row.get(2)?,
                    created_at: row.get(3)?,
                    status: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(sessions)
    }

    pub fn save_message(
        &self,
        session_id: &str,
        speaker_id: &str,
        original_text: &str,
        original_language: &str,
        translated_text: Option<&str>,
        target_language: Option<&str>,
    ) -> Result<()> {
        let timestamp = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO messages (session_id, speaker_id, timestamp, original_text, original_language, translated_text, target_language)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session_id,
                speaker_id,
                timestamp,
                original_text,
                original_language,
                translated_text,
                target_language
            ],
        )?;

        Ok(())
    }

    pub fn get_session_messages(
        &self,
        session_id: &str,
        limit: Option<i32>,
    ) -> Result<Vec<Message>> {
        let query = if let Some(limit) = limit {
            format!(
                "SELECT id, session_id, speaker_id, timestamp, original_text, original_language, translated_text, target_language
                 FROM messages WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT {}",
                limit
            )
        } else {
            "SELECT id, session_id, speaker_id, timestamp, original_text, original_language, translated_text, target_language
             FROM messages WHERE session_id = ?1 ORDER BY timestamp DESC"
                .to_string()
        };

        let mut stmt = self.conn.prepare(&query)?;

        let messages = stmt
            .query_map(params![session_id], |row| {
                Ok(Message {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    speaker_id: row.get(2)?,
                    timestamp: row.get(3)?,
                    original_text: row.get(4)?,
                    original_language: row.get(5)?,
                    translated_text: row.get(6)?,
                    target_language: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(messages)
    }

    pub fn create_speaker(
        &self,
        id: &str,
        name: &str,
        preferred_language: &str,
    ) -> Result<Speaker> {
        let created_at = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO speakers (id, name, preferred_language, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, preferred_language, created_at],
        )?;

        Ok(Speaker {
            id: id.to_string(),
            name: name.to_string(),
            preferred_language: preferred_language.to_string(),
            voiceprint_data: None,
            created_at,
        })
    }

    pub fn update_voiceprint(&self, speaker_id: &str, voiceprint_data: &[u8]) -> Result<()> {
        self.conn.execute(
            "UPDATE speakers SET voiceprint_data = ?1 WHERE id = ?2",
            params![voiceprint_data, speaker_id],
        )?;
        Ok(())
    }
}
