use keyring::Entry;
use rand::RngCore;

const SERVICE: &str = "io.neir.neirmail";
const CACHE_KEY_ACCOUNT: &str = "cache-db-key";
const SESSION_COOKIE_ACCOUNT: &str = "session-cookie";

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn get_or_create_cache_key() -> keyring::Result<String> {
    let entry = Entry::new(SERVICE, CACHE_KEY_ACCOUNT)?;
    if let Ok(existing) = entry.get_password() {
        return Ok(existing);
    }

    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let key = encode_hex(&bytes);
    entry.set_password(&key)?;
    Ok(key)
}

pub fn get_session_cookie() -> Option<String> {
    Entry::new(SERVICE, SESSION_COOKIE_ACCOUNT)
        .ok()?
        .get_password()
        .ok()
}

pub fn set_session_cookie(value: &str) {
    if let Ok(entry) = Entry::new(SERVICE, SESSION_COOKIE_ACCOUNT) {
        let _ = entry.set_password(value);
    }
}

pub fn clear_session_cookie() {
    if let Ok(entry) = Entry::new(SERVICE, SESSION_COOKIE_ACCOUNT) {
        let _ = entry.delete_credential();
    }
}
