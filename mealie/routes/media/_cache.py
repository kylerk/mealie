from hashlib import md5
from pathlib import Path

from fastapi import HTTPException, Request, Response, status
from starlette.responses import FileResponse

# Recipe and user images are addressed with a version query parameter that changes whenever the
# image changes, so browsers can cache them for a long time without ever revalidating.
IMMUTABLE_CACHE_CONTROL = "private, max-age=31536000, immutable"


def _etag_for(stat) -> str:
    # mirrors starlette.responses.FileResponse so a conditional request matches the ETag we send
    etag_base = str(stat.st_mtime) + "-" + str(stat.st_size)
    return f'"{md5(etag_base.encode(), usedforsecurity=False).hexdigest()}"'


def cached_file_response(path: Path, request: Request, media_type: str = "image/webp") -> Response:
    """
    Serves a static media file with long-lived cache headers. Responds with 304 Not Modified when the
    client already holds the current version, and 404 when the file does not exist. The single stat()
    call doubles as the existence check so a request never creates directories or touches the disk twice.
    """

    try:
        stat = path.stat()
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND) from None

    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    headers = {"Cache-Control": IMMUTABLE_CACHE_CONTROL}
    etag = _etag_for(stat)

    if_none_match = request.headers.get("if-none-match")
    if if_none_match and etag in [tag.strip() for tag in if_none_match.split(",")]:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={**headers, "ETag": etag})

    return FileResponse(path, media_type=media_type, headers=headers, stat_result=stat)
