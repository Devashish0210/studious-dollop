from pydantic import BaseModel
from typing import List, Optional
from .entities import Chat, Message

class ChatResponse(Chat):
    pass

class ChatListResponse(BaseModel):
    chats: List[Chat]