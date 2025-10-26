"""
Application settings, logging, and environment configuration
"""

import logging
import os
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging directory
os.makedirs("logs", exist_ok=True)

# Create logger
logger = logging.getLogger("proto_engine")
logger.setLevel(logging.DEBUG)

# File handler with rotation (10MB max, keep 5 backup files)
file_handler = RotatingFileHandler(
    "logs/proto_engine.log",
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,
    encoding="utf-8",
)
file_handler.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# CORS configuration
# Can be overridden via CORS_ORIGINS environment variable (comma-separated)
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [origin.strip() for origin in _cors_env.split(",")]
else:
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default ports
    ]
