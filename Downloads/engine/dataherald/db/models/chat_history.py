from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

class Message(BaseModel):
    id: Optional[str] = None
    chat_id: Optional[str] = None
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.now(timezone.utc))

class ChatHistory(BaseModel):
    id: Optional[str] = None
    user_id: str
    title: str
    created_at: datetime = Field(default_factory=datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=datetime.now(timezone.utc))
    messages: list[Message] = []
    is_deleted: bool = False