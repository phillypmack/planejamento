# Conceito de Design para a Interface do Sistema MRP/PCP

## 1. Paleta de Cores

Com base na pesquisa de referências de dashboards profissionais, a nova paleta de cores será focada em tons sóbrios e elegantes, com cores de destaque para elementos interativos e indicadores.

### Cores Principais:
- **Fundo (Background):** `#2C3E50` (Azul Marinho Escuro - quase preto, mas com um toque de cor)
- **Superfícies (Cards, Painéis):** `#34495E` (Azul Ardósia Escuro - um tom ligeiramente mais claro que o fundo)
- **Texto Principal:** `#ECF0F1` (Cinza Claro - para boa legibilidade em fundos escuros)
- **Texto Secundário/Ícones:** `#BDC3C7` (Cinza Médio - para informações menos proeminentes)

### Cores de Destaque/Ação:
- **Primária (Botões, Links, Destaques):** `#3498DB` (Azul Brilhante - profissional e convidativo)
- **Sucesso/Positivo:** `#2ECC71` (Verde Esmeralda - para indicadores de sucesso)
- **Atenção/Alerta:** `#F1C40F` (Amarelo Sol - para avisos e alertas)
- **Erro/Crítico:** `#E74C3C` (Vermelho Tomate - para erros e situações críticas)

### Cores para Gráficos (Exemplos, podem ser ajustadas pelo Chart.js):
- `#3498DB` (Azul)
- `#2ECC71` (Verde)
- `#9B59B6` (Roxo - mais suave que o anterior)
- `#F39C12` (Laranja)
- `#1ABC9C` (Turquesa)

## 2. Tipografia

- **Fonte Principal:** `Inter` ou `Roboto` (se disponível, caso contrário, `sans-serif` genérica)
- **Tamanhos:** Variados para hierarquia visual (ex: 2.5rem para títulos principais, 1rem para texto normal)
- **Pesos:** Regular, Medium, Bold

## 3. Layout e Componentes

- **Sidebar:** Manter o conceito de navegação lateral, com ícones e texto, e um estado recolhido/expandido.
- **Cards/Painéis:** Utilizar bordas arredondadas e sombras sutis para profundidade.
- **Formulários:** Campos de entrada com bordas suaves e foco visual claro.
- **Tabelas:** Linhas alternadas para melhor legibilidade, cabeçalhos fixos.
- **Gráficos:** Manter o estilo minimalista, com cores da paleta definida e legendas claras.

## 4. Ícones

- Manter a biblioteca Font Awesome para consistência.
- Utilizar ícones com estilo `solid` ou `regular` para clareza.

## 5. Acessibilidade

- Garantir contraste suficiente entre texto e fundo.
- Utilizar estados de foco claros para elementos interativos.
- Suporte a navegação por teclado.

## 6. Implementação

As cores serão aplicadas principalmente através da atualização do arquivo `src/static/style.css` e, se necessário, ajustes diretos no `src/static/index_new.html` e `src/static/script_new.js` para garantir a consistência visual. As classes do Tailwind CSS serão atualizadas para refletir a nova paleta de cores.

