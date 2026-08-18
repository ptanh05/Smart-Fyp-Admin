from django.contrib import admin
from django.urls import path, include
from app.views import HealthCheckAPIView

urlpatterns = [
    path('health/', HealthCheckAPIView.as_view(), name='root-health-check'),
    path('admin/', admin.site.urls),
    path('app/', include('app.urls')),
]

