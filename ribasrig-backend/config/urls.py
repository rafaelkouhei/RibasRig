from django.urls import include, path

urlpatterns = [
    path('api/auth/', include('contas.urls_auth')),
    path('api/', include('contas.urls')),
    path('api/', include('cadastros.urls')),
    path('api/', include('planos.urls')),
    path('api/', include('nucleo.urls')),
]

# Erros fora das views do DRF também em JSON {"detail"} (nucleo/excecoes.py)
handler404 = 'nucleo.excecoes.nao_encontrado'
handler500 = 'nucleo.excecoes.erro_interno'
