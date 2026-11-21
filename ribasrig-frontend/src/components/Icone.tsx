import { Box } from '@mui/material';
import inicio from '../assets/icones/inicio.svg';
import novoPlano from '../assets/icones/novo-plano.svg';
import consulta from '../assets/icones/consulta.svg';
import guindastes from '../assets/icones/guindastes.svg';
import clientes from '../assets/icones/clientes.svg';
import acessorios from '../assets/icones/acessorios.svg';
import calculos from '../assets/icones/calculos.svg';
import usuarios from '../assets/icones/usuarios.svg';
import configuracoes from '../assets/icones/configuracoes.svg';

/** Ícones próprios do RibasRig (SVG em assets/icones, desenho como máscara: a cor vem do texto do menu). */
const ICONES = { inicio, 'novo-plano': novoPlano, consulta, guindastes, clientes, acessorios, calculos, usuarios, configuracoes } as const;
export type NomeIcone = keyof typeof ICONES;

/** Cada SVG é uma máscara: a cor vem de currentColor, então o ícone acompanha o texto (hover, item ativo). */
export function Icone({ nome, tamanho = 22 }: { nome: NomeIcone; tamanho?: number }) {
  const mascara = `url("${ICONES[nome]}") center / contain no-repeat`;
  return <Box component="span" aria-hidden sx={{ display: 'inline-block', flexShrink: 0, width: tamanho, height: tamanho, bgcolor: 'currentColor', mask: mascara, WebkitMask: mascara }} />;
}
