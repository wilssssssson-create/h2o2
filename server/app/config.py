from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE = SERVER_ROOT / "data" / "h2o2.db"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{DEFAULT_DATABASE}"
    invite_code: str = "h2o2-class"
    session_days: int = 14
    cookie_name: str = "h2o2_session"
    cookie_secure: bool = False
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    allow_lan_origins: bool = True

    model_config = SettingsConfigDict(env_file=SERVER_ROOT / ".env", env_prefix="H2O2_", extra="ignore")

    @property
    def origin_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


settings = Settings()
