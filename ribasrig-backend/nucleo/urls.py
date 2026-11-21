from django.urls import path

from . import views

urlpatterns = [
    path('sistema/', views.SistemaView.as_view()),
    path('configuracoes/', views.ConfiguracoesView.as_view()),
    path('configuracoes/logo/', views.ImagemConfiguracaoView.as_view(), {'qual': 'logo'}),
    path('configuracoes/assinatura/', views.ImagemConfiguracaoView.as_view(), {'qual': 'assinatura'}),
]
