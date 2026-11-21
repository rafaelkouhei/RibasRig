import { useCallback, useEffect, useState } from 'react';

/**
 * Carrega dados da camada de API com estado de carregamento, erro e recarregar.
 * `chave` é o parâmetro da busca (ex.: nº do plano da rota): quando muda, carrega de novo.
 */
export function useCarregar<T>(buscar: () => Promise<T>, inicial: T, chave?: string | number) {
  const [dados, setDados] = useState<T>(inicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(null);
    buscar()
      .then((d) => { if (ativo) setDados(d); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
    // `buscar` muda a cada render; quem dispara a busca é a versão (recarregar) e a chave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, chave]);
  return { dados, setDados, carregando, erro, recarregar };
}
