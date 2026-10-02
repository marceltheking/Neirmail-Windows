use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

const KEY_DOMAIN: &[u8] = b"neirmail:cache:v1";
const TAG_DOMAIN: &[u8] = b"neirmail:cache-tag:v1";
const NONCE_LEN: usize = 12;

#[derive(Debug, thiserror::Error)]
#[error("the cache entry could not be sealed")]
pub struct SealError;

pub struct CacheCipher {
    aead: Aes256Gcm,
    tag_key: [u8; 32],
}

impl CacheCipher {
    pub fn new(secret: &str) -> Self {
        let key = Sha256::new()
            .chain_update(KEY_DOMAIN)
            .chain_update(secret.as_bytes())
            .finalize();
        let tag_key = Sha256::new()
            .chain_update(TAG_DOMAIN)
            .chain_update(secret.as_bytes())
            .finalize()
            .into();
        Self {
            aead: Aes256Gcm::new(&key),
            tag_key,
        }
    }

    pub fn tag(&self, value: &str) -> String {
        let digest = Sha256::new()
            .chain_update(self.tag_key)
            .chain_update(value.as_bytes())
            .finalize();
        digest.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    pub fn seal(&self, context: &str, plaintext: &str) -> Result<String, SealError> {
        let mut nonce = [0_u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce);
        let ciphertext = self
            .aead
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: plaintext.as_bytes(),
                    aad: context.as_bytes(),
                },
            )
            .map_err(|_| SealError)?;
        let mut sealed = nonce.to_vec();
        sealed.extend_from_slice(&ciphertext);
        Ok(STANDARD.encode(sealed))
    }

    pub fn open(&self, context: &str, sealed: &str) -> Option<String> {
        let bytes = STANDARD.decode(sealed).ok()?;
        if bytes.len() <= NONCE_LEN {
            return None;
        }
        let (nonce, ciphertext) = bytes.split_at(NONCE_LEN);
        let plaintext = self
            .aead
            .decrypt(
                Nonce::from_slice(nonce),
                Payload {
                    msg: ciphertext,
                    aad: context.as_bytes(),
                },
            )
            .ok()?;
        String::from_utf8(plaintext).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::CacheCipher;

    #[test]
    fn round_trips_under_the_same_key_and_context() {
        let cipher = CacheCipher::new("device-secret");
        let sealed = cipher.seal("detail:1", "{\"subject\":\"hello\"}").unwrap();
        assert!(!sealed.contains("hello"));
        assert_eq!(
            cipher.open("detail:1", &sealed).as_deref(),
            Some("{\"subject\":\"hello\"}")
        );
    }

    #[test]
    fn tags_are_stable_keyed_and_hide_the_value() {
        let cipher = CacheCipher::new("device-secret");
        let tag = cipher.tag("{\"q\":\"divorce lawyer\"}");
        assert_eq!(tag, cipher.tag("{\"q\":\"divorce lawyer\"}"));
        assert_ne!(
            tag,
            CacheCipher::new("another-secret").tag("{\"q\":\"divorce lawyer\"}")
        );
        assert_eq!(tag.len(), 64);
        assert!(!tag.contains("divorce"));
    }

    #[test]
    fn produces_a_fresh_ciphertext_every_time() {
        let cipher = CacheCipher::new("device-secret");
        assert_ne!(
            cipher.seal("detail:1", "same").unwrap(),
            cipher.seal("detail:1", "same").unwrap()
        );
    }

    #[test]
    fn refuses_the_wrong_key_the_wrong_row_and_tampered_data() {
        let cipher = CacheCipher::new("device-secret");
        let sealed = cipher.seal("detail:1", "value").unwrap();
        assert!(CacheCipher::new("another-secret")
            .open("detail:1", &sealed)
            .is_none());
        assert!(cipher.open("detail:2", &sealed).is_none());
        let mut tampered = sealed.into_bytes();
        let last = tampered.len() - 2;
        tampered[last] = if tampered[last] == b'A' { b'B' } else { b'A' };
        assert!(cipher
            .open("detail:1", &String::from_utf8(tampered).unwrap())
            .is_none());
        assert!(cipher.open("detail:1", "not base64!").is_none());
        assert!(cipher.open("detail:1", "AAAA").is_none());
    }
}
