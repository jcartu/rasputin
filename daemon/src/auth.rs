use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub session_id: String,
    pub scopes: Vec<String>,
    pub exp: usize,
}

pub struct AuthManager {
    secret: String,
    decoding_key: DecodingKey,
    validation: Validation,
}

impl AuthManager {
    pub fn new(secret: &str) -> Self {
        Self {
            secret: secret.to_string(),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            validation: Validation::new(Algorithm::HS256),
        }
    }

    pub fn create_token(&self, user_id: &str, session_id: &str, scopes: &[String]) -> String {
        let exp = chrono::Utc::now().timestamp() as usize + 3600;
        let claims = Claims {
            sub: user_id.to_string(),
            session_id: session_id.to_string(),
            scopes: scopes.to_vec(),
            exp,
        };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        ).unwrap_or_default()
    }

    pub fn verify(&self, token: &str) -> Result<Claims, AuthError> {
        self.validate_token(token)
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
        let token_data = decode::<Claims>(token, &self.decoding_key, &self.validation)
            .map_err(|e| AuthError::InvalidToken(e.to_string()))?;
        Ok(token_data.claims)
    }

    pub fn has_scope(&self, claims: &Claims, required_scope: &str) -> bool {
        claims.scopes.iter().any(|s| s == required_scope || s == "admin")
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("Missing scope: {0}")]
    MissingScope(String),
    #[error("Token expired")]
    TokenExpired,
}
