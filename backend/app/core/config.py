import os
import json
from pathlib import Path
from typing import List
from pydantic import BaseModel, Field

class Settings(BaseModel):
    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: json.loads(
            os.getenv("CORS_ORIGINS", '["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]')
        )
    )
    
    # NS-3 WSL2 Settings
    NS3_DIR: str = Field(default_factory=lambda: os.getenv("NS3_DIR", "/home/kumar/MANET/ns-3/ns-allinone-3.41/ns-3.41"))
    WSL_DISTRO: str = Field(default_factory=lambda: os.getenv("WSL_DISTRO", "Ubuntu"))
    USE_WSL: bool = Field(default_factory=lambda: os.getenv("USE_WSL", "true").lower() in ("true", "1", "yes"))
    
    # Storage settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    RESULTS_DIR: Path = Path(__file__).resolve().parent.parent.parent / "results"
    DB_PATH: Path = Path(__file__).resolve().parent.parent / "database.sqlite3"
    
    SIMULATION_TIMEOUT_SECONDS: int = Field(default_factory=lambda: int(os.getenv("SIMULATION_TIMEOUT_SECONDS", "120")))

settings = Settings()
settings.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
