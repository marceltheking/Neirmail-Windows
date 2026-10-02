use super::seal::CacheCipher;
use rusqlite::{params, Connection};
use serde_json::Value;

const MAX_CACHED_DETAILS: i64 = 500;

fn item_id(item: &Value) -> Option<String> {
    item.get("id").and_then(Value::as_str).map(str::to_string)
}

fn seal(cipher: &CacheCipher, context: &str, value: &Value) -> rusqlite::Result<String> {
    cipher
        .seal(context, &value.to_string())
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

fn open(cipher: &CacheCipher, context: &str, sealed: &str) -> Option<Value> {
    serde_json::from_str(&cipher.open(context, sealed)?).ok()
}

pub fn replace_folders(
    conn: &Connection,
    cipher: &CacheCipher,
    folders: &[Value],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM cached_folders", [])?;
    for folder in folders {
        let Some(id) = item_id(folder) else { continue };
        tx.execute(
            "INSERT INTO cached_folders (id, folder_sealed) VALUES (?1, ?2)",
            params![id, seal(cipher, &format!("folder:{id}"), folder)?],
        )?;
    }
    tx.commit()
}

pub fn read_folders(conn: &Connection, cipher: &CacheCipher) -> rusqlite::Result<Vec<Value>> {
    let mut statement = conn.prepare("SELECT id, folder_sealed FROM cached_folders")?;
    let rows = statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut folders = Vec::new();
    for (id, sealed) in rows.flatten() {
        if let Some(value) = open(cipher, &format!("folder:{id}"), &sealed) {
            folders.push(value);
        }
    }
    Ok(folders)
}

pub fn replace_email_list(
    conn: &Connection,
    cipher: &CacheCipher,
    nav_key: &str,
    items: &[Value],
) -> rusqlite::Result<()> {
    let tag = cipher.tag(nav_key);
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM cached_email_list_items WHERE nav_key = ?1",
        params![tag],
    )?;
    for item in items {
        let Some(id) = item_id(item) else { continue };
        tx.execute(
            "INSERT INTO cached_email_list_items (nav_key, id, item_sealed) VALUES (?1, ?2, ?3)",
            params![
                tag,
                id,
                seal(cipher, &format!("list:{nav_key}:{id}"), item)?
            ],
        )?;
    }
    tx.commit()
}

pub fn read_email_list(
    conn: &Connection,
    cipher: &CacheCipher,
    nav_key: &str,
) -> rusqlite::Result<Vec<Value>> {
    let mut statement =
        conn.prepare("SELECT id, item_sealed FROM cached_email_list_items WHERE nav_key = ?1")?;
    let rows = statement.query_map(params![cipher.tag(nav_key)], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut items = Vec::new();
    for (id, sealed) in rows.flatten() {
        if let Some(value) = open(cipher, &format!("list:{nav_key}:{id}"), &sealed) {
            items.push(value);
        }
    }
    Ok(items)
}

pub fn write_email_detail(
    conn: &Connection,
    cipher: &CacheCipher,
    id: &str,
    detail: &Value,
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT OR REPLACE INTO cached_email_details (id, detail_sealed) VALUES (?1, ?2)",
        params![id, seal(cipher, &format!("detail:{id}"), detail)?],
    )?;
    tx.execute(
        "DELETE FROM cached_email_details WHERE rowid NOT IN
         (SELECT rowid FROM cached_email_details ORDER BY rowid DESC LIMIT ?1)",
        params![MAX_CACHED_DETAILS],
    )?;
    tx.commit()
}

pub fn forget_email_details(conn: &Connection, ids: &[String]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    for id in ids {
        tx.execute(
            "DELETE FROM cached_email_details WHERE id = ?1",
            params![id],
        )?;
        tx.execute(
            "DELETE FROM cached_email_list_items WHERE id = ?1",
            params![id],
        )?;
    }
    tx.commit()
}

pub fn read_email_detail(
    conn: &Connection,
    cipher: &CacheCipher,
    id: &str,
) -> rusqlite::Result<Option<Value>> {
    let mut statement =
        conn.prepare("SELECT detail_sealed FROM cached_email_details WHERE id = ?1")?;
    let mut rows = statement.query(params![id])?;
    if let Some(row) = rows.next()? {
        let sealed: String = row.get(0)?;
        return Ok(open(cipher, &format!("detail:{id}"), &sealed));
    }
    Ok(None)
}

pub fn clear_all(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "DELETE FROM cached_folders;
         DELETE FROM cached_email_list_items;
         DELETE FROM cached_email_details;",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::db::prepare;
    use serde_json::json;

    fn store() -> (Connection, CacheCipher) {
        let conn = Connection::open_in_memory().unwrap();
        prepare(&conn).unwrap();
        (conn, CacheCipher::new("device-secret"))
    }

    fn raw_text(conn: &Connection) -> String {
        let mut text = String::new();
        for (table, column) in [
            ("cached_folders", "folder_sealed"),
            ("cached_email_list_items", "item_sealed"),
            ("cached_email_details", "detail_sealed"),
        ] {
            let mut statement = conn
                .prepare(&format!("SELECT {column} FROM {table}"))
                .unwrap();
            let rows = statement
                .query_map([], |row| row.get::<_, String>(0))
                .unwrap();
            for value in rows.flatten() {
                text.push_str(&value);
            }
        }
        text
    }

    #[test]
    fn stores_only_sealed_data_and_reads_it_back() {
        let (conn, cipher) = store();
        replace_folders(
            &conn,
            &cipher,
            &[json!({"id": "f1", "name": "Secret plans"})],
        )
        .unwrap();
        replace_email_list(
            &conn,
            &cipher,
            "inbox",
            &[json!({"id": "e1", "subject": "Quarterly numbers", "senderAddress": "cfo@example.com"})],
        )
        .unwrap();
        write_email_detail(
            &conn,
            &cipher,
            "e1",
            &json!({"id": "e1", "subject": "Quarterly numbers"}),
        )
        .unwrap();

        let raw = raw_text(&conn);
        let nav_keys: String = conn
            .query_row(
                "SELECT group_concat(nav_key) FROM cached_email_list_items",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!nav_keys.contains("inbox"));
        for secret in ["Secret plans", "Quarterly numbers", "cfo@example.com"] {
            assert!(
                !raw.contains(secret),
                "{secret} reached the database in the clear"
            );
        }
        assert_eq!(
            read_folders(&conn, &cipher).unwrap()[0]["name"],
            "Secret plans"
        );
        assert_eq!(
            read_email_list(&conn, &cipher, "inbox").unwrap()[0]["subject"],
            "Quarterly numbers"
        );
        assert_eq!(
            read_email_detail(&conn, &cipher, "e1").unwrap().unwrap()["id"],
            "e1"
        );
    }

    #[test]
    fn keeps_only_the_most_recent_details_and_forgets_deleted_mail() {
        let (conn, cipher) = store();
        for index in 0..(MAX_CACHED_DETAILS + 5) {
            let id = format!("e{index}");
            write_email_detail(&conn, &cipher, &id, &json!({ "id": id })).unwrap();
        }
        write_email_detail(&conn, &cipher, "e7", &json!({ "id": "e7" })).unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM cached_email_details", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, MAX_CACHED_DETAILS);
        assert!(read_email_detail(&conn, &cipher, "e0").unwrap().is_none());
        assert!(read_email_detail(&conn, &cipher, "e7").unwrap().is_some());

        replace_email_list(&conn, &cipher, "inbox", &[json!({"id": "e7"})]).unwrap();
        forget_email_details(&conn, &["e7".to_string()]).unwrap();
        assert!(read_email_detail(&conn, &cipher, "e7").unwrap().is_none());
        assert!(read_email_list(&conn, &cipher, "inbox").unwrap().is_empty());
    }

    #[test]
    fn treats_rows_it_cannot_open_as_a_cache_miss() {
        let (conn, cipher) = store();
        write_email_detail(&conn, &cipher, "e1", &json!({"id": "e1"})).unwrap();
        let other = CacheCipher::new("another-device");
        assert!(read_email_detail(&conn, &other, "e1").unwrap().is_none());
        conn.execute("UPDATE cached_email_details SET id = 'e2'", [])
            .unwrap();
        assert!(read_email_detail(&conn, &cipher, "e2").unwrap().is_none());
    }
}
