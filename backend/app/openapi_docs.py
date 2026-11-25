"""
Zero-dependency OpenAPI 3.0.3 Schema + Swagger UI generator for DRF/Django backends.
Provides /api/schema/ (JSON) and /api/docs/ (interactive Swagger UI).
"""
import re
from django.http import HttpResponse, JsonResponse
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


_PARAM_RE = re.compile(r"<(?:(?P<converter>[^:>]+):)?(?P<name>[^>]+)>")


def _to_openapi_path(raw_route: str) -> str:
    cleaned = "/" + raw_route.lstrip("/")
    return _PARAM_RE.sub(lambda m: f"{{{m.group('name')}}}", cleaned)


def _extract_path_params(openapi_path: str):
    names = re.findall(r"\{([^}]+)\}", openapi_path)
    return [
        {
            "name": name,
            "in": "path",
            "required": True,
            "schema": {"type": "integer" if name in ("pk", "id", "batch_id", "council_id", "round_id") else "string"},
        }
        for name in names
    ]


def _guess_tag(path: str) -> str:
    parts = [p for p in path.strip("/").split("/") if p and not p.startswith("{")]
    if not parts:
        return "General"
    if parts[0] in ("admin", "api", "app") and len(parts) > 1:
        return parts[1].replace("-", " ").title()
    return parts[0].replace("-", " ").title()


def _walk_patterns(patterns, prefix=""):
    for entry in patterns:
        if isinstance(entry, URLResolver):
            yield from _walk_patterns(entry.url_patterns, prefix + str(entry.pattern))
        elif isinstance(entry, URLPattern):
            yield prefix + str(entry.pattern), entry


def build_openapi_schema(title: str, version: str = "2.5.0", description: str = "") -> dict:
    resolver = get_resolver()
    paths = {}

    for raw_route, pattern in _walk_patterns(resolver.url_patterns):
        if raw_route.startswith(("django-admin/", "api/schema", "api/docs")):
            continue
        callback = pattern.callback
        view_cls = getattr(callback, "view_class", None)
        if view_cls is None or not issubclass(view_cls, APIView):
            continue

        openapi_path = _to_openapi_path(raw_route)
        methods = [
            m.lower()
            for m in ("get", "post", "put", "patch", "delete")
            if hasattr(view_cls, m)
        ]
        if not methods:
            continue

        doc = (getattr(view_cls, "__doc__", None) or "").strip()
        summary_line = doc.splitlines()[0].strip() if doc else view_cls.__name__
        path_params = _extract_path_params(openapi_path)
        tag = _guess_tag(openapi_path)

        path_item = paths.setdefault(openapi_path, {})
        for method in methods:
            op = {
                "tags": [tag],
                "summary": summary_line,
                "operationId": f"{view_cls.__name__}_{method}",
                "responses": {
                    "200": {"description": "Thành công"},
                    "400": {"description": "Dữ liệu không hợp lệ"},
                    "401": {"description": "Chưa xác thực"},
                    "403": {"description": "Không có quyền truy cập"},
                },
            }
            if doc:
                op["description"] = doc
            if path_params:
                op["parameters"] = path_params
            if method in ("post", "put", "patch"):
                op["requestBody"] = {
                    "required": False,
                    "content": {"application/json": {"schema": {"type": "object"}}},
                }
            path_item[method] = op

    return {
        "openapi": "3.0.3",
        "info": {
            "title": title,
            "version": version,
            "description": description,
        },
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            }
        },
        "security": [{"BearerAuth": []}],
        "paths": dict(sorted(paths.items())),
    }


def make_schema_view(title: str, description: str = ""):
    class OpenAPISchemaView(APIView):
        """Trả về đặc tả OpenAPI 3.0.3 JSON của toàn bộ API."""
        permission_classes = [AllowAny]

        def get(self, request):
            schema = build_openapi_schema(title=title, description=description)
            return JsonResponse(schema, json_dumps_params={"ensure_ascii": False})

    return OpenAPISchemaView.as_view()


def make_swagger_docs_view(title: str, schema_url: str = "/api/schema/"):
    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — Swagger API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {{ margin: 0; background: #f8fafc; }}
    .topbar {{ display: none; }}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {{
      window.ui = SwaggerUIBundle({{
        url: "{schema_url}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        docExpansion: "list",
        filter: true
      }});
    }};
  </script>
</body>
</html>"""

    class SwaggerDocsView(APIView):
        """Trang tài liệu API tương tác Swagger UI."""
        permission_classes = [AllowAny]

        def get(self, request):
            return HttpResponse(html, content_type="text/html; charset=utf-8")

    return SwaggerDocsView.as_view()
