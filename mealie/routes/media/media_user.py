from fastapi import APIRouter, HTTPException, Request, status
from pydantic import UUID4
from starlette.responses import FileResponse

from mealie.schema.user import PrivateUser

from ._cache import cached_file_response

router = APIRouter(prefix="/users")


@router.get("/{user_id}/{file_name}", response_class=FileResponse)
async def get_user_image(request: Request, user_id: UUID4, file_name: str):
    """Takes in a user id, returns the static image"""
    user_dir = PrivateUser.get_directory(user_id, create=False)
    user_image = (user_dir / file_name).resolve()

    if not user_image.is_relative_to(user_dir.resolve()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST)

    return cached_file_response(user_image, request)
