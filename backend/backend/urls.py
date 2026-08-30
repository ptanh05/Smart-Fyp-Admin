from django.contrib import admin
from django.urls import path, include
from app.views import HealthCheckAPIView

urlpatterns = [
    path('', HealthCheckAPIView.as_view(), name='root-health-check'),
    path('health/', HealthCheckAPIView.as_view(), name='health-check'),
    path('django-admin/', admin.site.urls),
    path('app/', include('app.urls')),
    path('', include('app.urls')),
]
