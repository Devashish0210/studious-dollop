from pydantic import BaseModel
from typing import Optional

class SaveChatMessageRequest(BaseModel):
    user_id: str
    chat_id: Optional[str] = None
    role: str
    content: str
    title: Optional[str] = None