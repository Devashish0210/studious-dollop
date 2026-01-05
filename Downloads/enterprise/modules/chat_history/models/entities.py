from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional

class Message(BaseModel):
    id: Optional[str]
    chat_id: Optional[str]
    role: str  # "user" or "assistant"
    content: str
    created_at: Optional[datetime] = None

class Chat(BaseModel):
    id: Optional[str]
    user_id: str
    title: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    messages: Optional[List[Message]] = []
    is_deleted: bool = False