use reqwest::cookie::Jar;
use std::collections::HashSet;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

const MAX_REMEMBERED_FILES: usize = 500;

pub struct AppState {
    pub http: reqwest::Client,
    pub cookie_jar: Arc<Jar>,
    pub base_url: String,
    pub close_to_tray: AtomicBool,
    pub quit_deferred: AtomicBool,
    picked_files: Mutex<HashSet<String>>,
}

impl AppState {
    pub fn new() -> Self {
        let cookie_jar = Arc::new(Jar::default());
        let base_url = crate::http::client::base_url();
        let http = crate::http::client::build_client(cookie_jar.clone(), &base_url);
        Self {
            http,
            cookie_jar,
            base_url,
            close_to_tray: AtomicBool::new(true),
            quit_deferred: AtomicBool::new(false),
            picked_files: Mutex::new(HashSet::new()),
        }
    }

    pub fn remember_picked_files(&self, paths: &[String]) {
        if let Ok(mut picked) = self.picked_files.lock() {
            if picked.len() + paths.len() > MAX_REMEMBERED_FILES {
                picked.clear();
            }
            picked.extend(paths.iter().cloned());
        }
    }

    pub fn was_picked(&self, path: &str) -> bool {
        self.picked_files
            .lock()
            .is_ok_and(|picked| picked.contains(path))
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::AppState;

    #[test]
    fn only_remembers_files_the_native_picker_returned() {
        let state = AppState::new();
        assert!(!state.was_picked("/home/me/.ssh/id_ed25519"));
        state.remember_picked_files(&["/home/me/report.pdf".to_string()]);
        assert!(state.was_picked("/home/me/report.pdf"));
        assert!(!state.was_picked("/home/me/report.pdf.bak"));
    }

    #[test]
    fn forgets_old_selections_instead_of_growing_forever() {
        let state = AppState::new();
        let batch: Vec<String> = (0..500).map(|index| format!("/tmp/file-{index}")).collect();
        state.remember_picked_files(&batch);
        state.remember_picked_files(&["/tmp/latest".to_string()]);
        assert!(state.was_picked("/tmp/latest"));
        assert!(!state.was_picked("/tmp/file-0"));
    }
}
