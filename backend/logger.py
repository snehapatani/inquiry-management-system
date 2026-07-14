import logging
import os
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, timedelta
import glob

# Create logs directory if it doesn't exist
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Configure logger
logger = logging.getLogger("InquiryMS")
logger.setLevel(logging.DEBUG)

# Log format
log_format = logging.Formatter(
    fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Error log handler (rotates weekly on Monday at 00:00)
error_handler = TimedRotatingFileHandler(
    filename=os.path.join(LOG_DIR, "errors.log"),
    when="W0",  # Weekly on Monday
    interval=1,
    backupCount=4,  # Keep 4 weeks of backups
    encoding="utf-8"
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(log_format)

# Info log handler (rotates weekly on Monday at 00:00)
info_handler = TimedRotatingFileHandler(
    filename=os.path.join(LOG_DIR, "info.log"),
    when="W0",
    interval=1,
    backupCount=4,
    encoding="utf-8"
)
info_handler.setLevel(logging.INFO)
info_handler.setFormatter(log_format)

# Console handler for development (only errors to reduce noise)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.ERROR)
console_handler.setFormatter(log_format)

# Add handlers to logger
logger.addHandler(error_handler)
logger.addHandler(info_handler)
logger.addHandler(console_handler)

# Log startup
logger.info("=" * 60)
logger.info("Inquiry MS Backend Started")
logger.info("=" * 60)


def cleanup_old_logs():
    """Delete log files older than 4 weeks"""
    cutoff_time = datetime.now() - timedelta(weeks=4)

    for log_file in glob.glob(os.path.join(LOG_DIR, "*.log*")):
        try:
            file_time = datetime.fromtimestamp(os.path.getctime(log_file))
            if file_time < cutoff_time:
                os.remove(log_file)
                logger.info(f"Deleted old log file: {log_file}")
        except Exception as e:
            logger.error(f"Error deleting log file {log_file}: {e}")


# Clean up old logs on startup
cleanup_old_logs()
