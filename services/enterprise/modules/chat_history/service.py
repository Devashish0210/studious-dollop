import httpx
from config import settings
from datetime import datetime
from modules.chat_history.models.responses import ChatResponse, ChatListResponse
from modules.chat_history.models.requests import SaveChatMessageRequest

class ChatHistoryService:
    def __init__(self):
        self.engine_url = settings.engine_url.rstrip("/")  # ensure no trailing slash
        self.headers = {"X-OpenAI-Key": settings.api_key}

    async def save_chat_message(self, data: SaveChatMessageRequest) -> dict:
        """Forward a save message request to the engine and return mapped ChatResponse."""
        payload = {}
        # map camelCase to snake_case keys expected by engine
        payload["user_id"] = data.user_id
        if data.chat_id is not None:
            payload["chat_id"] = data.chat_id
        payload["role"] = data.role
        payload["content"] = data.content
        if data.title is not None:
            payload["title"] = data.title

        url = f"{self.engine_url}/chat/store"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json=payload,
                headers=self.headers,
                timeout=settings.default_engine_timeout,
            )
            resp.raise_for_status()
            engine_json = resp.json()

        # engine returns SaveChatMessageResponse with keys: id, user_id, title, messages, created_at, updated_at
        # Create ChatResponse (which extends Chat)
        return ChatResponse(**engine_json).dict()

    async def get_user_chats(self, user_id):
        """Get list of chat summaries for a user and map to ChatListResponse."""
        url = f"{self.engine_url}/chat/history"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params={"user_id": user_id},
                headers=self.headers,
                timeout=settings.default_engine_timeout,
            )
            resp.raise_for_status()
            engine_json = resp.json()

        # engine returns list of ChatSummaryResponse objects; map to Chat objects (no messages)
        chats = []
        for item in engine_json:
            chat = {
                "id": item.get("id"),
                "user_id": user_id,
                "title": item.get("title"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
                "messages": [],
                "is_deleted": item.get("is_deleted", False),
            }
            chats.append(chat)
        return ChatListResponse(chats=chats).dict()

    async def get_chat_by_id(self, chat_id, user_id):
        """Get full chat (with messages) by id."""
        url = f"{self.engine_url}/chat/history/{chat_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params={"user_id": user_id},
                headers=self.headers,
                timeout=settings.default_engine_timeout,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Chat history not found",
                    )
                raise e

            engine_json = resp.json()

        # engine returns ChatHistoryResponse: map directly to ChatResponse
        return ChatResponse(**engine_json).dict()
        
    async def update_chat_title(self, chat_id, user_id, title):
        url = f"{self.engine_url}/chat/history/{chat_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                url,
                params={"user_id": user_id, "title": title},
                headers=self.headers,
                timeout=settings.default_engine_timeout,
            )
            resp.raise_for_status()
            return resp.json()
        
    async def delete_chat_by_id(self, chat_id, user_id, soft_delete=True):
        url = f"{self.engine_url}/chat/history/{chat_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                url,
                params={"user_id": user_id, "soft_delete": soft_delete},
                headers=self.headers,
                timeout=settings.default_engine_timeout,
            )
            resp.raise_for_status()
            return resp.json()