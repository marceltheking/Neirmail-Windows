pub mod db;
pub mod repository;
pub mod seal;

use rusqlite::Connection;
use seal::CacheCipher;
use std::sync::Mutex;

pub struct CacheDb {
    pub conn: Mutex<Connection>,
    pub cipher: CacheCipher,
}
