from django.urls import path

from . import views as v

urlpatterns = [
    path('clientes/', v.ClientesView.as_view()),
    path('clientes/<int:id>/', v.ClienteView.as_view()),
    path('guindastes/', v.GuindastesView.as_view()),
    path('guindastes/<int:id>/', v.GuindasteView.as_view()),
    path('guindastes/<int:id>/laudo/arquivo/', v.LaudoArquivoView.as_view()),
    path('acessorios/', v.AcessoriosView.as_view()),
    path('acessorios/<int:id>/', v.AcessorioView.as_view()),
    path('acessorios/<int:id>/desativar/', v.DesativarAcessorioView.as_view()),
    path('acessorios/<int:id>/reativar/', v.ReativarAcessorioView.as_view()),
    path('acessorios/<int:id>/inspecoes/', v.InspecoesView.as_view()),
    path('acessorios/<int:id>/certificado/', v.CertificadoView.as_view()),
    path('padroes-inspecao/', v.PadroesView.as_view()),
    path('padroes-inspecao/<str:tipo>/', v.PadraoView.as_view()),
    path('regras/', v.RegrasView.as_view()),
    path('regras/<str:id>/', v.RegraView.as_view()),
    path('tipos-icamento/', v.TiposView.as_view()),
    path('tipos-icamento/<str:id>/', v.TipoView.as_view()),
]
