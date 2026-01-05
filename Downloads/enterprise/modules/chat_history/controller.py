from fastapi import APIRouter, Depends, Request, HTTPException, status, Security
from modules.chat_history.models.requests import SaveChatMessageRequest
from modules.chat_history.service import ChatHistoryService
from utils.auth import User, authenticate_user

ac_router = APIRouter(prefix="/chat", tags=["Chat History"])
service = ChatHistoryService()

def get_token(request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return token

@ac_router.post("/store", status_code=status.HTTP_201_CREATED, response_model=dict)
async def store_chat_message(
    req: SaveChatMessageRequest,
    user: User = Security(authenticate_user),
):
    return await service.save_chat_message(req)

@ac_router.get("/history", status_code=status.HTTP_200_OK, response_model=dict)
async def get_chat_history(
    user_id: str,
    user: User = Security(authenticate_user),
):
    return await service.get_user_chats(user_id)

@ac_router.get("/history/{chat_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def get_chat_by_id(
    chat_id: str,
    user_id: str,
    user: User = Security(authenticate_user),
):
    return await service.get_chat_by_id(chat_id, user_id)

@ac_router.put("/history/{chat_id}", status_code=status.HTTP_200_OK)
async def update_chat_title(
    chat_id: str,
    user_id: str,
    title: str,
    user: User = Security(authenticate_user),
):
    return await service.update_chat_title(chat_id, user_id, title)

@ac_router.delete("/history/{chat_id}", status_code=status.HTTP_200_OK)
async def delete_chat_by_id(
    chat_id: str,
    user_id: str,
    soft_delete: bool = True,
    user: User = Security(authenticate_user),
):
    return await service.delete_chat_by_id(chat_id, user_id, soft_delete)