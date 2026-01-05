from typing import Optional, List
from dataherald.repositories.chat_history import ChatHistoryRepository
from dataherald.types import ChatHistory

class ChatHistoryService:
    def __init__(self, storage):
        self.repo = ChatHistoryRepository(storage)

    def save_message(self, user_id: str, role: str, content: str, chat_id: Optional[str] = None, title: Optional[str] = None) -> ChatHistory:
        return self.repo.save_message(user_id, role, content, chat_id, title)

    def get_user_chats(self, user_id: str) -> List[ChatHistory]:
        return self.repo.get_user_chats(user_id)

    def get_chat_by_id(self, chat_id: str, user_id: str) -> Optional[ChatHistory]:
        return self.repo.get_chat_by_id(chat_id, user_id)

    def update_chat_title(self, chat_id: str, user_id: str, title:str) -> dict:
        return self.repo.update_chat_title(chat_id, user_id, title)

    def delete_chat_by_id(self, chat_id: str, user_id: str, soft_delete:bool) -> dict:
        return self.repo.delete_chat(chat_id, user_id, soft_delete)
