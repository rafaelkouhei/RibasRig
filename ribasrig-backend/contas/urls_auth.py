from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('token/', views.LoginView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('me/', views.EuView.as_view()),
    path('trocar-senha/', views.TrocarSenhaView.as_view()),
]
