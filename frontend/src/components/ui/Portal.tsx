import type React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza os filhos direto no <body>, fora da árvore da página.
 * Use para tudo que é position: fixed e precisa cobrir a tela inteira acima da navegação.
 */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

export default Portal;
