from typing import List, Optional
from datetime import datetime, timezone
from bson.objectid import ObjectId
from dataherald.types import ChatHistory, Message

DB_COLLECTION = "chat_history"

class ChatNotFoundError(Exception):
    pass

class ChatHistoryRepository:
    def __init__(self, storage):
        self.storage = storage

    def save_message(self, user_id: str, role: str, content: str, chat_id: Optional[str] = None, title: Optional[str] = None) -> ChatHistory:
        """Save a message to chat history. Creates new chat if chat_id is None."""
        message = Message(
            id=str(ObjectId()),
            role=role, 
            content=content
        )
        
        if chat_id:
            # Update existing chat
            chat = self.storage.find_one(DB_COLLECTION, {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False})
            if not chat:
                # Create new chat with provided chat_id
                chat_obj = ChatHistory(
                    user_id=user_id,
                    title=title or self._generate_title(content),
                    messages=[message]
                )
                chat_dict = chat_obj.dict(exclude={"id"})
                chat_dict["_id"] = ObjectId(chat_id)
                self.storage.insert_one(DB_COLLECTION, chat_dict)
            else:
                # Add message to existing chat
                message.chat_id = chat_id
                self.storage.update_one(
                    DB_COLLECTION,
                    {"_id": ObjectId(chat_id)},
                    {
                        "$push": {"messages": message.dict()},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
            
            # Fetch updated chat
            chat = self.storage.find_one(DB_COLLECTION, {"_id": ObjectId(chat_id)})
        else:
            # Create new chat
            chat_obj = ChatHistory(
                user_id=user_id,
                title=title or self._generate_title(content),
                messages=[message]
            )
            chat_dict = chat_obj.dict(exclude={"id"})
            chat_id = self.storage.insert_one(DB_COLLECTION, chat_dict)
            chat = self.storage.find_one(DB_COLLECTION, {"_id": chat_id})
        
        return self._format_chat(chat)

    def get_user_chats(
        self, 
        user_id: str, 
        include_deleted: bool = False,
        page: int = 1,
        limit: int = 50
    ) -> List[ChatHistory]:
        """Get all chats for a user with pagination."""
        query = {"user_id": user_id}
        if not include_deleted:
            query["is_deleted"] = False
        
        chats = self.storage.find(
            DB_COLLECTION, 
            query,
            sort=[("updated_at", -1)],  # Most recently updated first
            page=page,
            limit=limit
        )
        
        return [self._format_chat(chat) for chat in chats]

    def get_chat_by_id(self, chat_id: str, user_id: str) -> Optional[ChatHistory]:
        """Get a specific chat by ID."""
        chat = self.storage.find_one(
            DB_COLLECTION, 
            {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False}
        )
        
        if not chat:
            return None
        
        return self._format_chat(chat)

    def update_chat_title(self, chat_id: str, user_id: str, title: str) -> ChatHistory:
        """Update the title of a chat."""
        result = self.storage.update_one(
            DB_COLLECTION,
            {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False},
            {
                "$set": {
                    "title": title,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result == 0:
            raise ChatNotFoundError(f"Chat {chat_id} not found")
        
        chat = self.storage.find_one(DB_COLLECTION, {"_id": ObjectId(chat_id)})
        return self._format_chat(chat)

    def delete_chat(self, chat_id: str, user_id: str, soft_delete: bool = True) -> bool:
        """Delete a chat (soft delete by default)."""
        if soft_delete:
            result = self.storage.update_one(
                DB_COLLECTION,
                {"_id": ObjectId(chat_id), "user_id": user_id},
                {
                    "$set": {
                        "is_deleted": True,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            return result > 0
        else:
            result = self.storage.delete_by_id(DB_COLLECTION, chat_id)
            return result > 0

    def get_chat_messages(
        self, 
        chat_id: str, 
        user_id: str,
        limit: Optional[int] = None
    ) -> List[Message]:
        """Get messages from a chat, optionally limited to most recent N messages."""
        chat = self.get_chat_by_id(chat_id, user_id)
        
        if not chat:
            raise ChatNotFoundError(f"Chat {chat_id} not found")
        
        messages = chat.messages
        if limit:
            messages = messages[-limit:]  # Get last N messages
        
        return messages

    def _format_chat(self, chat: dict) -> ChatHistory:
        """Convert MongoDB document to ChatHistory model."""
        chat["id"] = str(chat["_id"])
        
        # Ensure all messages have IDs
        for msg in chat.get("messages", []):
            if not msg.get("id"):
                msg["id"] = str(ObjectId())
            if not msg.get("chat_id"):
                msg["chat_id"] = chat["id"]
        
        return ChatHistory(**chat)

    def _generate_title(self, content: str, max_length: int = 30) -> str:
        """Generate a title from message content."""
        title = content.strip()[:max_length]
        if len(content) > max_length:
            title += "..."
        return title or "New Chat"