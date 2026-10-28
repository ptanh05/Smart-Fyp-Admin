import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage

try:
    from storages.backends.s3boto3 import S3Boto3Storage
except ImportError:
    S3Boto3Storage = None


class MediaStorage(S3Boto3Storage if S3Boto3Storage else FileSystemStorage):
    """
    Storage class for admin documents, exported PDF/Excel files, and templates.
    Supports AWS S3, Cloudflare R2, MinIO, or falls back to local FileSystemStorage.
    """
    location = getattr(settings, 'AWS_LOCATION', 'media')
    file_overwrite = False
    default_acl = None
    custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
    querystring_auth = getattr(settings, 'AWS_QUERYSTRING_AUTH', True)
    querystring_expire = getattr(settings, 'AWS_QUERYSTRING_EXPIRE', 3600)


def get_media_storage():
    """
    Dynamically returns the active storage instance based on configuration.
    """
    if getattr(settings, 'USE_S3', False) and getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None) and S3Boto3Storage:
        return MediaStorage()
    return FileSystemStorage(location=settings.MEDIA_ROOT, base_url=settings.MEDIA_URL)
