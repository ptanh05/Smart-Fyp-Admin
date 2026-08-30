from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok", "service": "Smart-Fyp-Admin API"})

urlpatterns = [
    path('', health_check, name='root-health-check'),
    path('health/', health_check, name='health-check'),
    path('django-admin/', admin.site.urls),
    path('app/', include('app.urls')),
    path('', include('app.urls')),
]

