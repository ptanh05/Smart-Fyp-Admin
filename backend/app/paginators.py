import math
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class FlexibleAdminPagination(PageNumberPagination):
    """
    Standard Admin Pagination for Smart FYP Admin.
    - Default page_size: 20
    - Configurable via ?page_size=X (max 200)
    - Supports disabling pagination via ?pagination=false or ?page_size=all
    - Automatically attaches count, total_pages, current_page, page_size, next, previous.
    """
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        # Allow client to opt out of pagination if needed for batch bulk operations
        pagination_param = str(request.query_params.get("pagination", "")).lower()
        page_size_param = str(request.query_params.get("page_size", "")).lower()

        if pagination_param in ["false", "0", "no"] or page_size_param in ["all", "none", "0"]:
            return None

        # If the view specifies opt_in_pagination=True, only paginate when ?page= is explicitly requested
        if getattr(view, "opt_in_pagination", False) and "page" not in request.query_params:
            return None

        return super().paginate_queryset(queryset, request, view=view)

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "total_pages": self.page.paginator.num_pages,
            "current_page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data,
        })


def paginate_data_or_list(data_list, request, serializer_class=None, serializer_context=None, extra_data=None, data_key="results"):
    """
    Helper function to paginate either a Django QuerySet or an already-sorted Python list.
    Supports backward compatibility:
    - If ?page= is supplied, returns paginated envelope.
    - If ?page= is NOT supplied, returns unpaginated response (either list or dict).
    """
    page_param = request.query_params.get("page")
    page_size_param = request.query_params.get("page_size", 20)

    try:
        page_size = int(page_size_param)
        if page_size <= 0:
            page_size = 20
        elif page_size > 200:
            page_size = 200
    except (ValueError, TypeError):
        page_size = 20

    total_count = len(data_list)
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

    # Opt-in check: If page is not specified and pagination is not forced, return full list
    if not page_param and str(request.query_params.get("paginate", "")).lower() not in ["true", "1"]:
        if serializer_class:
            serialized = serializer_class(data_list, many=True, context=serializer_context or {}).data
        else:
            serialized = data_list

        if extra_data is not None:
            res_dict = dict(extra_data)
            res_dict[data_key] = serialized
            res_dict["total"] = total_count
            return res_dict
        return serialized

    try:
        page_num = int(page_param) if page_param else 1
        if page_num < 1:
            page_num = 1
    except (ValueError, TypeError):
        page_num = 1

    start_idx = (page_num - 1) * page_size
    end_idx = start_idx + page_size
    page_slice = data_list[start_idx:end_idx]

    if serializer_class:
        serialized = serializer_class(page_slice, many=True, context=serializer_context or {}).data
    else:
        serialized = page_slice

    has_next = page_num < total_pages
    has_prev = page_num > 1

    base_url = request.build_absolute_uri(request.path)
    next_link = f"{base_url}?page={page_num + 1}&page_size={page_size}" if has_next else None
    prev_link = f"{base_url}?page={page_num - 1}&page_size={page_size}" if has_prev else None

    response_payload = {
        "count": total_count,
        "total": total_count,
        "total_pages": total_pages,
        "current_page": page_num,
        "page_size": page_size,
        "next": next_link,
        "previous": prev_link,
        data_key: serialized,
    }
    if extra_data:
        response_payload.update(extra_data)

    return response_payload

