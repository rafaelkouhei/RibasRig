from django.urls import path

from . import views

urlpatterns = [
    path('usuarios/', views.UsuariosView.as_view()),
    path('usuarios/<int:id>/', views.UsuarioView.as_view()),
    path('usuarios/<int:id>/senha-provisoria/', views.SenhaProvisoriaView.as_view()),
]
