use rusqlite::{Connection, ErrorCode};
use std::path::Path;

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    match initialise(path) {
        Err(rusqlite::Error::SqliteFailure(error, _)) if error.code == ErrorCode::NotADatabase => {
            remove_database_files(path);
            initialise(path)
        }
        other => other,
    }
}

pub fn initialise(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    prepare(&conn)?;
    Ok(conn)
}

pub fn prepare(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS cached_folders (
            id TEXT PRIMARY KEY,
            folder_sealed TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cached_email_list_items (
            nav_key TEXT NOT NULL,
            id TEXT NOT NULL,
            item_sealed TEXT NOT NULL,
            PRIMARY KEY (nav_key, id)
        );

        CREATE TABLE IF NOT EXISTS cached_email_details (
            id TEXT PRIMARY KEY,
            detail_sealed TEXT NOT NULL
        );

        DELETE FROM cached_email_list_items WHERE nav_key GLOB '*[^0-9a-f]*';
        ",
    )
}

fn remove_database_files(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let mut name = path.as_os_str().to_os_string();
        name.push(suffix);
        let _ = std::fs::remove_file(name);
    }
}

#[cfg(test)]
mod tests {
    use super::open;

    #[test]
    fn purges_list_rows_that_still_carry_a_plaintext_navigation_key() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        super::prepare(&conn).unwrap();
        conn.execute(
            "INSERT INTO cached_email_list_items (nav_key, id, item_sealed) VALUES (?1, 'a', 'x'), (?2, 'b', 'y')",
            [r#"{"q":"private search"}"#, &"ab".repeat(32)],
        )
        .unwrap();
        super::prepare(&conn).unwrap();
        let remaining: Vec<String> = conn
            .prepare("SELECT id FROM cached_email_list_items")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .flatten()
            .collect();
        assert_eq!(remaining, vec!["b".to_string()]);
    }

    #[test]
    fn replaces_a_cache_written_by_the_previous_encrypted_format() {
        let dir = std::env::temp_dir().join(format!("neirmail-cache-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("legacy.sqlite3");
        std::fs::write(&path, vec![0x9f_u8; 4096]).unwrap();

        let conn = open(&path).unwrap();
        let tables: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'cached_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(tables, 3);

        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
