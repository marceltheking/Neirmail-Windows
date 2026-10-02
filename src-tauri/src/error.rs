use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub status: u16,
    pub code: Option<String>,
    pub message: String,
}

impl ApiError {
    pub fn transport(message: impl Into<String>) -> Self {
        Self {
            status: 0,
            code: None,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for ApiError {}
