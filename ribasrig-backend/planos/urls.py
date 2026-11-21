from django.urls import path

from . import views as v

urlpatterns = [
    path('planos/', v.PlanosView.as_view()),
    path('planos/lote/', v.LoteView.as_view()),
    path('planos/<str:numero>/', v.PlanoView.as_view()),
    path('planos/<str:numero>/emitir/', v.EmitirView.as_view()),
    path('planos/<str:numero>/nova-revisao/', v.NovaRevisaoView.as_view()),
    path('planos/<str:numero>/duplicar/', v.DuplicarView.as_view()),
    path('planos/<str:numero>/historico/', v.HistoricoView.as_view()),
    path('planos/<str:numero>/anexos/<str:tipo>/', v.AnexoView.as_view()),
    path('planos/<str:numero>/revisoes/<int:rev>/pdf/', v.DocumentoRevisaoView.as_view(), {'tipo': 'plano'}),
    path('planos/<str:numero>/revisoes/<int:rev>/memorial/', v.DocumentoRevisaoView.as_view(), {'tipo': 'memorial'}),
    path('planos/<str:numero>/carimbo/', v.CarimboView.as_view()),
]
